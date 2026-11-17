import { describe, expect, it } from "vitest";

import nextConfig from "../next.config";

// The baseline security headers must stay attached to
// every route; losing them in a config edit should fail loudly here.
describe("security headers (next.config)", () => {
  it("sets the baseline headers on all paths", async () => {
    const rules = (await nextConfig.headers?.()) ?? [];
    expect(rules).toHaveLength(1);
    expect(rules[0].source).toBe("/:path*");
    const headers = new Map(
      rules[0].headers.map((header) => [header.key, header.value]),
    );

    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(headers.get("Permissions-Policy")).toContain("camera=()");
    expect(headers.get("Strict-Transport-Security")).toContain(
      "max-age=63072000",
    );

    const csp = headers.get("Content-Security-Policy") ?? "";
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("script-src 'self' 'unsafe-inline'");
    // The test environment is not development, so the production CSP
    // must not carry the dev-only eval allowance.
    expect(csp).not.toContain("unsafe-eval");
  });
});
