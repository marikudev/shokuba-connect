import { afterEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_MODEL, getLlmClient } from "@/lib/llm/index";

// Model selection in lib/llm/index.ts: an explicit allowlisted choice
// wins; OPENROUTER_MODEL is only the fallback, and since the
//  audit fix the fallback is held to the same allowlist —
// a stale env value naming a removed model falls back to the
// default instead of silently becoming the serving model.
describe("getLlmClient model selection", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("honors an allowlisted OPENROUTER_MODEL fallback", () => {
    vi.stubEnv("LLM_MODE", "");
    vi.stubEnv("OPENROUTER_MODEL", "openai/gpt-6-luna");
    const client = getLlmClient();
    expect(client.isMock).toBe(false);
    expect(client.model).toBe("openai/gpt-6-luna");
  });

  it("ignores a stale OPENROUTER_MODEL naming a removed model", () => {
    vi.stubEnv("LLM_MODE", "");
    vi.stubEnv("OPENROUTER_MODEL", "google/gemma-3-27b-it");
    expect(getLlmClient().model).toBe(DEFAULT_MODEL);
    expect(DEFAULT_MODEL).toBe("google/gemma-4-31b-it");
  });

  it("prefers an explicit allowlisted override over the env", () => {
    vi.stubEnv("LLM_MODE", "");
    vi.stubEnv("OPENROUTER_MODEL", "google/gemma-4-31b-it");
    expect(getLlmClient("openai/gpt-6-luna").model).toBe(
      "openai/gpt-6-luna",
    );
  });
});
