import type { LanguageCode } from "@/lib/languages";

// Selectable LLM models. This list is
// the single definition used by both the UI dropdown and the
// server-side allowlist for POST /api/translate.
//
// Two paid models:
// - google/gemma-4-31b-it — the default and the better-value
//   choice ($0.10 / $0.34 per 1M tokens).
// - openai/gpt-6-luna — the second choice ($0.10 / $0.50 per
//   1M tokens). It is a reasoning model used as-is: the app
//   sends no reasoning parameter for any paid model, so its
//   default reasoning applies.
//
// One free model:
// - nvidia/nemotron-3-ultra-550b-a55b:free — a no-cost option
//   for operators who explicitly accept that their text may be
//   used for training. Its per-model metadata below records the
//   limitations the app must honour: its only endpoint refuses
//   data_collection "deny" with HTTP 404 (so the field is not
//   sent for it), and its Burmese and Filipino output is not
//   reliable — both languages are BLOCKED for it, never merely
//   warned about.
//
// Every model receives the same system prompt, byte-identical;
// no per-model prompt addendum exists.
export interface LlmModelOption {
  id: string;
  paid: boolean;
  // The better-value choice, marked （有料・割安） in the picker so a
  // lay operator can see it costs less than the other paid model.
  value?: boolean;
  // Picker display: the provider drives
  // the logo shown next to the model, displayName is the friendly
  // name the picker lists (the slug stays visible as small print),
  // and recommended drives the おすすめ badge (no model wears it
  // model). An optional one-line description under a model's name
  // lives in lib/i18n/ja.ts (modelPickerNotes, keyed by model id)
  // like every other UI sentence.
  provider: "google" | "openai" | "nvidia";
  displayName: string;
  // Optional picker-icon override: the file stem in
  // public/logos/ when the model's own mark differs from its
  // provider's — Gemma shows its own star (gemma-icon.svg), not
  // Google's "G". Absent = the provider's icon.
  icon?: string;
  recommended?: boolean;
  // The picker shows a 推論 (reasoning) chip for this model
  // : set for GPT-6 Luna, whose reasoning tokens were
  // measured throughout the review. (The free model's
  // reasoning is deliberately disabled by this app, and Gemma 4
  // carries no chip —  named Luna's row.)
  reasoning?: boolean;
  // Data policy for requests to this model. "deny": the request
  // carries provider.data_collection "deny", so the provider may
  // neither keep the text nor train on it — the rule for every paid
  // model. "allow": the field is not sent at all and the provider
  // may train on the text; only for a model whose endpoints refuse
  // "deny" (proven in evaluation) and only ever together with the
  // always-visible warning on the main screen.
  dataCollection: "deny" | "allow";
  // Languages this model failed evaluation for. They are never
  // translated with it: the picker disables them, a panel set to
  // one shows a blocking notice instead of a translate action, and
  // the server rejects a request that still contains one.
  unsupportedLanguages: readonly LanguageCode[];
  // Send reasoning {enabled:false} with every request. Only for
  // the free model: its default reasoning measured 10–48 seconds
  // per request in testing, versus about 1.4 seconds disabled.
  // The paid models never get a reasoning parameter (both Luna
  // generations are used as-is, the standing decision).
  reasoningDisabled: boolean;
}

export const LLM_MODELS: readonly LlmModelOption[] = [
  // Picker order : the free
  // model first, then Gemma 4, then GPT-6 Luna. This order is
  // display only — the server fallback below stays pinned to
  // Gemma 4 explicitly and must not follow the array.
  {
    id: "nvidia/nemotron-3-ultra-550b-a55b:free",
    provider: "nvidia",
    displayName: "Nemotron 3 Ultra 550B",
    paid: false,
    dataCollection: "allow",
    // Burmese is blocked: its output was garbled in evaluation.
    // Filipino is blocked too: its hazard
    // vocabulary was unstable across evaluation runs (挟む rendered as
    // "masugatan" = injured, then "masaksak" = stabbed, where the
    // paid models consistently produce "maipit" = pinched). The
    // block is revisited only after a verified glossary exists and
    // a with/without-glossary test on those terms passes.
    unsupportedLanguages: ["my", "fil"],
    reasoningDisabled: true,
  },
  {
    id: "google/gemma-4-31b-it",
    provider: "google",
    displayName: "Gemma 4 31B",
    icon: "gemma",
    paid: true,
    value: true,
    dataCollection: "deny",
    unsupportedLanguages: [],
    reasoningDisabled: false,
  },
  {
    id: "openai/gpt-6-luna",
    provider: "openai",
    displayName: "GPT-6 Luna",
    recommended: true,
    reasoning: true,
    paid: true,
    dataCollection: "deny",
    unsupportedLanguages: [],
    reasoningDisabled: false,
  },
];

// The picker starts with NO model selected (the operator
// must choose before anything can be translated), so this
// constant is not a UI default. It is the server-side
// fallback used when a request carries no model choice
// (lib/llm/index.ts validates the OPENROUTER_MODEL env value against
// the allowlist and falls back to this id) and the eval script's
// model.
// Pinned by id, NOT taken from the array: the picker's display
// order changed (free model first), and the
// fallback must remain Gemma 4 regardless.
export const DEFAULT_LLM_MODEL: string = "google/gemma-4-31b-it";

export function isLlmModelId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    LLM_MODELS.some((model) => model.id === value)
  );
}

// The full option for an allowlisted id, or undefined for anything
// else. This is how the LLM client, the page, and the translate
// route read a model's data policy, unsupported languages, and
// reasoning behaviour — the metadata above is the single source,
// so no caller hard-codes a per-model special case.
export function getLlmModel(id: string): LlmModelOption | undefined {
  return LLM_MODELS.find((model) => model.id === id);
}
