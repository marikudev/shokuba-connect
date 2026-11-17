import type { LanguageCode } from "@/lib/languages";

// Deterministic post-translation checks (PRD section 11). These
// checks only ever raise a warning for a human to review; none of
// them can state that a translation is correct.

// Number check: full-width digits and Burmese digits are
// normalized to ASCII, thousands separators between digits are
// removed, leading zeros are ignored, and the multiset of numbers
// is compared between source and translation. Simple kanji
// numerals in the source are read as numbers too (see
// extractKanjiNumbers). A 1–12 directly before 月
// is a month name, not a quantity, and is not counted on either
// side. Remaining known limitation: numbers written as words in a
// target language ("tiga", "three") are not detected, and kanji
// numerals inside idioms can still raise a suspicion warning.

// Kanji numeral reading . A maximal run of numeral
// characters is converted with the standard positional rules
// (三十 = 30, 二千五百 = 2500, 一万 = 10000). Two guards keep
// non-quantity words out:
//   - a run containing a unit (十百千万) is always a quantity;
//   - a lone single digit counts only when a counter/unit character
//     follows it (三台, 一人, 五分) — so 一緒 (together) or 一番
//     (number one / most) never produce a phantom "1".
// Runs containing 〇/零 and no unit are read digit by digit, the way
// years are written (二〇二六年 = 2026), and only from three
// characters up. A run starting with 万 is not a valid numeral
// (万一 is an idiom, "if by any chance") and is skipped.
const KANJI_DIGIT_VALUES: Record<string, number> = {
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  零: 0,
  〇: 0,
};
const KANJI_UNIT_VALUES: Record<string, number> = {
  十: 10,
  百: 100,
  千: 1000,
};
const KANJI_NUMERAL_CHARS = "一二三四五六七八九十百千万零〇";
const KANJI_RUN_PATTERN = new RegExp(`[${KANJI_NUMERAL_CHARS}]+`, "g");
const KANJI_COUNTER_CHARS = new Set([
  "台",
  "人",
  "個",
  "本",
  "枚",
  "件",
  "回",
  "分",
  "時",
  "秒",
  "日",
  "年",
  "歳",
  "点",
  "箱",
  "袋",
  "組",
]);

function kanjiRunValue(run: string): number {
  let total = 0;
  let section = 0;
  let digit = 0;
  for (const ch of run) {
    if (ch in KANJI_DIGIT_VALUES) {
      digit = KANJI_DIGIT_VALUES[ch];
    } else if (ch in KANJI_UNIT_VALUES) {
      section += (digit === 0 ? 1 : digit) * KANJI_UNIT_VALUES[ch];
      digit = 0;
    } else if (ch === "万") {
      section += digit;
      total += (section === 0 ? 1 : section) * 10000;
      section = 0;
      digit = 0;
    }
  }
  return total + section + digit;
}

export function extractKanjiNumbers(text: string): string[] {
  const values: string[] = [];
  for (const match of text.matchAll(KANJI_RUN_PATTERN)) {
    const run = match[0];
    if (run.startsWith("万")) {
      continue;
    }
    const hasUnit = /[十百千]/.test(run) || run.includes("万");
    const hasZero = run.includes("零") || run.includes("〇");
    if (hasZero && !hasUnit) {
      // Year-style digit-by-digit writing (二〇二六): only from
      // three characters, so stray pairs never become a number.
      if (run.length >= 3) {
        values.push(
          [...run].map((ch) => String(KANJI_DIGIT_VALUES[ch])).join(""),
        );
      }
      continue;
    }
    if (hasUnit) {
      const value = kanjiRunValue(run);
      // A 1–12 directly before 月 is a month name (十一月 = November),
      // not a quantity; translations render it as a month word with
      // no digits, so counting it only raised phantom warnings
      // . The day in the same date (五日) is
      // still read and checked.
      const after = text[(match.index ?? 0) + run.length];
      if (after === "月" && value >= 1 && value <= 12) {
        continue;
      }
      values.push(String(value));
      continue;
    }
    if (run.length === 1 && run in KANJI_DIGIT_VALUES) {
      const next = text[(match.index ?? 0) + run.length];
      if (next !== undefined && KANJI_COUNTER_CHARS.has(next)) {
        values.push(String(KANJI_DIGIT_VALUES[run]));
      }
    }
  }
  return values;
}

// Canonical form for comparison: leading zeros carry no value
// ("07" and "7" are the same number; "000" is "0").
function canonicalDigits(raw: string): string {
  return raw.replace(/^0+(?=\d)/, "");
}

