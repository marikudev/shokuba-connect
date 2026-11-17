import { describe, expect, it } from "vitest";

import {
  apiKeyCookieHeader,
  clearedApiKeyCookieHeader,
  isPlausibleApiKey,
  readApiKeyCookie,
  SESSION_COOKIE_NAME,
} from "@/lib/session";

// The cookie holds the user's own OpenRouter API key
// itself — there is no signed token.
const KEY = "sk-or-v1-testkey0123456789abcdef0123456789abcdef01234567";

describe("API key shape check", () => {
  it("accepts OpenRouter-shaped keys", () => {
    expect(isPlausibleApiKey(KEY)).toBe(true);
    expect(isPlausibleApiKey("sk-or-v1-0123456789abcdef")).toBe(true);
  });

  it("rejects anything else", () => {
    for (const value of [
      "",
      "sk-or-",
      "short",
      "a pasted sentence that is not a key at all",
      "sk-or-v1-has spaces init 0123456789",
      "sk-or-v1-line\nbreak0123456789abcdef",
      42,
      null,
      undefined,
    ]) {
      expect(isPlausibleApiKey(value)).toBe(false);
    }
  });
});

describe("API key cookie helpers", () => {
  it("builds an httpOnly, SameSite=Strict cookie for 12 hours; Secure only when asked", () => {
    const plain = apiKeyCookieHeader(KEY, false);
    expect(plain).toContain(`${SESSION_COOKIE_NAME}=${KEY}`);
    expect(plain).toContain("HttpOnly");
    expect(plain).toContain("SameSite=Strict");
    expect(plain).toContain("Path=/");
    expect(plain).toContain("Max-Age=86400");
    expect(plain).not.toContain("Secure");
    expect(apiKeyCookieHeader(KEY, true)).toContain("Secure");
  });

  it("the clearing header expires the cookie immediately", () => {
    const cleared = clearedApiKeyCookieHeader(false);
    expect(cleared).toContain(`${SESSION_COOKIE_NAME}=;`);
    expect(cleared).toContain("Max-Age=0");
    expect(cleared).toContain("HttpOnly");
  });

  it("reads only this app's cookie out of the Cookie header", () => {
    const request = new Request("http://localhost/", {
      headers: {
        cookie: `other=abc; ${SESSION_COOKIE_NAME}=${KEY}; theme=dark`,
      },
    });
    expect(readApiKeyCookie(request)).toBe(KEY);
    expect(readApiKeyCookie(new Request("http://localhost/"))).toBeNull();
    expect(
      readApiKeyCookie(
        new Request("http://localhost/", {
          headers: { cookie: `${SESSION_COOKIE_NAME}=` },
        }),
      ),
    ).toBeNull();
  });
});
