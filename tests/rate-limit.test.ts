import { beforeEach, describe, expect, it } from "vitest";

import {
  BLOCK_MS,
  clientKey,
  isAuthBlocked,
  MAX_FAILURES,
  recordAuthFailure,
  recordAuthSuccess,
  resetAuthThrottle,
  WINDOW_MS,
} from "@/lib/rate-limit";

const KEY = "203.0.113.10";
const T0 = 1_700_000_000_000;

describe("access-attempt throttle", () => {
  beforeEach(() => {
    resetAuthThrottle();
  });

  it("derives the client key from the first forwarded hop", () => {
    const request = new Request("http://localhost/", {
      headers: { "x-forwarded-for": "198.51.100.7, 10.0.0.1" },
    });
    expect(clientKey(request)).toBe("198.51.100.7");
    expect(clientKey(new Request("http://localhost/"))).toBe("unknown");
  });

  it("blocks after MAX_FAILURES failures inside the window", () => {
    for (let i = 0; i < MAX_FAILURES - 1; i += 1) {
      recordAuthFailure(KEY, T0 + i);
    }
    expect(isAuthBlocked(KEY, T0 + MAX_FAILURES)).toBe(false);
    recordAuthFailure(KEY, T0 + MAX_FAILURES);
    expect(isAuthBlocked(KEY, T0 + MAX_FAILURES + 1)).toBe(true);
  });

  it("the block lifts after BLOCK_MS", () => {
    for (let i = 0; i < MAX_FAILURES; i += 1) {
      recordAuthFailure(KEY, T0 + i);
    }
    // The block starts at the last (triggering) failure.
    const blockedUntil = T0 + MAX_FAILURES - 1 + BLOCK_MS;
    expect(isAuthBlocked(KEY, blockedUntil - 1)).toBe(true);
    expect(isAuthBlocked(KEY, blockedUntil + 1)).toBe(false);
  });

  it("failures older than the window stop counting", () => {
    for (let i = 0; i < MAX_FAILURES - 1; i += 1) {
      recordAuthFailure(KEY, T0 + i);
    }
    recordAuthFailure(KEY, T0 + WINDOW_MS + 1);
    expect(isAuthBlocked(KEY, T0 + WINDOW_MS + 2)).toBe(false);
  });

  it("a success clears the failure history", () => {
    for (let i = 0; i < MAX_FAILURES - 1; i += 1) {
      recordAuthFailure(KEY, T0 + i);
    }
    recordAuthSuccess(KEY);
    for (let i = 0; i < MAX_FAILURES - 1; i += 1) {
      recordAuthFailure(KEY, T0 + 100 + i);
    }
    expect(isAuthBlocked(KEY, T0 + 200)).toBe(false);
  });

  it("clients are throttled independently", () => {
    for (let i = 0; i < MAX_FAILURES; i += 1) {
      recordAuthFailure(KEY, T0 + i);
    }
    expect(isAuthBlocked(KEY, T0 + MAX_FAILURES)).toBe(true);
    expect(isAuthBlocked("203.0.113.99", T0 + MAX_FAILURES)).toBe(false);
  });
});
