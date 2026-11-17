import { describe, expect, it } from "vitest";

import {
  MAX_TEXT_LENGTH,
  containsControlCharacter,
  containsJapaneseLetter,
  countCharacters,
  isWithinLength,
  validateSourceText,
} from "@/lib/validate";

// Note: control characters and astral characters are built with
// String.fromCharCode / String.fromCodePoint so this file stays readable.
const BELL = String.fromCharCode(0x07);
const ASTRAL_KANJI = String.fromCodePoint(0x20bb7);

describe("validateSourceText", () => {
  it("rejects empty input", () => {
    const result = validateSourceText("");
    expect(result.isEmpty).toBe(true);
    expect(result.isValid).toBe(false);
  });

  it("accepts exactly 300 characters and rejects 301", () => {
    const atLimit = validateSourceText("あ".repeat(MAX_TEXT_LENGTH));
    expect(atLimit.charCount).toBe(300);
    expect(atLimit.isOverLimit).toBe(false);
    expect(atLimit.isValid).toBe(true);

    const overLimit = validateSourceText("あ".repeat(MAX_TEXT_LENGTH + 1));
    expect(overLimit.charCount).toBe(301);
    expect(overLimit.isOverLimit).toBe(true);
    expect(overLimit.isValid).toBe(false);
  });

  it("counts characters per code point, not per UTF-16 unit", () => {
    expect(countCharacters(ASTRAL_KANJI)).toBe(1);
    expect(countCharacters(`a${ASTRAL_KANJI}b`)).toBe(3);
  });

  it("detects hiragana, katakana, and kanji as Japanese letters", () => {
    expect(containsJapaneseLetter("ひらがな")).toBe(true);
    expect(containsJapaneseLetter("カタカナ")).toBe(true);
    expect(containsJapaneseLetter("漢字")).toBe(true);
    expect(containsJapaneseLetter("本日はテストです")).toBe(true);
  });

  it("does not invalidate text without Japanese letters (alphabet-heavy factory terms)", () => {
    const result = validateSourceText("Torque check NG");
    expect(result.hasJapaneseLetter).toBe(false);
    expect(result.isValid).toBe(true);
  });

  it("rejects control characters but allows tab and newlines", () => {
    expect(containsControlCharacter(`確認${BELL}してください`)).toBe(true);
    expect(validateSourceText(`確認${BELL}してください`).isValid).toBe(false);
    expect(containsControlCharacter("一行目\n二行目\t終わり")).toBe(false);
    expect(validateSourceText("一行目\n二行目").isValid).toBe(true);
  });
});

describe("isWithinLength", () => {
  it("compares code point counts against the given limit", () => {
    expect(isWithinLength("組立課", 50)).toBe(true);
    expect(isWithinLength("あ".repeat(51), 50)).toBe(false);
    expect(isWithinLength("", 100)).toBe(true);
  });
});
