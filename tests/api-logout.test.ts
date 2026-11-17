import { describe, expect, it } from "vitest";

import { POST } from "@/app/api/logout/route";

// POST /api/logout : ends the server session by expiring
// the cookie in the caller's own browser.
describe("POST /api/logout", () => {
  it("answers 204 with a clearing Set-Cookie", async () => {
    const response = await POST(
      new Request("http://localhost/api/logout", { method: "POST" }),
    );
    expect(response.status).toBe(204);
    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("chourei_session=");
    expect(setCookie).toContain("Max-Age=0");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Strict");
  });
});
