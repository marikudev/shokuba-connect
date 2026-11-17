import { ApiError } from "@/lib/errors";
import { isLanguageCode, type LanguageCode } from "@/lib/languages";
import { getLlmModel, type LlmModelOption } from "@/lib/models";
import { buildSystemPrompt, buildUserMessage } from "@/lib/prompt";
import { sanitizeUncertainEntries } from "@/lib/uncertain";
import type {
  LlmClient,
  LlmTranslateRequest,
  LlmTranslateResult,
} from "@/lib/llm/types";

// OpenRouter client (PRD section 8). One request per translate call, no
// automatic retries. Parameter decisions, measured in the
// project's model evaluation:
// - max_tokens starts at 4000 (the largest observed completion
//   across the evaluation runs was 663 tokens including
//   reasoning — ample headroom).
// - provider.data_collection follows the model's metadata
//   (lib/models.ts): "deny" for the paid models — every evaluation deny probe
//   was served for every paid model, so the privacy rule costs
//   no availability. The free model is the single exception:
//   its only endpoint answers "deny" with HTTP 404, so for it
//   the field is not sent at all.
// - reasoning parameter: none for the paid models — the Gemma models
//   burn 0 reasoning tokens, and Luna's default reasoning applies
//   as-is. The free model is sent with
//   reasoning {enabled:false} (also per its metadata): its default
//   reasoning measured 10–48 seconds per request in testing.
// response_format json_object is part of the PRD section 8 request body.

export const OPENROUTER_CHAT_URL =
  "https://openrouter.ai/api/v1/chat/completions";
export const MAX_TOKENS = 4000;
export const TEMPERATURE = 0.1;
export const LLM_TIMEOUT_MS = 100_000;

const MAX_TRANSLATION_CODE_POINTS = 3000;
const MAX_UNCERTAIN_ITEMS = 5;
const MAX_UNCERTAIN_CODE_POINTS = 200;

function codePointLength(text: string): number {
  return Array.from(text).length;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

// Extracts and validates the model's JSON reply (PRD section 9): take
// the first JSON object in the text (code fences or extra prose around
// it are tolerated), keep only requested languages with a non-empty
// string of at most 3000 code points, and cap the uncertain list at
// five entries, each truncated to 200 code points.
export function parseModelContent(
  content: string,
  langs: readonly LanguageCode[],
): LlmTranslateResult {
  const failed: LlmTranslateResult = {
    translations: {},
    uncertain: [],
    parseFailed: true,
  };
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start < 0 || end <= start) {
    return failed;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(content.slice(start, end + 1));
  } catch {
    return failed;
  }
  if (!isRecord(parsed) || !isRecord(parsed.translations)) {
    return failed;
  }
  const translations: Partial<Record<LanguageCode, string>> = {};
  for (const code of langs) {
    const value = parsed.translations[code];
    if (typeof value !== "string") {
      continue;
    }
    const trimmed = value.trim();
    if (
      trimmed !== "" &&
      codePointLength(trimmed) <= MAX_TRANSLATION_CODE_POINTS
    ) {
      translations[code] = trimmed;
    }
  }
  const uncertain: string[] = [];
  if (Array.isArray(parsed.uncertain)) {
    for (const item of parsed.uncertain) {
      if (typeof item !== "string") {
        continue;
      }
      const trimmed = item.trim();
      if (trimmed !== "") {
        // An over-long entry is truncated to the cap, never dropped:
        // dropping it would silently erase an ambiguity flag the
        // operator is supposed to see .
        uncertain.push(
          Array.from(trimmed)
            .slice(0, MAX_UNCERTAIN_CODE_POINTS)
            .join(""),
        );
      }
      if (uncertain.length >= MAX_UNCERTAIN_ITEMS) {
        break;
      }
    }
  }
  // Japanese-only guard: an entry the model wrote in
  // a target language instead of Japanese (rule 9 violation, seen
  // live with Chinese entries) is replaced by a Japanese fallback
  // before it can reach the operator — see lib/uncertain.ts.
  return {
    translations,
    uncertain: sanitizeUncertainEntries(uncertain),
    parseFailed: false,
  };
}

