import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  loadGlossaryTerms,
  parseGlossaryData,
  selectGlossaryLines,
  type GlossaryEntry,
} from "@/lib/glossary";
import { buildSystemPrompt } from "@/lib/prompt";

function entry(overrides: Partial<GlossaryEntry>): GlossaryEntry {
  return {
    ja: "カプラー",
    style: "term",
    meaning: "wiring harness connector",
    id: "ID-VALUE",
    status: "verified",
    ...overrides,
  };
}

const source = { text: "カプラーを確認してください", division: "", topic: "" };

describe("glossary schema validation (PRD section 10)", () => {
  it("accepts the production file, which starts empty", () => {
    const raw = readFileSync(
      join(process.cwd(), "data", "glossary", "anzen.json"),
      "utf8",
    );
    expect(parseGlossaryData(JSON.parse(raw))).toEqual([]);
    expect(loadGlossaryTerms()).toEqual([]);
  });

  it("rejects unknown keys, duplicate ja, and bad enums", () => {
    expect(() =>
      parseGlossaryData({ terms: [{ ...entry({}), bogus: 1 }] }),
    ).toThrow();
    expect(() =>
      parseGlossaryData({ terms: [entry({}), entry({})] }),
    ).toThrow();
    expect(() =>
      parseGlossaryData({ terms: [entry({ style: "other" as never })] }),
    ).toThrow();
    expect(() => parseGlossaryData({ terms: "nope" })).toThrow();
  });

  it("requires meaning and at least one translation for verified entries", () => {
    expect(() =>
      parseGlossaryData({ terms: [entry({ meaning: undefined })] }),
    ).toThrow();
    expect(() =>
      parseGlossaryData({ terms: [entry({ id: undefined })] }),
    ).toThrow();
    // Drafts may be incomplete.
    expect(
      parseGlossaryData({
        terms: [{ ja: "下書き", style: "term", status: "draft" }],
      }),
    ).toHaveLength(1);
  });

  it("enforces the explain shape and its length limits", () => {
    const explain = (overrides: Partial<GlossaryEntry>) => ({
      ja: "ヒヤリハット",
      style: "explain" as const,
      meaning: "a near miss",
      status: "verified" as const,
      ...overrides,
    });
    // Missing the "{ja} (...)" shape.
    expect(() =>
      parseGlossaryData({ terms: [explain({ id: "just text" })] }),
    ).toThrow();
    // 11 words for id.
    expect(() =>
      parseGlossaryData({
        terms: [
          explain({
            id: "ヒヤリハット (one two three four five six seven eight nine ten eleven)",
          }),
        ],
      }),
    ).toThrow();
    // 91 code points for my.
    expect(() =>
      parseGlossaryData({
        terms: [explain({ my: `ヒヤリハット (${"あ".repeat(91)})` })],
      }),
    ).toThrow();
    // Exactly at the limits passes.
    expect(
      parseGlossaryData({
        terms: [
          explain({
            id: "ヒヤリハット (one two three four five six seven eight nine ten)",
            my: `ヒヤリハット (${"あ".repeat(90)})`,
          }),
        ],
      }),
    ).toHaveLength(1);
    // Chinese follows the Burmese code-point bound, not the word
    // bound: 91 code points fails, 90 passes.
    expect(() =>
      parseGlossaryData({
        terms: [explain({ zh: `ヒヤリハット (${"险".repeat(91)})` })],
      }),
    ).toThrow();
    expect(
      parseGlossaryData({
        terms: [explain({ zh: `ヒヤリハット (${"险".repeat(90)})` })],
      }),
    ).toHaveLength(1);
    // Filipino uses the word bound like Indonesian.
    expect(() =>
      parseGlossaryData({
        terms: [
          explain({
            fil: "ヒヤリハット (one two three four five six seven eight nine ten eleven)",
          }),
        ],
      }),
    ).toThrow();
  });
});

