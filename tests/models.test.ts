import { describe, expect, it } from "vitest";

import {
  DEFAULT_LLM_MODEL,
  getLlmModel,
  isLlmModelId,
  LLM_MODELS,
} from "@/lib/models";

// The model list: google/gemma-4-31b-it is the default,
// openai/gpt-6-luna is the second choice, and the free
// Nemotron Ultra is the third.
describe("LLM model list", () => {
  it("has the two paid models and the free model, in order", () => {
    // Picker order: free model first, then
    // Gemma 4, then GPT-6 Luna (display order only).
    expect(LLM_MODELS.map((model) => model.id)).toEqual([
      "nvidia/nemotron-3-ultra-550b-a55b:free",
      "google/gemma-4-31b-it",
      "openai/gpt-6-luna",
    ]);
    expect(LLM_MODELS.map((model) => model.paid)).toEqual([
      false,
      true,
      true,
    ]);
    // Gemma 4 is the better-value choice and carries the flag the
    // picker renders as 割安; Luna keeps the plain paid mark.
    // (Indexed by id since the reorder.)
    expect(getLlmModel("google/gemma-4-31b-it")?.value).toBe(true);
    expect(getLlmModel("openai/gpt-6-luna")?.value).toBeUndefined();
  });

  it("carries the rich picker's display metadata", () => {
    expect(LLM_MODELS.map((model) => model.provider)).toEqual([
      "nvidia",
      "google",
      "openai",
    ]);
    expect(LLM_MODELS.map((model) => model.displayName)).toEqual([
      "Nemotron 3 Ultra 550B",
      "Gemma 4 31B",
      "GPT-6 Luna",
    ]);
    // Only GPT-6 Luna wears the おすすめ badge.
    expect(LLM_MODELS.map((model) => model.recommended === true)).toEqual([
      false,
      false,
      true,
    ]);;
    // Gemma carries its own icon; the others use their provider's.
    expect(getLlmModel("google/gemma-4-31b-it")?.icon).toBe("gemma");
  });

  it("keeps the paid models on the strict policy metadata", () => {
    for (const id of ["google/gemma-4-31b-it", "openai/gpt-6-luna"]) {
      const model = getLlmModel(id);
      // "deny" always sent, no language blocked, no reasoning
      // parameter.
      expect(model?.dataCollection).toBe("deny");
      expect(model?.unsupportedLanguages).toEqual([]);
      expect(model?.reasoningDisabled).toBe(false);
    }
  });

  it("records the free model's proven limitations as metadata", () => {
    const model = getLlmModel("nvidia/nemotron-3-ultra-550b-a55b:free");
    expect(model?.paid).toBe(false);
    // Its endpoint refuses "deny" (HTTP 404 in evaluation), so the
    // field is not sent for this model.
    expect(model?.dataCollection).toBe("allow");
    // Its Burmese output was garbled in evaluation: blocked, not warned.
    // Filipino is blocked too: its hazard vocabulary was
    // unstable across evaluation runs.
    expect(model?.unsupportedLanguages).toEqual(["my", "fil"]);
    // Default reasoning measured 10–48 s per request; disabled.
    expect(model?.reasoningDisabled).toBe(true);
    expect(getLlmModel("openai/gpt-4o")).toBeUndefined();
  });

  it("carries no per-model prompt addendum", () => {
    // No metadata field can switch a prompt addendum on:
    // every model is served the shared prompt alone, and only
    // the three allowlisted models resolve.
    for (const model of LLM_MODELS) {
      expect(model).not.toHaveProperty("uncertainSelfCheck");
    }
    expect(getLlmModel("openai/not-a-listed-model")).toBeUndefined();
  });

  it("defaults to the Gemma 4 model", () => {
    expect(DEFAULT_LLM_MODEL).toBe("google/gemma-4-31b-it");
  });

  it("accepts only allowlisted ids", () => {
    expect(isLlmModelId("openai/gpt-6-luna")).toBe(true);
    expect(isLlmModelId("google/gemma-4-31b-it")).toBe(true);
    // The one free model with evaluation evidence; every other
    // free route stays rejected.
    expect(isLlmModelId("nvidia/nemotron-3-ultra-550b-a55b:free")).toBe(true);
    // Retired models stay rejected, including the Luna generation
    // GPT-6 Luna replaced.
    expect(isLlmModelId("openai/not-a-listed-model")).toBe(false);
    expect(isLlmModelId("google/gemma-3-27b-it")).toBe(false);
    expect(isLlmModelId("google/gemma-4-31b-it:free")).toBe(false);
    expect(isLlmModelId("thinkingmachines/inkling:free")).toBe(false);
    expect(isLlmModelId("google/gemma-4-26b-a4b-it:free")).toBe(false);
    expect(isLlmModelId("openai/gpt-4o")).toBe(false);
    expect(isLlmModelId("")).toBe(false);
    expect(isLlmModelId(undefined)).toBe(false);
    expect(isLlmModelId(42)).toBe(false);
  });
});
