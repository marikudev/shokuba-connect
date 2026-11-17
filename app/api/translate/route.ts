import { getRequestApiKey } from "@/lib/auth-guard";
import {
  hasNumberMismatch,
  hasProhibition,
  isProhibitionMissing,
} from "@/lib/checks";
import { ApiError, apiErrorResponse } from "@/lib/errors";
import { loadGlossaryTerms, selectGlossaryLines } from "@/lib/glossary";
import { isLanguageCode, type LanguageCode } from "@/lib/languages";
import {
  getLlmClient,
  isMockMode,
  resolveEffectiveModelId,
} from "@/lib/llm/index";
import { getLlmModel, isLlmModelId } from "@/lib/models";
import {
  containsControlCharacter,
  containsJapaneseLetter,
  countCharacters,
  MAX_DIVISION_LENGTH,
  MAX_TEXT_LENGTH,
  MAX_TOPIC_LENGTH,
} from "@/lib/validate";

// POST /api/translate (PRD section 8). Pipeline: body size (413), access
// code (401), JSON and field validation (400, SEC-03), glossary
// selection (section 10), one LLM call for all requested languages,
// per-language results with the deterministic number check and
// the source prohibition flag. Error responses never contain
// the input text, and nothing about the request is logged (SEC-06).
// No runtime segment export: the Node.js runtime is the
// default and the only one the Workers adapter serves.
// maxDuration stays as the PRD section 7 route budget.
export const maxDuration = 120;

// Body cap: 4096 bytes — ample for the validated fields
// below, which remain the real validation.
const MAX_BODY_BYTES = 4096;

type LanguageResult =
  | {
      ok: true;
      text: string;
      numberMismatch: boolean;
      prohibitionMissing: boolean;
    }
  | { ok: false; error: "bad_output" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function optionalField(
  value: unknown,
  maxLength: number,
): string | null {
  if (value === undefined) {
    return "";
  }
  if (typeof value !== "string" || countCharacters(value) > maxLength) {
    return null;
  }
  return value;
}

const OPENROUTER_KEY_URL = "https://openrouter.ai/api/v1/key";
const KEY_CHECK_TIMEOUT_MS = 10_000;

// GC-06 layer 1 helper: read is_free_tier for the request's key.
// Returns the boolean when the endpoint states one, and null
// for every other outcome (network failure, non-200, malformed
// body, non-boolean field) — null means "not proven", and the
// caller lets the request through.
async function fetchIsFreeTier(apiKey: string): Promise<boolean | null> {
  try {
    const response = await fetch(OPENROUTER_KEY_URL, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(KEY_CHECK_TIMEOUT_MS),
    });
    if (!response.ok) {
      return null;
    }
    const body: unknown = await response.json().catch(() => null);
    if (!isRecord(body) || !isRecord(body.data)) {
      return null;
    }
    return typeof body.data.is_free_tier === "boolean"
      ? body.data.is_free_tier
      : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).length > MAX_BODY_BYTES) {
    return apiErrorResponse(new ApiError("too_large"));
  }
  // BYOK : the request must carry the user's own
  // OpenRouter key (httpOnly cookie, or the x-api-key header for the
  // eval script); there is no app-owned key to fall back to.
  const apiKey = getRequestApiKey(request);
  if (apiKey === null) {
    return apiErrorResponse(new ApiError("unauthorized"));
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return apiErrorResponse(new ApiError("invalid_input"));
  }
  if (!isRecord(body)) {
    return apiErrorResponse(new ApiError("invalid_input"));
  }

  // SEC-03 server validation. Note the deliberate difference from the
  // client: the server requires Japanese letters in the text, while the
  // client only reports their absence.
  const text = body.text;
  if (
    typeof text !== "string" ||
    countCharacters(text) < 1 ||
    countCharacters(text) > MAX_TEXT_LENGTH ||
    !containsJapaneseLetter(text) ||
    containsControlCharacter(text)
  ) {
    return apiErrorResponse(new ApiError("invalid_input"));
  }
  const division = optionalField(body.division, MAX_DIVISION_LENGTH);
  const topic = optionalField(body.topic, MAX_TOPIC_LENGTH);
  if (division === null || topic === null) {
    return apiErrorResponse(new ApiError("invalid_input"));
  }
  const langsRaw = body.langs;
  if (
    !Array.isArray(langsRaw) ||
    langsRaw.length < 1 ||
    langsRaw.length > 4 ||
    langsRaw.some(
      (code) => typeof code !== "string" || !isLanguageCode(code),
    ) ||
    new Set(langsRaw).size !== langsRaw.length
  ) {
    return apiErrorResponse(new ApiError("invalid_input"));
  }
  const langs = langsRaw as LanguageCode[];

  // Model choice : optional, but when present it
  // must be one of the allowlisted models from lib/models.ts.
  const modelRaw = body.model;
  if (modelRaw !== undefined && !isLlmModelId(modelRaw)) {
    return apiErrorResponse(new ApiError("invalid_input"));
  }
  const model = modelRaw as string | undefined;

  // A language the serving model does not
  // support is rejected before any call is made. The free model's
  // Burmese output was garbled in evaluation, so that combination must never
  // produce a translation that looks official; the client already
  // blocks it in the UI, and this is the server-side guarantee that
  // no other caller can bypass. The check runs against the model
  // that will actually serve (the request's choice, else the env
  // fallback), read from the same metadata table as everything
  // else — there is no per-model special case here.
  const servingModel = getLlmModel(resolveEffectiveModelId(model));
  if (
    servingModel &&
    langs.some((code) => servingModel.unsupportedLanguages.includes(code))
  ) {
    return apiErrorResponse(new ApiError("invalid_input"));
  }

  // GC-06 layer 1, server side (the guarantee behind the UI):
  // a free-tier account has provably never bought credit, so a
  // paid model must never serve it — whatever the client claims.
  // The key endpoint is re-read with the request's own key; the
  // answer 402 (credits_or_quota) is the same one OpenRouter
  // itself would give. A failed or ambiguous check does NOT
  // block: the LLM call remains the final word, so a paying
  // operator is never stopped by a check that could not run.
  if (servingModel?.paid && !isMockMode()) {
    const freeTier = await fetchIsFreeTier(apiKey);
    if (freeTier === true) {
      return apiErrorResponse(new ApiError("credits_or_quota"));
    }
  }

  const glossary = selectGlossaryLines(
    loadGlossaryTerms(),
    { text, division, topic },
    langs,
  );

  let llmResult;
  try {
    llmResult = await getLlmClient(model, apiKey).translate({
      text,
      division,
      topic,
      langs,
      glossaryLines: glossary.lines,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return apiErrorResponse(error);
    }
    return apiErrorResponse(new ApiError("llm_failed"));
  }

  const results: Record<string, LanguageResult> = {};
  for (const code of langs) {
    const translated = llmResult.parseFailed
      ? undefined
      : llmResult.translations[code];
    results[code] =
      translated === undefined
        ? { ok: false, error: "bad_output" }
        : {
            ok: true,
            text: translated,
            numberMismatch: hasNumberMismatch(text, translated),
            prohibitionMissing: isProhibitionMissing(text, translated, code),
          };
  }

  return Response.json({
    results,
    uncertain: llmResult.parseFailed ? [] : llmResult.uncertain,
    sourceFlags: { prohibition: hasProhibition(text) },
    glossarySkipped: glossary.skipped,
  });
}
