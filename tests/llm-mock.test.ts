import { describe, expect, it } from "vitest";

import { MockLlmClient } from "@/lib/llm/mock";
import type { LlmTranslateRequest } from "@/lib/llm/types";

const base: LlmTranslateRequest = {
  text: "本日の連絡です",
  division: "",
  topic: "",
  langs: ["id", "my"],
  glossaryLines: [],
};

describe("MockLlmClient", () => {
  it("is deterministic and clearly marked as mock output", async () => {
    const client = new MockLlmClient();
    const first = await client.translate(base);
    const second = await client.translate(base);
    expect(first).toEqual(second);
    expect(first.translations.id).toBe("[MOCK id] 本日の連絡です");
    expect(first.translations.my).toBe("[MOCK my] 本日の連絡です");
    expect(first.parseFailed).toBe(false);
    expect(client.isMock).toBe(true);
  });

  it("simulates a timeout for #timeout", async () => {
    const client = new MockLlmClient();
    await expect(
      client.translate({ ...base, text: "本日 #timeout です" }),
    ).rejects.toMatchObject({ code: "timeout" });
  });

  it("simulates a rate limit for #429", async () => {
    const client = new MockLlmClient();
    const error = await client
      .translate({ ...base, text: "本日 #429 です" })
      .catch((caught: unknown) => caught);
    expect(error).toMatchObject({
      code: "rate_limited",
      retryAfterSeconds: 30,
    });
  });

  it("simulates an unparseable reply for #badjson", async () => {
    const client = new MockLlmClient();
    const result = await client.translate({
      ...base,
      text: "本日 #badjson です",
    });
    expect(result.parseFailed).toBe(true);
    expect(result.translations).toEqual({});
  });
});
