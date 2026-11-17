// The user's own OpenRouter API key, held in an httpOnly
// cookie.
//
// The flow: the operator pastes their OpenRouter API key at the
// gate; POST /api/verify checks it against OpenRouter once and, on
// success, stores THE KEY ITSELF in this cookie. Every later request
// (translate, usage) reads the key back from the cookie and uses it
// for that request only. The server stores nothing: no database, no
// log line, no cache — the cookie in the user's own browser is the
// only place the key rests, and POST /api/logout clears it.
//
// Why a cookie and not web storage: httpOnly means no JavaScript on
// the page can read the key (web storage is readable by any script),
// SameSite=Strict keeps other sites from riding the session, Secure
// (on HTTPS) keeps it off plain-http hops, and the 24-hour Max-Age
// matches this app's session length (24 hours, extended from 12
// so materials prepared after a shift are still in session at
// the next morning's chourei). A new tab
// still shows the gate for consent (the acknowledgement lives in
// sessionStorage); the gate then offers to continue with the stored
// key instead of asking for a paste again — the key is never shown
// back to anyone, only used.

export const SESSION_COOKIE_NAME = "chourei_session";
export const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const SESSION_MAX_AGE_SECONDS = Math.floor(SESSION_TTL_MS / 1000);

// Cheap shape check before a key is trusted or sent upstream:
// OpenRouter keys look like "sk-or-v1-…" (73 characters today). The
// real verdict always comes from OpenRouter itself; this only keeps
// obvious garbage (empty, whitespace, control characters, pasted
// sentences) from being treated as a credential at all.
export function isPlausibleApiKey(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.startsWith("sk-or-") &&
    value.length >= 20 &&
    value.length <= 200 &&
    !/[\s\u0000-\u001f\u007f]/.test(value)
  );
}

// Reads this app's cookie out of a request's Cookie header.
export function readApiKeyCookie(request: Request): string | null {
  const header = request.headers.get("cookie");
  if (!header) {
    return null;
  }
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) {
      continue;
    }
    if (part.slice(0, eq).trim() === SESSION_COOKIE_NAME) {
      const value = part.slice(eq + 1).trim();
      return value === "" ? null : value;
    }
  }
  return null;
}

// Secure is set on HTTPS deployments (production is always HTTPS);
// plain-http local development must not set it or the browser would
// refuse to store the cookie at all.
export function isSecureRequest(request: Request): boolean {
  return (
    request.headers.get("x-forwarded-proto") === "https" ||
    process.env.NODE_ENV === "production"
  );
}

export function apiKeyCookieHeader(apiKey: string, secure: boolean): string {
  const parts = [
    `${SESSION_COOKIE_NAME}=${apiKey}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${SESSION_MAX_AGE_SECONDS}`,
  ];
  if (secure) {
    parts.push("Secure");
  }
  return parts.join("; ");
}

export function clearedApiKeyCookieHeader(secure: boolean): string {
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    "Max-Age=0",
  ];
  if (secure) {
    parts.push("Secure");
  }
  return parts.join("; ");
}
