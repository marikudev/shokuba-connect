// The seven target languages are defined exactly once, in this file
// (PRD section 4). UI, validation, prompts, and the glossary all read
// from here; never hard-code a language list anywhere else.
// The exact values below (modelName, panelLabel, uiNameJa,
// bcp47) are the ones verified by the project's model
// evaluation; do not substitute synonyms or variants.
export const LANGUAGES = [
  {
    code: "id",
    modelName: "Indonesian",
    panelLabel: "Indonesia",
    uiNameJa: "インドネシア語",
    // BCP-47 tag for speech synthesis: the region matches
    // the modelName's precision.
    bcp47: "id-ID",
  },
  {
    code: "my",
    modelName: "Burmese (Myanmar)",
    panelLabel: "မြန်မာဘာသာ",
    uiNameJa: "ミャンマー語",
    bcp47: "my-MM",
  },
  {
    code: "pt",
    // modelName keeps the regional precision for the LLM; the UI
    // names dropped the qualifiers.
    modelName: "Brazilian Portuguese",
    panelLabel: "Português",
    uiNameJa: "ポルトガル語",
    bcp47: "pt-BR",
  },
  {
    code: "en",
    modelName: "American English",
    panelLabel: "English",
    uiNameJa: "英語",
    bcp47: "en-US",
  },
  {
    code: "vi",
    modelName: "Vietnamese",
    panelLabel: "Tiếng Việt",
    uiNameJa: "ベトナム語",
    bcp47: "vi-VN",
  },
  {
    code: "fil",
    modelName: "Filipino",
    panelLabel: "Filipino",
    uiNameJa: "タガログ語",
    bcp47: "fil-PH",
  },
  {
    code: "zh",
    // Simplified characters only (zh-CN), the variant verified
    // in evaluation and the variant mainland-Chinese trainees
    // in Japan read; Traditional is a separate decision.
    modelName: "Simplified Chinese",
    panelLabel: "中文",
    uiNameJa: "中国語",
    bcp47: "zh-CN",
  },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]["code"];

export const LANGUAGE_CODES: readonly LanguageCode[] = LANGUAGES.map(
  (language) => language.code,
);

// Language pickers in the UI show `uiNameJa`, because the operators are
// Japanese staff. `panelLabel` is the panel
// header label from PRD section 4; translation output itself always uses
// each language's own script and font (fonts: app/layout.tsx).
export function isLanguageCode(value: string): value is LanguageCode {
  return (LANGUAGE_CODES as readonly string[]).includes(value);
}

export function getLanguage(code: LanguageCode) {
  return LANGUAGES.find((language) => language.code === code);
}
