import { ja } from "@/lib/i18n/ja";

// Japanese-only guard for "uncertain" entries.
//
// Rule 9 of the system prompt requires every uncertain entry to be
// written entirely in Japanese, because the only reader is the
// Japanese operator. In live use, both GPT-6 Luna and the free
// Nemotron Ultra returned entries written in Simplified Chinese
// when Chinese was one of the target languages: the quoted source term was
// Japanese, but the explanation — the part the operator actually
// needs — was Chinese, which the operator cannot read. A prompt
// rule alone cannot guarantee the language, so this module is the
// deterministic backstop, applied where model output is parsed
// (lib/llm/openrouter.ts, parseModelContent).
//
// Detection uses the same kana heuristic the ambiguity-battery
// scoring used: a genuine Japanese explanatory sentence always
// contains hiragana or katakana, while a Chinese (or English, or
// any other target-language) entry contains none. An entry with no
// kana is therefore treated as not Japanese. Kanji-only Japanese
// fragments are not plausible full entries — rule 9 requires a
// sentence stating what to confirm — so the false-positive risk is
// accepted and documented here.
//
// A non-Japanese entry is never shown to the operator and never
// silently dropped either (dropping would erase the flag itself,
// the audit lesson). It is replaced by a Japanese
// fallback entry that preserves the one part that is still
// usable — the source phrase the model quoted in 「…」 or 『…』 —
// and tells the operator that this part of the source needs
// confirming. The model's foreign-language explanation itself is
// unrecoverable for the operator; that loss is the model's rule
// violation, and the fallback says so honestly.

const KANA_PATTERN = /[ぁ-んァ-ヶー]/;

// True when the entry looks like a Japanese sentence (contains at
// least one hiragana or katakana character).
export function isJapaneseUncertainEntry(text: string): boolean {
  return KANA_PATTERN.test(text);
}

// The first source phrase the model quoted with 「…」 or 『…』,
// trimmed and capped, or null when the entry quotes nothing usable.
export function extractQuotedPhrase(text: string): string | null {
  const match = text.match(/[「『]([^」』]{1,60})[」』]/);
  if (!match) {
    return null;
  }
  const phrase = match[1].trim();
  return phrase === "" ? null : phrase;
}

// Builds the Japanese fallback entry for one non-Japanese entry.
export function fallbackUncertainEntry(original: string): string {
  const phrase = extractQuotedPhrase(original);
  return phrase === null
    ? ja.uncertainForeignGeneric
    : ja.uncertainForeignWithPhrase.replace("{phrase}", phrase);
}

// Maps a raw uncertain list to what the operator may see: Japanese
// entries pass through unchanged, every other entry becomes its
// Japanese fallback, and identical fallbacks are de-duplicated
// (two foreign entries about the same quoted phrase carry one
// message, not two).
export function sanitizeUncertainEntries(entries: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const entry of entries) {
    const kept = isJapaneseUncertainEntry(entry)
      ? entry
      : fallbackUncertainEntry(entry);
    if (!seen.has(kept)) {
      seen.add(kept);
      result.push(kept);
    }
  }
  return result;
}
