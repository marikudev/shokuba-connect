import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/translate/route";

// The route is exercised with LLM_MODE=mock, so no real request ever
// leaves the test process. The mock client's triggers (#badjson etc.)
// drive the failure cases. BYOK : the request carries
// the user's key in the x-api-key header, as the eval script does;
// the browser uses the key cookie instead.
const USER_KEY = "sk-or-v1-userkey0123456789abcdef0123456789abcdef0123456";

function translateRequest(
  body: unknown,
  key: string | null = USER_KEY,
): Request {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (key !== null) {
    headers.set("x-api-key", key);
  }
  return new Request("http://localhost/api/translate", {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const validBody = {
  text: "明日の朝礼は7時30分から行います",
  division: "組立課",
  topic: "不具合",
  langs: ["id", "my"],
};

describe("POST /api/translate (mock LLM)", () => {
  beforeEach(() => {
    process.env.LLM_MODE = "mock";
  });

  afterEach(() => {
    delete process.env.LLM_MODE;
  });

  it("flags translations that lost the source prohibition ", async () => {
    const dangerBody = {
      text: "ラインが動いている間は手を入れないでください",
      division: "",
      topic: "",
      langs: ["id", "my"],
    };
    const response = await POST(translateRequest(dangerBody));
    expect(response.status).toBe(200);
    const data = (await response.json()) as {
      results: Record<string, { prohibitionMissing?: boolean }>;
      sourceFlags: { prohibition: boolean };
    };
    expect(data.sourceFlags.prohibition).toBe(true);
    // The mock's output carries no prohibition marker in either
    // language, so both panels must be flagged.
    expect(data.results.id.prohibitionMissing).toBe(true);
    expect(data.results.my.prohibitionMissing).toBe(true);

    const calm = await POST(translateRequest(validBody));
    const calmData = (await calm.json()) as {
      results: Record<string, { prohibitionMissing?: boolean }>;
    };
    expect(calmData.results.id.prohibitionMissing).toBe(false);
  });

  it("ignores an unknown revise field", async () => {
    // Unknown fields are ignored, and the request is a plain
    // translation.
    const response = await POST(
      translateRequest({
        ...validBody,
        revise: { id: "Terjemahan sebelumnya" },
      }),
    );
    expect(response.status).toBe(200);
  });

  it("caps the request body at 4096 bytes ", async () => {
    // Bodies above the 4096-byte cap are refused with 413.
    const over = await POST(
      translateRequest({ ...validBody, pad: "x".repeat(5000) }),
    );
    expect(over.status).toBe(413);
    const huge = await POST(
      translateRequest({ ...validBody, pad: "x".repeat(20000) }),
    );
    expect(huge.status).toBe(413);
  });

  it("accepts the key cookie instead of the header (BYOK, )", async () => {
    const { SESSION_COOKIE_NAME } = await import("@/lib/session");
    const headers = new Headers({ "Content-Type": "application/json" });
    headers.set("cookie", `${SESSION_COOKIE_NAME}=${USER_KEY}`);
    const response = await POST(
      new Request("http://localhost/api/translate", {
        method: "POST",
        headers,
        body: JSON.stringify(validBody),
      }),
    );
    expect(response.status).toBe(200);
  });

  it("returns per-language results in the PRD section 8 shape", async () => {
    const response = await POST(translateRequest(validBody));
    expect(response.status).toBe(200);
    const data = (await response.json()) as {
      results: Record<string, { ok: boolean; text?: string }>;
      uncertain: string[];
      sourceFlags: { prohibition: boolean };
      glossarySkipped: number;
    };
    expect(data.results.id).toEqual({
      ok: true,
      text: "[MOCK id] 明日の朝礼は7時30分から行います",
      numberMismatch: false,
      prohibitionMissing: false,
    });
    expect(data.results.my.ok).toBe(true);
    expect(data.uncertain).toEqual([]);
    expect(data.sourceFlags).toEqual({ prohibition: false });
    expect(data.glossarySkipped).toBe(0);
  });

  it("rejects a request without a plausible user key with 401", async () => {
    for (const key of [null, "nope"]) {
      const response = await POST(translateRequest(validBody, key));
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: "unauthorized" });
    }
  });

  it("rejects malformed JSON with 400", async () => {
    const response = await POST(translateRequest("{not json"));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_input" });
  });

  it("rejects text without Japanese letters (SEC-03)", async () => {
    const response = await POST(
      translateRequest({ ...validBody, text: "Safety first tomorrow" }),
    );
    expect(response.status).toBe(400);
  });

  it("rejects empty text, over-long text, and control characters", async () => {
    for (const text of ["", "あ".repeat(301), "テスト\u0001です"]) {
      const response = await POST(translateRequest({ ...validBody, text }));
      expect(response.status).toBe(400);
    }
  });

  it("accepts four languages in one request (the four-panel maximum)", async () => {
    const response = await POST(
      translateRequest({
        ...validBody,
        langs: ["id", "my", "pt", "en"],
      }),
    );
    expect(response.status).toBe(200);
    const data = (await response.json()) as {
      results: Record<string, unknown>;
    };
    expect(Object.keys(data.results).sort()).toEqual([
      "en",
      "id",
      "my",
      "pt",
    ]);
  });

  it("rejects invalid language selections", async () => {
    for (const langs of [
      [],
      ["id", "id"],
      ["id", "my", "pt", "en", "vi"],
      ["fr"],
      ["id", 3],
    ]) {
      const response = await POST(
        translateRequest({ ...validBody, langs }),
      );
      expect(response.status).toBe(400);
    }
  });

  it("rejects an over-long division or topic", async () => {
    const response = await POST(
      translateRequest({ ...validBody, division: "あ".repeat(51) }),
    );
    expect(response.status).toBe(400);
    const response2 = await POST(
      translateRequest({ ...validBody, topic: "あ".repeat(101) }),
    );
    expect(response2.status).toBe(400);
  });

  it("rejects a body over 16 KB with 413 before anything else", async () => {
    const big = JSON.stringify({ ...validBody, pad: "x".repeat(20000) });
    const response = await POST(translateRequest(big));
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: "too_large" });
  });

  it("marks every language bad_output when the model reply is unusable", async () => {
    const response = await POST(
      translateRequest({ ...validBody, text: "本日 #badjson です" }),
    );
    expect(response.status).toBe(200);
    const data = (await response.json()) as {
      results: Record<string, { ok: boolean; error?: string }>;
    };
    expect(data.results.id).toEqual({ ok: false, error: "bad_output" });
    expect(data.results.my).toEqual({ ok: false, error: "bad_output" });
  });

  it("accepts an allowlisted model and rejects any other ", async () => {
    const accepted = await POST(
      translateRequest({
        ...validBody,
        model: "google/gemma-4-31b-it",
      }),
    );
    expect(accepted.status).toBe(200);

    const acceptedLuna = await POST(
      translateRequest({
        ...validBody,
        model: "openai/gpt-6-luna",
      }),
    );
    expect(acceptedLuna.status).toBe(200);

    for (const model of [
      "openai/gpt-4o",
      "google/gemma-4-31b-it:free",
      "google/gemma-3-27b-it",
      "google/gemma-3-27b-it ",
      42,
    ]) {
      const rejected = await POST(
        translateRequest({ ...validBody, model }),
      );
      expect(rejected.status).toBe(400);
      expect(await rejected.json()).toEqual({ error: "invalid_input" });
    }
  });

  it("flags a prohibition in the source and keeps matching numbers clean", async () => {
    const flagged = await POST(
      translateRequest({
        text: "7時30分から立入禁止です",
        division: "",
        topic: "",
        langs: ["id"],
      }),
    );
    const flaggedBody = (await flagged.json()) as {
      sourceFlags: { prohibition: boolean };
      results: { id: { numberMismatch: boolean } };
      glossarySkipped: number;
    };
    expect(flaggedBody.sourceFlags.prohibition).toBe(true);
    // The mock echoes the source, so its numbers always match.
    expect(flaggedBody.results.id.numberMismatch).toBe(false);
    // The production glossary starts empty.
    expect(flaggedBody.glossarySkipped).toBe(0);

    const plain = await POST(
      translateRequest({
        text: "明日の朝礼は7時30分からです",
        division: "",
        topic: "",
        langs: ["id"],
      }),
    );
    const plainBody = (await plain.json()) as {
      sourceFlags: { prohibition: boolean };
    };
    expect(plainBody.sourceFlags.prohibition).toBe(false);
  });

  it("maps the mock rate limit trigger to 429 with retryAfter", async () => {
    const response = await POST(
      translateRequest({ ...validBody, text: "本日 #429 です" }),
    );
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({
      error: "rate_limited",
      retryAfter: 30,
    });
  });

  it("maps the mock timeout trigger to 504", async () => {
    const response = await POST(
      translateRequest({ ...validBody, text: "本日 #timeout です" }),
    );
    expect(response.status).toBe(504);
    expect(await response.json()).toEqual({ error: "timeout" });
  });

  it("rejects a language the free model does not support", async () => {
    const response = await POST(
      translateRequest({
        ...validBody,
        model: "nvidia/nemotron-3-ultra-550b-a55b:free",
        langs: ["id", "my"],
      }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_input" });
  });

  it("accepts the free model for its supported languages", async () => {
    const response = await POST(
      translateRequest({
        ...validBody,
        model: "nvidia/nemotron-3-ultra-550b-a55b:free",
        langs: ["id", "vi"],
      }),
    );
    expect(response.status).toBe(200);
  });

  it("rejects Filipino for the free model but accepts Chinese", async () => {
    const filResponse = await POST(
      translateRequest({
        ...validBody,
        model: "nvidia/nemotron-3-ultra-550b-a55b:free",
        langs: ["fil"],
      }),
    );
    expect(filResponse.status).toBe(400);
    const zhResponse = await POST(
      translateRequest({
        ...validBody,
        model: "nvidia/nemotron-3-ultra-550b-a55b:free",
        langs: ["zh"],
      }),
    );
    expect(zhResponse.status).toBe(200);
  });

  it("accepts Filipino and Chinese for a paid model", async () => {
    const response = await POST(
      translateRequest({
        ...validBody,
        model: "openai/gpt-6-luna",
        langs: ["fil", "zh"],
      }),
    );
    expect(response.status).toBe(200);
  });

  it("still accepts Burmese for a paid model", async () => {
    const response = await POST(
      translateRequest({
        ...validBody,
        model: "openai/gpt-6-luna",
        langs: ["my"],
      }),
    );
    expect(response.status).toBe(200);
  });

  it("never leaks the user's API key in any response", async () => {
    const okResponse = await POST(translateRequest(validBody));
    const okText = await okResponse.text();
    const errResponse = await POST(translateRequest(validBody, "bad"));
    const errText = await errResponse.text();
    for (const payload of [okText, errText]) {
      expect(payload).not.toContain(USER_KEY);
    }
  });
});

describe("POST /api/translate — GC-06 free-tier server gate", () => {
  beforeEach(() => {
    process.env.LLM_MODE = "openrouter";
  });

  afterEach(() => {
    delete process.env.LLM_MODE;
    vi.unstubAllGlobals();
  });

  function stubUpstream(isFreeTier: unknown) {
    const fetchMock = vi.fn(async (url: unknown) => {
      if (String(url).includes("/api/v1/key")) {
        return new Response(
          JSON.stringify({ data: { is_free_tier: isFreeTier } }),
          { status: 200 },
        );
      }
      // A chat completion in the contract shape.
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                role: "assistant",
                content: JSON.stringify({
                  translations: {
                    id: "Besok ada rapat pagi",
                    my: "မနက်ဖြန် အစည်းအဝေးရှိသည်",
                  },
                  uncertain: [],
                }),
              },
              finish_reason: "stop",
            },
          ],
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("rejects a paid model for a free-tier account before any model call", async () => {
    const fetchMock = stubUpstream(true);
    const response = await POST(
      translateRequest({ ...validBody, model: "google/gemma-4-31b-it" }),
    );
    expect(response.status).toBe(402);
    expect(await response.json()).toEqual({ error: "credits_or_quota" });
    const urls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(urls.some((url) => url.includes("/chat/completions"))).toBe(false);
  });

  it("lets a paid model through for an account that bought credit", async () => {
    stubUpstream(false);
    const response = await POST(
      translateRequest({ ...validBody, model: "google/gemma-4-31b-it" }),
    );
    expect(response.status).toBe(200);
  });

  it("never blocks the free model, even for a free-tier account", async () => {
    const fetchMock = stubUpstream(true);
    const response = await POST(
      translateRequest({
        ...validBody,
        langs: ["id"],
        model: "nvidia/nemotron-3-ultra-550b-a55b:free",
      }),
    );
    expect(response.status).toBe(200);
    // The free path never even consults the key endpoint.
    const urls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(urls.some((url) => url.includes("/api/v1/key"))).toBe(false);
  });

  it("fails open when the free-tier check cannot be answered", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown) => {
        if (String(url).includes("/api/v1/key")) {
          return new Response("nope", { status: 500 });
        }
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  role: "assistant",
                  content: JSON.stringify({
                    translations: { id: "Besok ada rapat pagi", my: "မနက်ဖြန်" },
                    uncertain: [],
                  }),
                },
                finish_reason: "stop",
              },
            ],
          }),
          { status: 200 },
        );
      }),
    );
    const response = await POST(
      translateRequest({ ...validBody, model: "google/gemma-4-31b-it" }),
    );
    expect(response.status).toBe(200);
  });
});
