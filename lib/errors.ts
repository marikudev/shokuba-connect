// The single error taxonomy for the whole app (PRD section 8
// "one error taxonomy"). API routes return these codes; the UI maps them
// to Japanese messages from lib/i18n/ja.ts. Error responses never contain
// the user's input text (SEC-06).

export const API_ERROR_CODES = [
  "unauthorized",
  "invalid_input",
  "too_large",
  "rate_limited",
  "credits_or_quota",
  "llm_failed",
  "timeout",
  "bad_output",
  // The chosen model cannot serve at all right now: for the
  // free model this is how an upstream 404 is reported when the key
  // owner's own OpenRouter account data policy refuses the free
  // endpoint — a configuration problem the operator can act on, not
  // a generic failure.
  "model_unavailable",
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export const API_ERROR_HTTP_STATUS: Record<ApiErrorCode, number> = {
  unauthorized: 401,
  invalid_input: 400,
  too_large: 413,
  rate_limited: 429,
  credits_or_quota: 402,
  llm_failed: 502,
  timeout: 504,
  // A model reply that cannot be used is reported per language inside a
  // 200 response (PRD section 9); as a request-level error it maps to 502.
  bad_output: 502,
  model_unavailable: 502,
};

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly retryAfterSeconds: number | null;

  constructor(code: ApiErrorCode, retryAfterSeconds: number | null = null) {
    super(code);
    this.name = "ApiError";
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export function apiErrorResponse(error: ApiError): Response {
  const body: { error: ApiErrorCode; retryAfter?: number } = {
    error: error.code,
  };
  if (error.code === "rate_limited" && error.retryAfterSeconds !== null) {
    body.retryAfter = error.retryAfterSeconds;
  }
  return Response.json(body, {
    status: API_ERROR_HTTP_STATUS[error.code],
  });
}