describe("glossary selection (PRD section 10)", () => {
  it("builds a term line with only the requested languages and the meaning", () => {
    const { lines, skipped } = selectGlossaryLines(
      [entry({ vi: "VI-VALUE" })],
      source,
      ["id", "vi"],
    );
    expect(lines).toEqual([
      "カプラー => id: ID-VALUE | vi: VI-VALUE [meaning: wiring harness connector]",
    ]);
    expect(skipped).toBe(0);
  });

  it("builds an explain line with the [EXPLAIN] marker", () => {
    const { lines } = selectGlossaryLines(
      [
        entry({
          ja: "ヒヤリハット",
          style: "explain",
          meaning: "a near miss",
          id: "ヒヤリハット (near miss, no injury)",
        }),
      ],
      { text: "ヒヤリハット事例です", division: "", topic: "" },
      ["id"],
    );
    expect(lines).toEqual([
      "ヒヤリハット => [EXPLAIN] id: ヒヤリハット (near miss, no injury) [meaning: a near miss]",
    ]);
  });

  it("ignores drafts, unmatched terms, and entries without a requested language", () => {
    const { lines, skipped } = selectGlossaryLines(
      [
        entry({ status: "draft" }),
        entry({ ja: "溶接", id: "ID-WELD" }),
        entry({ ja: "カプラー", id: undefined, en: "EN-VALUE" }),
      ],
      source,
      ["id"],
    );
    expect(lines).toEqual([]);
    expect(skipped).toBe(0);
  });

  it("matches terms in the context fields and after NFKC normalization", () => {
    const byContext = selectGlossaryLines(
      [entry({})],
      { text: "連絡です", division: "カプラー工程", topic: "" },
      ["id"],
    );
    expect(byContext.lines).toHaveLength(1);

    const byNfkc = selectGlossaryLines(
      [entry({ ja: "ABC" })],
      { text: "ＡＢＣ工程の連絡です", division: "", topic: "" },
      ["id"],
    );
    expect(byNfkc.lines).toHaveLength(1);
  });

  it("orders longest terms first", () => {
    const { lines } = selectGlossaryLines(
      [
        entry({ ja: "溶接", id: "SHORT" }),
        entry({ ja: "スポット溶接", id: "LONG" }),
      ],
      { text: "スポット溶接の点検です", division: "", topic: "" },
      ["id"],
    );
    expect(lines[0]).toContain("スポット溶接");
    expect(lines[1]).toContain("溶接 =>");
  });

  it("counts entries beyond the 30-entry cap as skipped", () => {
    const terms = Array.from({ length: 31 }, (_, i) =>
      entry({ ja: `語${i}`, id: `V${i}` }),
    );
    const text = terms.map((term) => term.ja).join("、");
    const { lines, skipped } = selectGlossaryLines(
      terms,
      { text, division: "", topic: "" },
      ["id"],
    );
    expect(lines).toHaveLength(30);
    expect(skipped).toBe(1);
  });

  it("counts entries that exceed the 2500-character budget as skipped", () => {
    const longMeaning = "x".repeat(1300);
    const terms = [
      entry({ ja: "甲", meaning: longMeaning }),
      entry({ ja: "乙", meaning: longMeaning }),
      entry({ ja: "丙", meaning: "short" }),
    ];
    const { lines, skipped } = selectGlossaryLines(
      terms,
      { text: "甲と乙と丙です", division: "", topic: "" },
      ["id"],
    );
    // The first long entry fits; the second would pass 2500 characters
    // and is skipped; the short one still fits afterwards.
    expect(lines).toHaveLength(2);
    expect(skipped).toBe(1);
    expect(lines.join("\n").length).toBeLessThanOrEqual(2500);
  });

  it("never puts note, reading, domain, or status into a prompt line (SEC-09)", () => {
    const { lines } = selectGlossaryLines(
      [
        entry({
          note: "NOTE-TEXT-MUST-NOT-LEAK",
          reading: "READING-TEXT",
          domain: "DOMAIN-TEXT",
        }),
      ],
      source,
      ["id"],
    );
    const prompt = buildSystemPrompt(lines);
    for (const forbidden of [
      "NOTE-TEXT-MUST-NOT-LEAK",
      "READING-TEXT",
      "DOMAIN-TEXT",
      "verified",
    ]) {
      expect(lines.join("\n")).not.toContain(forbidden);
      expect(prompt).not.toContain(forbidden);
    }
  });
});
