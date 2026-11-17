import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/errors";
import {
  OpenRouterClient,
  parseModelContent,
} from "@/lib/llm/openrouter";
import type { LlmTranslateRequest } from "@/lib/llm/types";
import { buildSystemPrompt } from "@/lib/prompt";

import fixture from "./fixtures/openrouter-response-sample.json";

const request: LlmTranslateRequest = {
  text: "明日の朝礼は7時30分から行います。立入禁止エリアには絶対に入らないでください。",
  division: "",
  topic: "",
  langs: ["id", "my", "pt"],
  glossaryLines: [],
};

function jsonResponse(body: unknown, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function completionWith(content: string, finishReason = "stop") {
  return {
    id: "gen-test",
    model: "google/gemma-4-31b-it",
    provider: "TestProvider",
    choices: [
      {
        index: 0,
        message: { role: "assistant", content },
        finish_reason: finishReason,
      },
    ],
  };
}

function makeClient(timeoutMs?: number) {
  return new OpenRouterClient({
    apiKey: "test-key-not-a-real-secret",
    model: "google/gemma-4-31b-it",
    timeoutMs,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("OpenRouterClient", () => {
  it("parses a realistic response and sends the decided parameters", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(fixture));
    vi.stubGlobal("fetch", fetchMock);

    const result = await makeClient().translate(request);

    expect(result.parseFailed).toBe(false);
    expect(result.translations.id).toContain("rapat pagi");
    expect(result.translations.my).toBeTruthy();
    expect(result.translations.pt).toContain("reunião matinal");

    const [, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    const sent = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(sent.model).toBe("google/gemma-4-31b-it");
    expect(sent.temperature).toBe(0.1);
    expect(sent.max_tokens).toBe(4000);
    expect(sent.response_format).toEqual({ type: "json_object" });
    // Decided parameters: deny data collection; no reasoning parameter at all.
    expect(sent.provider).toEqual({ data_collection: "deny" });
    expect(sent).not.toHaveProperty("reasoning");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer test-key-not-a-real-secret");
    expect(headers).not.toHaveProperty("HTTP-Referer");
    expect(headers).not.toHaveProperty("X-OpenRouter-Title");
  });

  it("tolerates a code fence around the JSON", async () => {
    const content =
      "```json\n" +
      JSON.stringify({
        translations: { id: "satu", my: "dua", pt: "tiga" },
        uncertain: [],
      }) +
      "\n```";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(completionWith(content))),
    );
    const result = await makeClient().translate(request);
    expect(result.parseFailed).toBe(false);
    expect(result.translations.id).toBe("satu");
  });

  it("tolerates extra prose around the JSON object", async () => {
    const content =
      "Here is the result: " +
      JSON.stringify({
        translations: { id: "satu", my: "dua", pt: "tiga" },
        uncertain: [],
      }) +
      " (done)";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(completionWith(content))),
    );
    const result = await makeClient().translate(request);
    expect(result.translations.pt).toBe("tiga");
  });

  it("treats finish_reason length as a failed parse even when JSON parses", async () => {
    const content = JSON.stringify({
      translations: { id: "satu", my: "dua", pt: "tiga" },
      uncertain: [],
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(completionWith(content, "length"))),
    );
    const result = await makeClient().translate(request);
    expect(result.parseFailed).toBe(true);
  });

  it("drops a missing language instead of failing the whole reply", async () => {
    const content = JSON.stringify({
      translations: { id: "satu", pt: "tiga" },
      uncertain: [],
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(completionWith(content))),
    );
    const result = await makeClient().translate(request);
    expect(result.parseFailed).toBe(false);
    expect(result.translations.my).toBeUndefined();
    expect(result.translations.id).toBe("satu");
  });

  it("ignores a reasoning field in the response message", async () => {
    const body = completionWith(
      JSON.stringify({
        translations: { id: "satu", my: "dua", pt: "tiga" },
        uncertain: [],
      }),
    ) as { choices: { message: Record<string, unknown> }[] };
    body.choices[0].message.reasoning = "long hidden chain of thought";
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(body)));
    const result = await makeClient().translate(request);
    expect(result.translations.id).toBe("satu");
  });

  it.each([
    // Since BYOK a 401/403 means the session's own key
    // is dead, so it maps to unauthorized and ends the session.
    [401, "unauthorized"],
    [403, "unauthorized"],
    [402, "credits_or_quota"],
    [502, "llm_failed"],
    [503, "llm_failed"],
    [408, "timeout"],
    [504, "timeout"],
  ])("maps HTTP %i to %s", async (status, code) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({ error: { code: status, message: "boom" } }, status),
      ),
    );
    await expect(makeClient().translate(request)).rejects.toMatchObject({
      code,
    });
  });

  it("maps 429 and forwards Retry-After", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({ error: { code: 429, message: "slow down" } }, 429, {
          "Retry-After": "17",
        }),
      ),
    );
    const error = await makeClient()
      .translate(request)
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe("rate_limited");
    expect((error as ApiError).retryAfterSeconds).toBe(17);
  });

  it("maps an error embedded in a 200 body the same way", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({ error: { code: 402, message: "no credits" } }, 200),
      ),
    );
    await expect(makeClient().translate(request)).rejects.toMatchObject({
      code: "credits_or_quota",
    });
  });

  it("turns an aborted request into a timeout", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener("abort", () => {
              reject(
                new DOMException("The operation was aborted", "AbortError"),
              );
            });
          }),
      ),
    );
    await expect(makeClient(20).translate(request)).rejects.toMatchObject({
      code: "timeout",
    });
  });

  it("fails closed when the API key is missing", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const client = new OpenRouterClient({ apiKey: "", model: "m" });
    await expect(client.translate(request)).rejects.toMatchObject({
      code: "llm_failed",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("parseModelContent", () => {
  it("caps the uncertain list and drops invalid entries", () => {
    const content = JSON.stringify({
      translations: { id: "satu" },
      // Japanese entries (kana), so the language guard
      // passes them through and this test measures only the cap.
      uncertain: ["あ", "い", "う", "え", "お", "か", 42, "", "x".repeat(201)],
    });
    const result = parseModelContent(content, ["id"]);
    expect(result.uncertain).toEqual(["あ", "い", "う", "え", "お"]);
  });

  it("truncates an over-long uncertain entry instead of dropping it", () => {
    const content = JSON.stringify({
      translations: { id: "satu" },
      uncertain: ["あ".repeat(250)],
    });
    const result = parseModelContent(content, ["id"]);
    expect(result.uncertain).toEqual(["あ".repeat(200)]);
  });

  it("drops translations longer than 3000 code points", () => {
    const content = JSON.stringify({
      translations: { id: "x".repeat(3001), my: "ok" },
      uncertain: [],
    });
    const result = parseModelContent(content, ["id", "my"]);
    expect(result.translations.id).toBeUndefined();
    expect(result.translations.my).toBe("ok");
  });

  it("replaces non-Japanese uncertain entries with the Japanese fallback", () => {
    const content = JSON.stringify({
      translations: { zh: "昨天出现了问题。今天请确认后作业。" },
      uncertain: ["「不具合」：具体指哪一种螺栓拧紧不良，请确认。"],
    });
    const result = parseModelContent(content, ["zh"]);
    expect(result.uncertain).toHaveLength(1);
    // The operator never sees the Chinese text; the fallback names
    // the quoted source phrase in Japanese instead.
    expect(result.uncertain[0]).toContain("「不具合」について確認が必要です");
    expect(result.uncertain[0]).not.toContain("具体指");
  });

  it("returns parseFailed for non-JSON content", () => {
    expect(parseModelContent("no json here", ["id"]).parseFailed).toBe(
      true,
    );
  });
});

describe("OpenRouterClient per-model policy", () => {
  const policyRequest: LlmTranslateRequest = { ...request, langs: ["id"] };

  function clientFor(model: string) {
    return new OpenRouterClient({ apiKey: "sk-test", model });
  }

  async function sentBody(model: string) {
    const fetchMock = vi.fn(
      async () =>
        jsonResponse(
          completionWith(
            JSON.stringify({
              translations: { id: "Selamat pagi." },
              uncertain: [],
            }),
          ),
        ),
    );
    vi.stubGlobal("fetch", fetchMock);
    await clientFor(model).translate(policyRequest);
    const [, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    return JSON.parse(init.body as string) as Record<string, unknown>;
  }

  it("sends deny and no reasoning parameter for a paid model", async () => {
    const sent = await sentBody("google/gemma-4-31b-it");
    expect(sent.provider).toEqual({ data_collection: "deny" });
    expect(sent).not.toHaveProperty("reasoning");
  });

  it("omits data_collection and disables reasoning for the free model", async () => {
    const sent = await sentBody("nvidia/nemotron-3-ultra-550b-a55b:free");
    // No provider field at all — the exact configuration the
    //  retest passed with.
    expect(sent).not.toHaveProperty("provider");
    expect(sent.reasoning).toEqual({ enabled: false });
  });

  it("maps a 404 to model_unavailable only for the free model", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          jsonResponse(
            {
              error: {
                code: 404,
                message: "No endpoints found matching your data policy",
              },
            },
            404,
          ),
      ),
    );
    await expect(
      clientFor("nvidia/nemotron-3-ultra-550b-a55b:free").translate(
        policyRequest,
      ),
    ).rejects.toMatchObject({ code: "model_unavailable" });
    await expect(
      clientFor("google/gemma-4-31b-it").translate(policyRequest),
    ).rejects.toMatchObject({ code: "llm_failed" });
  });
});

describe("OpenRouterClient shared prompt for every model", () => {
  const policyRequest: LlmTranslateRequest = { ...request, langs: ["id"] };

  function clientFor(model: string) {
    return new OpenRouterClient({ apiKey: "sk-test", model });
  }

  async function sentSystemContent(model: string) {
    const fetchMock = vi.fn(
      async () =>
        jsonResponse(
          completionWith(
            JSON.stringify({
              translations: { id: "Selamat pagi." },
              uncertain: [],
            }),
          ),
        ),
    );
    vi.stubGlobal("fetch", fetchMock);
    await clientFor(model).translate(policyRequest);
    const [, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    const sent = JSON.parse(init.body as string) as {
      messages: { role: string; content: string }[];
    };
    return sent.messages[0].content;
  }

  it("sends the shared prompt byte-identical for every allowlisted model", async () => {
    // No model gets a prompt addendum: the system content is
    // the shared prompt exactly, for every model.
    for (const model of [
      "google/gemma-4-31b-it",
      "openai/gpt-6-luna",
      "nvidia/nemotron-3-ultra-550b-a55b:free",
    ]) {
      const content = await sentSystemContent(model);
      expect(content).toBe(buildSystemPrompt([]));
      expect(content).not.toContain("ADDITIONAL MANDATORY SELF-CHECK");
    }
  });

  it("sends the shared prompt byte-identical for an unlisted model id", async () => {
    const content = await sentSystemContent("acme/unlisted-model");
    expect(content).toBe(buildSystemPrompt([]));
  });

  it("sends deny and no reasoning parameter for GPT-6 Luna", async () => {
    const fetchMock = vi.fn(
      async () =>
        jsonResponse(
          completionWith(
            JSON.stringify({
              translations: { id: "Selamat pagi." },
              uncertain: [],
            }),
          ),
        ),
    );
    vi.stubGlobal("fetch", fetchMock);
    await clientFor("openai/gpt-6-luna").translate(policyRequest);
    const [, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    const sent = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(sent.model).toBe("openai/gpt-6-luna");
    expect(sent.provider).toEqual({ data_collection: "deny" });
    expect(sent).not.toHaveProperty("reasoning");
  });
});
