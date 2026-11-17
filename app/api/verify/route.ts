import { ApiError, apiErrorResponse } from "@/lib/errors";
import { isMockMode } from "@/lib/llm/index";
import {
  clientKey,
  isAuthBlocked,
  recordAuthFailure,
  recordAuthSuccess,
} from "@/lib/rate-limit";
import {
  apiKeyCookieHeader,
  clearedApiKeyCookieHeader,
  isPlausibleApiKey,
  isSecureRequest,
  readApiKeyCookie,
} from "@/lib/session";

// /api/verify (PRD section 8): the gate's entry point for
// the user's own OpenRouter API key.
//
//   GET — session probe for the gate: 204 when a plausible key
//          cookie is already stored in this browser (a new tab can
//          then offer "continue" after consent), 401 otherwise.
//   POST — with a JSON body { apiKey }: the key is checked once
//          against OpenRouter's key-info endpoint (a free call that
//          spends no credit). A valid key is stored in the httpOnly
//          cookie (lib/session.ts) and the answer is 204; an invalid
//          one gets the same 401 as everywhere else. Without an
//          apiKey in the body, POST is the resume path: 204 when a
//          stored cookie is present, 401 when it is not.
//
// The failed-attempt throttle (lib/rate-limit.ts) guards this route:
// without it the key check would be a free validity tester for
// stolen keys. Mock mode accepts any plausibly shaped key without
// an upstream call (development and tests); mock in production is a
// configuration error and verifies nothing (SEC-12).
const OPENROUTER_KEY_URL = "https://openrouter.ai/api/v1/key";
const KEY_TIMEOUT_MS = 10_000;
const MAX_BODY_BYTES = 2048;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function GET(request: Request): Promise<Response> {
  return isPlausibleApiKey(readApiKeyCookie(request))
    ? new Response(null, { status: 204 })
    : apiErrorResponse(new ApiError("unauthorized"));
}

async function checkKeyWithOpenRouter(apiKey: string): Promise<boolean | null> {
  // true: OpenRouter accepts the key. false: it rejects it (401/403).
  // null: the check itself failed (network, upstream error) — the
  // operator is told the service is unreachable, and the attempt is
  // not counted as a failure against them.
  try {
    const response = await fetch(OPENROUTER_KEY_URL, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(KEY_TIMEOUT_MS),
    });
    if (response.ok) {
      return true;
    }
    if (response.status === 401 || response.status === 403) {
      return false;
    }
    return null;
  } catch {
    return null;
  }
}

export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).length > MAX_BODY_BYTES) {
    return apiErrorResponse(new ApiError("too_large"));
  }
  let body: unknown = {};
  if (rawBody.trim() !== "") {
    try {
      body = JSON.parse(rawBody);
    } catch {
      return apiErrorResponse(new ApiError("invalid_input"));
    }
    if (!isRecord(body)) {
      return apiErrorResponse(new ApiError("invalid_input"));
    }
  }
  const provided = (body as Record<string, unknown>).apiKey;

  // Resume path: no key in the body — the stored cookie speaks, but
  // in real mode it is re-checked against OpenRouter first
  // : a key that was revoked after it was stored must
  // not sail back in on shape alone. A rejected stored key also
  // clears the cookie, so the gate's next probe shows the key field
  // again. If the check itself cannot be completed (upstream down),
  // the resume is allowed — the translate call will surface any real
  // problem, and an outage should not lock the operator out.
  if (provided === undefined || provided === "") {
    const stored = readApiKeyCookie(request);
    if (!isPlausibleApiKey(stored)) {
      return apiErrorResponse(new ApiError("unauthorized"));
    }
    if (isMockMode()) {
      if (process.env.NODE_ENV === "production") {
        return apiErrorResponse(new ApiError("llm_failed"));
      }
      return new Response(null, { status: 204 });
    }
    const verdict = await checkKeyWithOpenRouter(stored);
    if (verdict === false) {
      const response = apiErrorResponse(new ApiError("unauthorized"));
      response.headers.append(
        "Set-Cookie",
        clearedApiKeyCookieHeader(isSecureRequest(request)),
      );
      return response;
    }
    return new Response(null, { status: 204 });
  }
  if (typeof provided !== "string") {
    return apiErrorResponse(new ApiError("invalid_input"));
  }
  const apiKey = provided.trim();

  const throttleKey = clientKey(request);
  if (isAuthBlocked(throttleKey) || !isPlausibleApiKey(apiKey)) {
    if (!isAuthBlocked(throttleKey)) {
      recordAuthFailure(throttleKey);
    }
    return apiErrorResponse(new ApiError("unauthorized"));
  }

  if (isMockMode()) {
    if (process.env.NODE_ENV === "production") {
      return apiErrorResponse(new ApiError("llm_failed"));
    }
    // Mock mode: a plausibly shaped key is accepted as-is.
  } else {
    const verdict = await checkKeyWithOpenRouter(apiKey);
    if (verdict === null) {
      return apiErrorResponse(new ApiError("llm_failed"));
    }
    if (!verdict) {
      recordAuthFailure(throttleKey);
      return apiErrorResponse(new ApiError("unauthorized"));
    }
  }

  recordAuthSuccess(throttleKey);
  const response = new Response(null, { status: 204 });
  response.headers.append(
    "Set-Cookie",
    apiKeyCookieHeader(apiKey, isSecureRequest(request)),
  );
  return response;
}
