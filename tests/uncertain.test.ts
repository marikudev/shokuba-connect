import { describe, expect, it } from "vitest";

import { ja } from "@/lib/i18n/ja";
import {
  extractQuotedPhrase,
  fallbackUncertainEntry,
  isJapaneseUncertainEntry,
  sanitizeUncertainEntries,
} from "@/lib/uncertain";

// The two foreign entries below are actual model outputs
// (GPT-6 Luna with fil+zh targets, Nemotron Ultra with id+zh
// targets): the explanation was written in Simplified Chinese,
// which the Japanese operator cannot read.
const LUNA_CHINESE_ENTRY =
  "「不具合」：具体指哪一种螺栓拧紧不良，请确认。";
const ULTRA_CHINESE_ENTRY =
  "「不具合」：未说明是哪个工序、哪种不良（如扭矩不足、螺栓遗漏、螺纹损伤等），需确认具体不良内容。";
const JAPANESE_ENTRY =
  "「不具合」が、どの箇所のどのような不具合を指すのかが分かりません。具体的に確認してください。";

describe("uncertain Japanese guard", () => {
  it("recognizes Japanese entries by their kana", () => {
    expect(isJapaneseUncertainEntry(JAPANESE_ENTRY)).toBe(true);
    expect(isJapaneseUncertainEntry(LUNA_CHINESE_ENTRY)).toBe(false);
    expect(isJapaneseUncertainEntry(ULTRA_CHINESE_ENTRY)).toBe(false);
    expect(
      isJapaneseUncertainEntry("The term is unclear; please confirm."),
    ).toBe(false);
  });

  it("extracts the quoted source phrase", () => {
    expect(extractQuotedPhrase(LUNA_CHINESE_ENTRY)).toBe("不具合");
    expect(extractQuotedPhrase("『締め付け』is unclear")).toBe("締め付け");
    expect(extractQuotedPhrase("no quote here")).toBeNull();
  });

  it("replaces a foreign entry with a Japanese fallback naming the phrase", () => {
    const fallback = fallbackUncertainEntry(LUNA_CHINESE_ENTRY);
    expect(fallback).toBe(
      ja.uncertainForeignWithPhrase.replace("{phrase}", "不具合"),
    );
    expect(isJapaneseUncertainEntry(fallback)).toBe(true);
    expect(fallback).not.toContain("具体指");
  });

  it("falls back to the generic entry when nothing is quoted", () => {
    expect(fallbackUncertainEntry("具体指哪一种不良，请确认。")).toBe(
      ja.uncertainForeignGeneric,
    );
  });

  it("keeps Japanese entries untouched and de-duplicates fallbacks", () => {
    const result = sanitizeUncertainEntries([
      JAPANESE_ENTRY,
      LUNA_CHINESE_ENTRY,
      ULTRA_CHINESE_ENTRY,
    ]);
    // Both Chinese entries quote the same phrase, so they collapse
    // into a single fallback next to the untouched Japanese entry.
    expect(result).toEqual([
      JAPANESE_ENTRY,
      ja.uncertainForeignWithPhrase.replace("{phrase}", "不具合"),
    ]);
  });
});