// Maps an OpenRouter failure (HTTP status or an error code inside a 200
// body) to the app taxonomy (PRD section 8). The raw provider message is
// never surfaced to the client and never logged with user text (SEC-06).
function mapOpenRouterError(
  status: number,
  retryAfterHeader: string | null,
  modelId: string,
): ApiError {
  switch (status) {
    case 404:
      // For the free model, a 404 is how its endpoint says
      // "no provider will serve this key": the key owner's own
      // OpenRouter account data policy can refuse the free endpoint
      // even though the app itself sends no "deny" for this model.
      // That is a configuration the operator can fix, so it gets
      // its own error. Any other model's 404 stays a plain failure.
      return new ApiError(
        getLlmModel(modelId)?.paid === false
          ? "model_unavailable"
          : "llm_failed",
      );
    case 402:
      return new ApiError("credits_or_quota");
    case 429: {
      const seconds =
        retryAfterHeader === null ? Number.NaN : Number(retryAfterHeader);
      return new ApiError(
        "rate_limited",
        Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : null,
      );
    }
    case 408:
    case 504:
      return new ApiError("timeout");
    case 401:
    case 403:
      // The session's own key is invalid or revoked (BYOK, ):
      // reported as unauthorized so the client ends the session and
      // returns to the key gate instead of retrying a dead key.
      return new ApiError("unauthorized");
    default:
      // 502, 503, and anything unexpected are reported as llm_failed.
      return new ApiError("llm_failed");
  }
}

export interface OpenRouterClientOptions {
  apiKey: string;
  model: string;
  timeoutMs?: number;
}

export class OpenRouterClient implements LlmClient {
  readonly isMock = false;
  readonly model: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;

  constructor(options: OpenRouterClientOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model;
    this.timeoutMs = options.timeoutMs ?? LLM_TIMEOUT_MS;
  }

  async translate(
    request: LlmTranslateRequest,
  ): Promise<LlmTranslateResult> {
    if (this.apiKey === "") {
      // Missing server configuration must look like any other upstream
      // failure to the client; the key itself is never reported.
      throw new ApiError("llm_failed");
    }
    // The model's request policy (data collection, reasoning) is
    // read from the single metadata table in lib/models.ts; an id
    // the table does not know falls back to the paid models'
    // strict defaults, so an unlisted model can never silently
    // lose the privacy rule.
    const modelOption: Pick<
      LlmModelOption,
      "dataCollection" | "reasoningDisabled"
    > = getLlmModel(this.model) ?? {
      dataCollection: "deny",
      reasoningDisabled: false,
    };
    const body = {
      model: this.model,
      messages: [
        {
          role: "system",
          // Every model receives the same shared prompt,
          // byte-identical; no model gets an addendum
          // (see lib/models.ts).
          content: buildSystemPrompt(request.glossaryLines),
        },
        {
          role: "user",
          content: buildUserMessage({
            text: request.text,
            division: request.division,
            topic: request.topic,
            langs: request.langs,
          }),
        },
      ],
      temperature: TEMPERATURE,
      max_tokens: MAX_TOKENS,
      response_format: { type: "json_object" },
      // Per-model request policy, from the metadata in
      // lib/models.ts. An id the metadata does not know
      // keeps the strictest behaviour: "deny" sent, no reasoning
      // parameter.
      ...(modelOption.dataCollection === "deny"
        ? { provider: { data_collection: "deny" } }
        : {}),
      ...(modelOption.reasoningDisabled
        ? { reasoning: { enabled: false } }
        : {}),
    };

    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);
    let response: Response;
    try {
      response = await fetch(OPENROUTER_CHAT_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "name" in error &&
        (error as { name: unknown }).name === "AbortError"
      ) {
        throw new ApiError("timeout");
      }
      throw new ApiError("llm_failed");
    } finally {
      clearTimeout(timer);
    }

    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    // Errors can arrive with a non-200 status or inside a 200 body
    // (PRD section 8); both are mapped the same way.
    const bodyError =
      isRecord(payload) && isRecord(payload.error) ? payload.error : null;
    if (!response.ok || bodyError !== null) {
      const status =
        bodyError !== null && typeof bodyError.code === "number"
          ? bodyError.code
          : response.status;
      throw mapOpenRouterError(
        status,
        response.headers.get("Retry-After"),
        this.model,
      );
    }

    if (!isRecord(payload) || !Array.isArray(payload.choices)) {
      return { translations: {}, uncertain: [], parseFailed: true };
    }
    const firstChoice: unknown = payload.choices[0];
    if (!isRecord(firstChoice)) {
      return { translations: {}, uncertain: [], parseFailed: true };
    }
    // A truncated reply is unusable even if the JSON happens to parse.
    if (firstChoice.finish_reason === "length") {
      return { translations: {}, uncertain: [], parseFailed: true };
    }
    const message = isRecord(firstChoice.message)
      ? firstChoice.message
      : null;
    const content = message?.content;
    // Only choices[0].message.content is read; any reasoning field is
    // ignored (PRD section 8).
    if (typeof content !== "string") {
      return { translations: {}, uncertain: [], parseFailed: true };
    }
    const requested = request.langs.filter((code) => isLanguageCode(code));
    return parseModelContent(content, requested);
  }
}
