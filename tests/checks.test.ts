import { describe, expect, it } from "vitest";

import {
  extractKanjiNumbers,
  extractNumbers,
  hasNumberMismatch,
  hasProhibition,
  hasProhibitionMarker,
  isProhibitionMissing,
} from "@/lib/checks";

describe("number check (PRD section 11)", () => {
  it("extracts ASCII digit sequences", () => {
    expect(extractNumbers("7時30分から5分間")).toEqual(["7", "30", "5"]);
  });

  it("normalizes full-width digits", () => {
    expect(extractNumbers("７時３０分")).toEqual(["7", "30"]);
  });

  it("normalizes Burmese digits", () => {
    expect(extractNumbers("၁၂၃ ခု")).toEqual(["123"]);
  });

  it("removes thousands separators but keeps times and decimals split", () => {
    expect(extractNumbers("1,234 個")).toEqual(["1234"]);
    expect(extractNumbers("1.000 台")).toEqual(["1000"]);
    // Decimals split into parts — identically on both sides, so a
    // source "3.5" still matches a translation "3,5" or "3.5".
    expect(extractNumbers("3.5 ミリ")).toEqual(["3", "5"]);
    expect(extractNumbers("1,234.56")).toEqual(["1234", "56"]);
    // A clock time in the Indonesian dot form stays split, exactly
    // like the Japanese source writes it (7時30分), and its leading
    // zero carries no value.
    expect(extractNumbers("pukul 07.30")).toEqual(["7", "30"]);
  });

  it("compares multisets regardless of order", () => {
    expect(hasNumberMismatch("2個と3本", "3 and 2")).toBe(false);
    expect(hasNumberMismatch("７時３０分", "7:30")).toBe(false);
  });

  it("flags a changed, added, or dropped number", () => {
    expect(hasNumberMismatch("7時30分", "7:45")).toBe(true);
    expect(hasNumberMismatch("5個", "5 pieces and 2 more")).toBe(true);
    expect(hasNumberMismatch("5個と2本", "5 pieces")).toBe(true);
    expect(hasNumberMismatch("点検です", "inspection")).toBe(false);
  });
});

describe("number check audit regressions ", () => {
  it("does not flag meeting times in any common notation", () => {
    const source = "明日の朝礼は7時30分から行います";
    expect(
      hasNumberMismatch(source, "Apel pagi dimulai pukul 07.30"),
    ).toBe(false);
    expect(
      hasNumberMismatch(source, "Apel pagi dimulai pukul 7.30"),
    ).toBe(false);
    expect(hasNumberMismatch(source, "Meeting starts at 07:30")).toBe(
      false,
    );
    expect(hasNumberMismatch(source, "Meeting starts at 7:30")).toBe(
      false,
    );
  });

  it("still flags a genuinely different time", () => {
    expect(hasNumberMismatch("7時30分", "pukul 7.45")).toBe(true);
    expect(hasNumberMismatch("7時30分", "pukul 8.30")).toBe(true);
  });

  it("ignores leading zeros", () => {
    expect(hasNumberMismatch("7人", "07 people")).toBe(false);
    expect(extractNumbers("007 個")).toEqual(["7"]);
  });

  it("does not count month names, in digits or kanji", () => {
    expect(
      hasNumberMismatch("12月5日に実施します", "Dilaksanakan pada 5 Desember"),
    ).toBe(false);
    expect(
      hasNumberMismatch(
        "十一月五日に実施します",
        "Dilaksanakan pada tanggal 5 November",
      ),
    ).toBe(false);
    // The day in the same date is still checked.
    expect(
      hasNumberMismatch(
        "十一月五日に実施します",
        "Dilaksanakan pada tanggal 6 November",
      ),
    ).toBe(true);
  });
});

describe("prohibition check (PRD section 11)", () => {
  it("detects every listed prohibition expression", () => {
    for (const text of [
      "立ち入り禁止です",
      "触ってはいけません",
      "入ってはならない",
      "触らないでください",
      "持ち込まないこと",
      "火気厳禁",
      "使用不可です",
    ]) {
      expect(hasProhibition(text)).toBe(true);
    }
  });

  it("does not flag ordinary text", () => {
    expect(hasProhibition("明日の朝礼は7時30分からです")).toBe(false);
    expect(hasProhibition("安全第一で作業してください")).toBe(false);
  });
});

