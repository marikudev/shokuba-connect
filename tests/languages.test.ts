import { describe, expect, it } from "vitest";

import { LANGUAGES, LANGUAGE_CODES, isLanguageCode } from "@/lib/languages";

describe("languages", () => {
  it("defines exactly the seven PRD language codes, in order", () => {
    expect(LANGUAGE_CODES).toEqual([
      "id",
      "my",
      "pt",
      "en",
      "vi",
      "fil",
      "zh",
    ]);
    expect(LANGUAGES).toHaveLength(7);
  });

  it("defines Filipino and Simplified Chinese with their tested values", () => {
    const fil = LANGUAGES.find((language) => language.code === "fil");
    expect(fil?.modelName).toBe("Filipino");
    expect(fil?.panelLabel).toBe("Filipino");
    expect(fil?.uiNameJa).toBe("タガログ語");
    expect(fil?.bcp47).toBe("fil-PH");
    const zh = LANGUAGES.find((language) => language.code === "zh");
    expect(zh?.modelName).toBe("Simplified Chinese");
    expect(zh?.panelLabel).toBe("中文");
    expect(zh?.uiNameJa).toBe("中国語");
    expect(zh?.bcp47).toBe("zh-CN");
  });

  it("accepts only codes from the list", () => {
    for (const code of LANGUAGE_CODES) {
      expect(isLanguageCode(code)).toBe(true);
    }
    for (const code of ["ja", "pt-BR", "en-US", "fr", "ID", ""]) {
      expect(isLanguageCode(code)).toBe(false);
    }
  });

  it("uses qualifier-free UI names but keeps regional model names ", () => {
    const pt = LANGUAGES.find((language) => language.code === "pt");
    const en = LANGUAGES.find((language) => language.code === "en");
    expect(pt?.uiNameJa).toBe("ポルトガル語");
    expect(pt?.panelLabel).toBe("Português");
    expect(pt?.modelName).toBe("Brazilian Portuguese");
    expect(en?.uiNameJa).toBe("英語");
    expect(en?.panelLabel).toBe("English");
    expect(en?.modelName).toBe("American English");
  });

  it("gives every language a model name, a panel label, and a Japanese UI name", () => {
    for (const language of LANGUAGES) {
      expect(language.modelName.length).toBeGreaterThan(0);
      expect(language.panelLabel.length).toBeGreaterThan(0);
      expect(language.uiNameJa.length).toBeGreaterThan(0);
    }
  });
});
