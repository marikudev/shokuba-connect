import { ApiError } from "@/lib/errors";
import type {
  LlmClient,
  LlmTranslateRequest,
  LlmTranslateResult,
} from "@/lib/llm/types";

// Deterministic fake client for development and tests (LLM_MODE=mock).
// It never touches the network. The output is deliberately obvious: the
// source text echoed back per language with a [MOCK <code>] prefix, so
// nobody can mistake it for a real translation (the UI shows a badge too).
//
// Error simulation triggers (PRD section 14; only ever active here):
//   text contains "#timeout" -> throws ApiError "timeout"
//   text contains "#429"     -> throws ApiError "rate_limited"
//   text contains "#badjson" -> returns an unparseable-result marker
export class MockLlmClient implements LlmClient {
  readonly model = "mock";
  readonly isMock = true;

  async translate(
    request: LlmTranslateRequest,
  ): Promise<LlmTranslateResult> {
    if (request.text.includes("#timeout")) {
      throw new ApiError("timeout");
    }
    if (request.text.includes("#429")) {
      throw new ApiError("rate_limited", 30);
    }
    if (request.text.includes("#badjson")) {
      return { translations: {}, uncertain: [], parseFailed: true };
    }
    const translations: LlmTranslateResult["translations"] = {};
    for (const code of request.langs) {
      translations[code] = `[MOCK ${code}] ${request.text}`;
    }
    return { translations, uncertain: [], parseFailed: false };
  }
}
