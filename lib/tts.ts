import { getLanguage, type LanguageCode } from "@/lib/languages";

// Text-to-speech decisions. Speech runs
// entirely in the browser through
// the Web Speech API: no server call, no API key, no cost, and the
// BYOK design is untouched — the app borrows a voice the operator's
// own device already has. This module holds the pure decisions
// (which installed voice fits a language, how to cut a text into
// speakable chunks); the playback itself lives in
// components/tts-player.ts.

// The slice of a SpeechSynthesisVoice the decisions need, so tests
// can pass plain objects.
export interface VoiceLike {
  name: string;
  lang: string;
  localService: boolean;
}

// The BCP-47 tag speech for this language should claim, from the
// single language table (lib/languages.ts).
export function speechLocale(code: LanguageCode): string {
  return getLanguage(code)?.bcp47 ?? code;
}

function normalizeLang(tag: string): string {
  return tag.toLowerCase().replace(/_/g, "-");
}

// Picks the best installed voice for a language, or null when the
// device has none — the caller then shows no speak button for that
// panel at all, rather than a button that would read Burmese text
// with, say, a Japanese voice. Preference, strongest first: an
// exact locale match (my-MM for Burmese) over a same-language other
// region; a "Natural"/"Online" neural voice over a plain one; an
// on-device voice over a network one (network voices in Chrome are
// known to stall mid-utterance, which the sentence chunking below
// only partly mitigates).
export function pickVoice<T extends VoiceLike>(
  voices: readonly T[],
  code: LanguageCode,
): T | null {
  const target = normalizeLang(speechLocale(code));
  const primary = target.split("-")[0];
  const candidates = voices.filter((voice) => {
    const lang = normalizeLang(voice.lang);
    return lang === target || lang === primary || lang.startsWith(`${primary}-`);
  });
  if (candidates.length === 0) {
    return null;
  }
  const score = (voice: T): number => {
    let value = 0;
    if (normalizeLang(voice.lang) === target) {
      value += 4;
    }
    if (/natural|online/i.test(voice.name)) {
      value += 2;
    }
    if (voice.localService) {
      value += 1;
    }
    return value;
  };
  return [...candidates].sort((a, b) => score(b) - score(a))[0] ?? null;
}

// Cuts a translation into sentence-sized chunks, because speech is
// queued chunk by chunk: network voices in Chrome go silent after
// roughly 15 seconds of continuous speech, and a chourei text read
// sentence by sentence never gets near that. Terminators: the Latin
// ".", "!", "?" (also fullwidth), the Japanese "。", and the
// Burmese sentence ender "။" (U+104B). A single over-long sentence
// is cut at the last space before the limit, or hard-cut when there
// is no usable break (Burmese phrases can run long without spaces).
export function splitSpeechChunks(text: string, maxChars = 180): string[] {
  const pieces = text
    .split(/(?<=[.!?。！？။])\s+|\n+/u)
    .map((piece) => piece.trim())
    .filter((piece) => piece !== "");
  const chunks: string[] = [];
  for (const piece of pieces) {
    let rest = piece;
    while (rest.length > maxChars) {
      let cut = rest.lastIndexOf(" ", maxChars);
      if (cut < maxChars * 0.4) {
        cut = maxChars;
      }
      chunks.push(rest.slice(0, cut).trim());
      rest = rest.slice(cut).trim();
    }
    if (rest !== "") {
      chunks.push(rest);
    }
  }
  return chunks.filter((chunk) => chunk !== "");
}