describe("kanji numeral reading", () => {
  it("reads compound kanji numerals positionally", () => {
    expect(extractKanjiNumbers("三十分")).toEqual(["30"]);
    expect(extractKanjiNumbers("二十三人")).toEqual(["23"]);
    expect(extractKanjiNumbers("二千五百個")).toEqual(["2500"]);
    expect(extractKanjiNumbers("一万二千円")).toEqual(["12000"]);
    expect(extractKanjiNumbers("十時")).toEqual(["10"]);
  });

  it("reads a lone digit only before a counter character", () => {
    expect(extractKanjiNumbers("三台")).toEqual(["3"]);
    expect(extractKanjiNumbers("一人")).toEqual(["1"]);
    expect(extractKanjiNumbers("五分間")).toEqual(["5"]);
    // Not quantities: together / number one / if-by-any-chance.
    expect(extractKanjiNumbers("一緒に確認してください")).toEqual([]);
    expect(extractKanjiNumbers("一番大切です")).toEqual([]);
    expect(extractKanjiNumbers("万一の場合は")).toEqual([]);
  });

  it("reads year-style digit-by-digit kanji", () => {
    expect(extractKanjiNumbers("二〇二六年")).toEqual(["2026"]);
    expect(extractNumbers("二〇二六年に導入")).toEqual(["2026"]);
  });

  it("compares kanji numerals against translated digits", () => {
    expect(
      hasNumberMismatch(
        "フォークリフトを三台点検してください",
        "Periksa 3 unit forklift",
      ),
    ).toBe(false);
    expect(
      hasNumberMismatch(
        "フォークリフトを三台点検してください",
        "Periksa 2 unit forklift",
      ),
    ).toBe(true);
    expect(hasNumberMismatch("三十分待ってください", "Tunggu 30 menit")).toBe(
      false,
    );
    expect(hasNumberMismatch("三十分待ってください", "Tunggu 15 menit")).toBe(
      true,
    );
    // A kanji quantity dropped entirely is also a mismatch.
    expect(hasNumberMismatch("部品を五個ください", "Berikan komponennya")).toBe(
      true,
    );
  });
});

describe("target-side prohibition check ", () => {
  const source = "ラインが動いている間は、絶対に手を入れないでください";

  it("recognizes prohibition markers per language", () => {
    expect(hasProhibitionMarker("Jangan memasukkan tangan", "id")).toBe(true);
    expect(hasProhibitionMarker("Dilarang masuk", "id")).toBe(true);
    expect(hasProhibitionMarker("Tidak boleh menyentuh", "id")).toBe(true);
    expect(hasProhibitionMarker("Do not touch", "en")).toBe(true);
    expect(hasProhibitionMarker("Never enter", "en")).toBe(true);
    expect(hasProhibitionMarker("Não toque", "pt")).toBe(true);
    expect(hasProhibitionMarker("É proibido entrar", "pt")).toBe(true);
    expect(hasProhibitionMarker("Không được chạm vào", "vi")).toBe(true);
    expect(hasProhibitionMarker("Cấm vào", "vi")).toBe(true);
    // The standard negated imperative contains the မလုပ် marker.
    expect(hasProhibitionMarker("မလုပ်ပါနဲ့", "my")).toBe(true);
    expect(hasProhibitionMarker("တားမြစ်ထားသည်", "my")).toBe(true);
    // Filipino and Chinese markers: minimal lists,
    // not yet native-validated, like the Burmese list.
    expect(hasProhibitionMarker("Huwag ilagay ang kamay", "fil")).toBe(true);
    expect(hasProhibitionMarker("Ipinagbabawal ang pagpasok", "fil")).toBe(
      true,
    );
    expect(hasProhibitionMarker("Mag-ingat sa pagpasok", "fil")).toBe(false);
    expect(hasProhibitionMarker("禁止触摸", "zh")).toBe(true);
    expect(hasProhibitionMarker("不要把手伸入", "zh")).toBe(true);
    expect(hasProhibitionMarker("请小心操作", "zh")).toBe(false);
    // A "please be careful" softening carries no marker at all.
    expect(hasProhibitionMarker("သတိထားပြီး လုပ်ဆောင်ပါ", "my")).toBe(false);
  });

  it("flags a translation whose prohibition was softened away", () => {
    expect(
      isProhibitionMissing(
        source,
        "Harap berhati-hati saat memasukkan tangan",
        "id",
      ),
    ).toBe(true);
    expect(
      isProhibitionMissing(
        source,
        "Jangan sekali-kali memasukkan tangan saat line berjalan",
        "id",
      ),
    ).toBe(false);
    expect(
      isProhibitionMissing(source, "Please be careful", "en"),
    ).toBe(true);
  });

  it("never flags when the source has no prohibition", () => {
    expect(
      isProhibitionMissing("明日は大雨です", "Besok hujan deras", "id"),
    ).toBe(false);
  });
});
