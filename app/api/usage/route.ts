import { getRequestApiKey } from "@/lib/auth-guard";
import { ApiError, apiErrorResponse } from "@/lib/errors";
import { isMockMode } from "@/lib/llm/index";

// GET /api/usage (PRD section 8). Returns the daily free-model
// request counters from OpenRouter's GET /api/v1/key in the contract
// shape { remaining, limit, used }, plus an "account" block with the
// account-level usage and credit limit — the paid model has no daily
// quota, so the meter displays those account figures. The figures
// describe the USER's own key — the request's key (cookie or
// header) is the one queried; there is no app-owned key. When the upstream data is
// missing or the call fails, the answer is { unavailable: true } and
// the UI hides the meter without an error. Mock mode returns dummy
// numbers in development and tests only; a production build never
// serves them (SEC-10) and answers unavailable instead, so the
// meter stays hidden. No key material is ever returned: only numeric usage
// fields are picked from the upstream response.
const OPENROUTER_KEY_URL = "https://openrouter.ai/api/v1/key";
const KEY_TIMEOUT_MS = 10_000;

// Dummy counters for mock mode in development and tests (section 8).
const MOCK_USAGE = { remaining: 42, limit: 50, used: 8 };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : null;
}

function unavailable(): Response {
  return Response.json({ unavailable: true });
}

export async function GET(request: Request): Promise<Response> {
  const apiKey = getRequestApiKey(request);
  if (apiKey === null) {
    return apiErrorResponse(new ApiError("unauthorized"));
  }
  if (isMockMode()) {
    // Mock is refused in production (SEC-10), as on the other
    // routes: dummy figures are never served by a production
    // build — the answer is the route's ordinary unavailable,
    // and the UI hides the meter.
    if (process.env.NODE_ENV === "production") {
      return unavailable();
    }
    return Response.json(MOCK_USAGE);
  }
  let data: Record<string, unknown>;
  try {
    const response = await fetch(OPENROUTER_KEY_URL, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(KEY_TIMEOUT_MS),
    });
    if (!response.ok) {
      return unavailable();
    }
    const body: unknown = await response.json().catch(() => null);
    if (!isRecord(body) || !isRecord(body.data)) {
      return unavailable();
    }
    data = body.data;
  } catch {
    return unavailable();
  }

  const result: Record<string, unknown> = {};
  const free = data.free_model_daily_requests;
  if (isRecord(free)) {
    const remaining = numberOrNull(free.remaining);
    const limit = numberOrNull(free.limit);
    const used = numberOrNull(free.used);
    if (remaining !== null && limit !== null && used !== null) {
      result.remaining = remaining;
      result.limit = limit;
      result.used = used;
    }
  }
  const usage = numberOrNull(data.usage);
  if (usage !== null) {
    result.account = {
      usage,
      usageDaily: numberOrNull(data.usage_daily),
      limit: numberOrNull(data.limit),
      limitRemaining: numberOrNull(data.limit_remaining),
      // GC-06 layer 1: whether the account has EVER bought
      // credit. Forwarded verbatim (boolean or null — never
      // guessed), because a free-tier account's paid balance is
      // provably $0 whatever its key limit says.
      isFreeTier:
        typeof data.is_free_tier === "boolean" ? data.is_free_tier : null,
    };
  }
  if (Object.keys(result).length === 0) {
    return unavailable();
  }
  return Response.json(result);
}
