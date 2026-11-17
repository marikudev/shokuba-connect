import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET, POST } from "@/app/api/verify/route";
import { SESSION_COOKIE_NAME } from "@/lib/session";

// /api/verify checks the user's own
// OpenRouter API key. These tests run in mock mode, where any
// plausibly shaped key is accepted without an upstream call; the
// real-mode verdict comes from OpenRouter's key endpoint.
const KEY = "sk-or-v1-testkey0123456789abcdef0123456789abcdef01234567";

function postRequest(body: unknown, extraHeaders?: Record<string, string>): Request {
  return new Request("http://localhost/api/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...extraHeaders },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function cookieRequest(key: string | null): Request {
  const headers = new Headers();
  if (key !== null) {
    headers.set("cookie", `${SESSION_COOKIE_NAME}=${key}`);
  }
  return new Request("http://localhost/api/verify", { headers });
}

describe("/api/verify (BYOK key gate)", () => {
  beforeEach(() => {
    process.env.LLM_MODE = "mock";
  });

  afterEach(() => {
    delete process.env.LLM_MODE;
  });

  it("accepts a plausibly shaped key and stores it in the httpOnly cookie", async () => {
    const response = await POST(postRequest({ apiKey: KEY }));
    expect(response.status).toBe(204);
    const setCookie = response.headers.get("Set-Cookie") ?? "";
    expect(setCookie).toContain(`${SESSION_COOKIE_NAME}=${KEY}`);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Strict");
    expect(setCookie).toContain("Max-Age=86400");
  });

  it("sets no cookie on failure", async () => {
    const bad = await POST(postRequest({ apiKey: "bad" }));
    expect(bad.status).toBe(401);
    expect(bad.headers.get("set-cookie")).toBeNull();
  });

  it("rejects malformed keys with the same 401", async () => {
    for (const apiKey of [
      "short",
      "not-a-key-at-all-000000",
      "sk-or- has spaces in it 123456",
    ]) {
      const response = await POST(postRequest({ apiKey }));
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: "unauthorized" });
    }
  });

  it("rejects a non-string key and malformed JSON with 400", async () => {
    expect((await POST(postRequest({ apiKey: 42 }))).status).toBe(400);
    expect((await POST(postRequest("{not json"))).status).toBe(400);
  });

  it("resume: POST without a key answers 204 only with a stored cookie", async () => {
    const withCookie = await POST(
      postRequest({}, { cookie: `${SESSION_COOKIE_NAME}=${KEY}` }),
    );
    expect(withCookie.status).toBe(204);
    const without = await POST(postRequest({}));
    expect(without.status).toBe(401);
  });

  it("revalidates the stored key on resume in real mode; a revoked key is refused and its cookie cleared ", async () => {
    delete process.env.LLM_MODE;
    const upstream = vi.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({}),
    }));
    vi.stubGlobal("fetch", upstream);
    const response = await POST(
      postRequest({}, { cookie: `${SESSION_COOKIE_NAME}=${KEY}` }),
    );
    expect(response.status).toBe(401);
    // The dead cookie is cleared so the gate shows the key field.
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(upstream).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it("resumes in real mode when the stored key still checks out", async () => {
    delete process.env.LLM_MODE;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ data: { usage: 0 } }),
      })),
    );
    const response = await POST(
      postRequest({}, { cookie: `${SESSION_COOKIE_NAME}=${KEY}` }),
    );
    expect(response.status).toBe(204);
    vi.unstubAllGlobals();
  });

  it("GET probes for a stored key cookie", async () => {
    expect((await GET(cookieRequest(KEY))).status).toBe(204);
    expect((await GET(cookieRequest(null))).status).toBe(401);
    expect((await GET(cookieRequest("garbage"))).status).toBe(401);
  });

  it("throttles a client after 20 failed key checks ", async () => {
    const ip = "198.51.100.23";
    const withIp = (apiKey: string): Request =>
      postRequest({ apiKey }, { "x-forwarded-for": ip });
    for (let i = 0; i < 20; i += 1) {
      expect((await POST(withIp("bad"))).status).toBe(401);
    }
    // Blocked: even a valid key gets the same indistinguishable 401.
    expect((await POST(withIp(KEY))).status).toBe(401);
    // A different client is unaffected.
    expect((await POST(postRequest({ apiKey: KEY }))).status).toBe(204);
  });
});
