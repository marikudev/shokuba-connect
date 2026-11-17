import { describe, expect, it } from "vitest";

import {
  pickVoice,
  speechLocale,
  splitSpeechChunks,
  type VoiceLike,
} from "@/lib/tts";

// The pure speech decisions. Playback itself is
// covered by the SpeakButton component tests; here only which voice
// fits a language and how a text is cut into speakable chunks.
const voice = (
  name: string,
  lang: string,
  localService = false,
): VoiceLike => ({ name, lang, localService });

describe("speechLocale", () => {
  it("maps each language code to its BCP-47 tag", () => {
    expect(speechLocale("id")).toBe("id-ID");
    expect(speechLocale("my")).toBe("my-MM");
    expect(speechLocale("pt")).toBe("pt-BR");
    expect(speechLocale("en")).toBe("en-US");
    expect(speechLocale("vi")).toBe("vi-VN");
  });
});

describe("pickVoice", () => {
  it("returns null when the device has no voice for the language", () => {
    expect(pickVoice([voice("Microsoft Ayumi", "ja-JP", true)], "my")).toBeNull();
    expect(pickVoice([], "id")).toBeNull();
  });

  it("prefers the exact locale over another region of the language", () => {
    const ptPortugal = voice("Microsoft Maria", "pt-PT", true);
    const ptBrazil = voice("Google Português do Brasil", "pt-BR");
    expect(pickVoice([ptPortugal, ptBrazil], "pt")).toBe(ptBrazil);
  });

  it("prefers a neural Natural/Online voice over a plain local one", () => {
    const local = voice("Myanmar Local Voice", "my-MM", true);
    const edge = voice(
      "Microsoft Nilar Online (Natural) - Burmese (Myanmar)",
      "my-MM",
    );
    expect(pickVoice([local, edge], "my")).toBe(edge);
  });

  it("accepts a bare-language voice and normalizes case/underscores", () => {
    const bare = voice("Indonesian Voice", "ID");
    expect(pickVoice([bare], "id")).toBe(bare);
    const underscored = voice("Vietnamese Voice", "vi_VN", true);
    expect(pickVoice([underscored], "vi")).toBe(underscored);
  });
});

describe("splitSpeechChunks", () => {
  it("splits on Latin sentence terminators and keeps them attached", () => {
    expect(splitSpeechChunks("Satu. Dua! Tiga?")).toEqual([
      "Satu.",
      "Dua!",
      "Tiga?",
    ]);
  });

  it("splits Burmese on its own sentence ender", () => {
    expect(splitSpeechChunks("ပထမစာကြောင်း။ ဒုတိယစာကြောင်း။")).toEqual([
      "ပထမစာကြောင်း။",
      "ဒုတိယစာကြောင်း။",
    ]);
  });

  it("splits on newlines and drops empty pieces", () => {
    expect(splitSpeechChunks("Baris satu\n\nBaris dua")).toEqual([
      "Baris satu",
      "Baris dua",
    ]);
    expect(splitSpeechChunks("   ")).toEqual([]);
    expect(splitSpeechChunks("")).toEqual([]);
  });

  it("cuts an over-long sentence at a word boundary when one exists", () => {
    expect(splitSpeechChunks("aaa bbb ccc ddd", 7)).toEqual([
      "aaa bbb",
      "ccc ddd",
    ]);
  });

  it("hard-cuts an over-long run with no usable break", () => {
    expect(splitSpeechChunks("abcdefghij", 4)).toEqual(["abcd", "efgh", "ij"]);
  });
});
