import { MockLlmClient } from "@/lib/llm/mock";
import { OpenRouterClient } from "@/lib/llm/openrouter";
import type { LlmClient } from "@/lib/llm/types";
import { isLlmModelId } from "@/lib/models";

// Client selection (PRD sections 7 and 8). LLM_MODE is "openrouter" by
// default; "mock" is for development and tests and is rejected in
// production (SEC-12), so the mock can never serve real traffic.
// The operator picks the model in the UI;
// the route validates the choice against lib/models.ts and passes it
// here. OPENROUTER_MODEL remains the fallback when no choice is sent,
// held to the same allowlist since the audit fix: a stale
// env value naming a removed model must not silently become the
// serving model — the default takes over instead.
//
// BYOK : there is no app-owned OpenRouter key anymore.
// The caller passes the USER's key from the request (cookie or
// header, lib/auth-guard.ts) and the client is built with it; the
// key is used for that request and never stored or logged. Mock
// mode ignores the key entirely.
export const DEFAULT_MODEL = "google/gemma-4-31b-it";

export function isMockMode(): boolean {
  return process.env.LLM_MODE === "mock";
}

// The model that will actually serve a request: the caller's
// allowlisted choice, else the allowlisted OPENROUTER_MODEL env
// value, else the built-in default. Exported so the translate route
// can judge a request against the serving model's metadata before
// any call is made (a language the model does not support is
// rejected up front).
export function resolveEffectiveModelId(modelOverride?: string): string {
  const envModel = process.env.OPENROUTER_MODEL;
  return modelOverride && isLlmModelId(modelOverride)
    ? modelOverride
    : envModel && isLlmModelId(envModel)
      ? envModel
      : DEFAULT_MODEL;
}

export function getLlmClient(modelOverride?: string, apiKey?: string): LlmClient {
  if (isMockMode()) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("LLM_MODE=mock is not allowed in production");
    }
    return new MockLlmClient();
  }
  return new OpenRouterClient({
    apiKey: apiKey ?? "",
    model: resolveEffectiveModelId(modelOverride),
  });
}