export function extractNumbers(text: string): string[] {
  const normalized = text
    .replace(/[０-９]/g, (ch) =>
      String.fromCharCode(ch.charCodeAt(0) - 0xfee0),
    )
    .replace(/[၀-၉]/g, (ch) =>
      String.fromCharCode(0x30 + (ch.charCodeAt(0) - 0x1040)),
    );
  // Only thousands separators are removed: a "." or "," between
  // digits counts as one only when it groups thousands, i.e. it is
  // followed by exactly three digits that do not continue into a
  // fourth ("1.000" -> "1000"). Clock times and decimals stay split
  // into their parts ("07.30" -> "07", "30"; "2.5" -> "2", "5") —
  // the same split the Japanese source uses (7時30分) and the same
  // on both sides, so they compare equal. The earlier rule removed
  // every separator and merged "07.30" into a phantom "0730", which
  // raised false number-check warnings on meeting times, the most common
  // numbers in chourei announcements .
  const collapsed = normalized.replace(/(\d)[.,](?=\d{3}(?!\d))/g, "$1");
  const digits: string[] = [];
  for (const match of collapsed.matchAll(/\d+/g)) {
    const raw = match[0];
    const value = canonicalDigits(raw);
    // A 1–12 directly before 月 is a month name (12月 = December),
    // not a quantity; see the kanji reader for the same rule.
    const after = collapsed[(match.index ?? 0) + raw.length];
    const numeric = Number(value);
    if (after === "月" && numeric >= 1 && numeric <= 12) {
      continue;
    }
    digits.push(value);
  }
  return [...digits, ...extractKanjiNumbers(text)];
}

export function hasNumberMismatch(
  sourceText: string,
  translatedText: string,
): boolean {
  const source = extractNumbers(sourceText).sort();
  const translated = extractNumbers(translatedText).sort();
  if (source.length !== translated.length) {
    return true;
  }
  return source.some((value, index) => value !== translated[index]);
}

// Prohibition check: the source is flagged when it contains
// any of these prohibition expressions, so a native speaker can verify
// the translation kept the prohibition intact.
const PROHIBITION_PATTERNS = [
  "禁止",
  "てはいけません",
  "てはならない",
  "ないでください",
  "ないこと",
  "厳禁",
  "不可",
] as const;

export function hasProhibition(sourceText: string): boolean {
  return PROHIBITION_PATTERNS.some((pattern) =>
    sourceText.includes(pattern),
  );
}

// Target-side prohibition check : when the
// source carries a prohibition, each translation must still carry a
// prohibition marker in its own language; if none is found, the
// panel warns that the prohibition may have been lost or softened.
// Like every check here this is a suspicion signal, never a verdict —
// a language can phrase a prohibition in a form this small list does
// not know, Burmese in particular (its list is the minimum and has
// not been validated by a native speaker; note the marker "မရ" also
// matches the common "မရှိ" — "does not exist" — form, which makes
// the Burmese check the most lenient of the seven).
//
// The Filipino and Chinese lists (added 
// are in the same honesty class as the Burmese list: MINIMAL,
// high-precision everyday prohibition forms, NOT yet validated by
// a native speaker. They were kept deliberately short — a marker
// that also fires on ordinary sentences would train operators to
// ignore the warning. Native-speaker review of both lists is an
// open follow-up, exactly as it is for Burmese.
const PROHIBITION_MARKERS: Record<LanguageCode, readonly string[]> = {
  id: ["jangan", "dilarang", "tidak boleh", "tak boleh", "terlarang"],
  my: ["တားမြစ်", "မရ", "မလုပ်"],
  pt: ["não", "nunca", "proibid", "jamais"],
  en: [
    "do not",
    "don't",
    "never",
    "must not",
    "mustn't",
    "prohibited",
    "forbidden",
    "not allowed",
  ],
  vi: ["không được", "cấm", "đừng"],
  // huwag = "do not" (imperative); bawal / ipinagbabawal =
  // "prohibited / it is forbidden".
  fil: ["huwag", "bawal", "ipinagbabawal"],
  // 禁止 = prohibited; 不要 = do not; 不得 = must not;
  // 严禁 = strictly forbidden; 不可 = must not (written warnings).
  zh: ["禁止", "不要", "不得", "严禁", "不可"],
};

export function hasProhibitionMarker(
  translatedText: string,
  code: LanguageCode,
): boolean {
  const haystack = translatedText.toLowerCase();
  return PROHIBITION_MARKERS[code].some((marker) =>
    haystack.includes(marker),
  );
}

export function isProhibitionMissing(
  sourceText: string,
  translatedText: string,
  code: LanguageCode,
): boolean {
  return (
    hasProhibition(sourceText) &&
    !hasProhibitionMarker(translatedText, code)
  );
}
