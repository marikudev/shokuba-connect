// Pure client-side validation for the UI.
// This is a UX aid only; the server re-validates everything (SEC-03).

export const MAX_TEXT_LENGTH = 300;
export const MAX_DIVISION_LENGTH = 50;
export const MAX_TOPIC_LENGTH = 100;

// Character classes are written as numeric code point ranges so this file
// stays plain ASCII and every range can be checked at a glance.

// Japanese letters, per : hiragana,
// katakana, kanji, plus the kanji iteration mark U+3005. Factory
// announcements also use the Latin alphabet heavily, so text without any
// Japanese letter is only reported through `hasJapaneseLetter` and does
// NOT make the input invalid (and never disables the translate button by
// itself).
const JAPANESE_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x3040, 0x309f], // hiragana
  [0x30a0, 0x30ff], // katakana
  [0x3400, 0x4dbf], // kanji (CJK Extension A)
  [0x4e00, 0x9fff], // kanji (CJK Unified Ideographs)
  [0x3005, 0x3005], // kanji iteration mark
];

// Control characters other than tab (0x09), newline (0x0A), and carriage
// return (0x0D).
const CONTROL_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x0000, 0x0008],
  [0x000b, 0x000b],
  [0x000c, 0x000c],
  [0x000e, 0x001f],
  [0x007f, 0x007f],
];

function containsCodePointInRanges(
  text: string,
  ranges: ReadonlyArray<readonly [number, number]>,
): boolean {
  for (const character of text) {
    const codePoint = character.codePointAt(0);
    if (codePoint === undefined) {
      continue;
    }
    for (const [low, high] of ranges) {
      if (codePoint >= low && codePoint <= high) {
        return true;
      }
    }
  }
  return false;
}

export function countCharacters(text: string): number {
  return Array.from(text).length;
}

export function containsJapaneseLetter(text: string): boolean {
  return containsCodePointInRanges(text, JAPANESE_RANGES);
}

export function containsControlCharacter(text: string): boolean {
  return containsCodePointInRanges(text, CONTROL_RANGES);
}

// Removes exactly the characters `containsControlCharacter` reports
// (tab, newline, and carriage return are kept). Used by the prompt
// builder's sanitization (PRD section 9).
export function stripControlCharacters(text: string): string {
  let result = "";
  for (const character of text) {
    const codePoint = character.codePointAt(0);
    if (codePoint === undefined) {
      continue;
    }
    const isControl = CONTROL_RANGES.some(
      ([low, high]) => codePoint >= low && codePoint <= high,
    );
    if (!isControl) {
      result += character;
    }
  }
  return result;
}

export interface SourceTextValidation {
  charCount: number;
  isEmpty: boolean;
  isOverLimit: boolean;
  hasJapaneseLetter: boolean;
  hasControlCharacter: boolean;
  isValid: boolean;
}

export function validateSourceText(text: string): SourceTextValidation {
  const charCount = countCharacters(text);
  const isEmpty = charCount === 0;
  const isOverLimit = charCount > MAX_TEXT_LENGTH;
  const hasControlCharacter = containsControlCharacter(text);
  return {
    charCount,
    isEmpty,
    isOverLimit,
    hasJapaneseLetter: containsJapaneseLetter(text),
    hasControlCharacter,
    // The text is never truncated automatically; over-limit input simply
    // keeps the translate button disabled.
    isValid: !isEmpty && !isOverLimit && !hasControlCharacter,
  };
}

export function isWithinLength(text: string, maxLength: number): boolean {
  return countCharacters(text) <= maxLength;
}
