import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/usage/route";
import { SESSION_COOKIE_NAME } from "@/lib/session";

// Route tests for GET /api/usage (PRD section 8). The upstream
// OpenRouter key call is mocked; no real request ever leaves the suite.
// The route is authorized by the USER's
// key (x-api-key header here, or the key cookie), and that same key
// is the one queried upstream — there is no app-owned key anymore.
const USER_KEY = "sk-or-v1-userkey0123456789abcdef0123456789abcdef0123456";

function request(key: string | null, viaCookie = false): Request {
  const headers: Record<string, string> = {};
  if (key !== null) {
    if (viaCookie) {
      headers.cookie = `${SESSION_COOKIE_NAME}=${key}`;
    } else {
      headers["x-api-key"] = key;
    }
  }
  return new Request("http://localhost/api/usage", {
    method: "GET",
    headers,
  });
}

const KEY_RESPONSE = {
  data: {
    label: "sk-or-v1-xxxx",
    is_free_tier: false,
    limit: null,
    limit_remaining: null,
    usage: 0.0012,
    usage_daily: 0.0005,
    free_model_daily_requests: { used: 3, limit: 1000, remaining: 997 },
  },
};

describe("GET /api/usage", () => {
  let savedMode: string | undefined;

  beforeEach(() => {
    savedMode = process.env.LLM_MODE;
  });

  afterEach(() => {
    if (savedMode === undefined) {
      delete process.env.LLM_MODE;
    } else {
      process.env.LLM_MODE = savedMode;
    }
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("answers the same 401 for a missing or implausible key", async () => {
    process.env.LLM_MODE = "mock";
    for (const response of [
      await GET(request(null)),
      await GET(request("not-a-key")),
    ]) {
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: "unauthorized" });
    }
  });

  it("accepts the key cookie as well as the header ", async () => {
    process.env.LLM_MODE = "mock";
    const response = await GET(request(USER_KEY, true));
    expect(response.status).toBe(200);
  });

  it("returns dummy counters in mock mode (section 8)", async () => {
    process.env.LLM_MODE = "mock";
    const response = await GET(request(USER_KEY));
    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    expect(typeof body.remaining).toBe("number");
    expect(typeof body.limit).toBe("number");
    expect(typeof body.used).toBe("number");
  });

  it("never serves dummy counters from a production build (SEC-10)", async () => {
    process.env.LLM_MODE = "mock";
    vi.stubEnv("NODE_ENV", "production");
    const response = await GET(request(USER_KEY));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ unavailable: true });
  });

  it("queries upstream with the request's own key and maps the contract shape plus the account block", async () => {
    process.env.LLM_MODE = "openrouter";
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify(KEY_RESPONSE), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(request(USER_KEY));
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(JSON.parse(text)).toEqual({
      remaining: 997,
      limit: 1000,
      used: 3,
      account: {
        usage: 0.0012,
        usageDaily: 0.0005,
        limit: null,
        limitRemaining: null,
        isFreeTier: false,
      },
    });
    // The key itself never appears in the response body.
    expect(text).not.toContain(USER_KEY);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://openrouter.ai/api/v1/key");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      `Bearer ${USER_KEY}`,
    );
  });

  it("forwards is_free_tier: true for an account that never bought credit (GC-06)", async () => {
    process.env.LLM_MODE = "openrouter";
    const freeTierResponse = {
      data: { ...KEY_RESPONSE.data, is_free_tier: true, limit: 50, limit_remaining: 50 },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify(freeTierResponse), { status: 200 }),
      ),
    );
    const response = await GET(request(USER_KEY));
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      account: { isFreeTier: unknown };
    };
    expect(body.account.isFreeTier).toBe(true);
  });

  it("answers unavailable when the upstream call fails", async () => {
    process.env.LLM_MODE = "openrouter";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 500 })),
    );
    const response = await GET(request(USER_KEY));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ unavailable: true });
  });
});
