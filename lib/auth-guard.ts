import { isPlausibleApiKey, readApiKeyCookie } from "@/lib/session";

// Where the data routes (/api/translate, /api/usage) get the
// user's OpenRouter API key:
//   1. the x-api-key header — kept for the eval script and tests,
//      which supply the runner's own key;
//   2. the httpOnly cookie set by /api/verify — what the browser
//      actually uses, so the key never sits in web storage.
// A value that fails the shape check in lib/session.ts counts as
// absent. Returns null when no usable key is present; the routes
// answer 401 and the client returns to the key gate. There is no
// server-side key to fall back to — that is the point of the design.
export function getRequestApiKey(request: Request): string | null {
  const header = request.headers.get("x-api-key");
  if (isPlausibleApiKey(header)) {
    return header;
  }
  const cookie = readApiKeyCookie(request);
  if (isPlausibleApiKey(cookie)) {
    return cookie;
  }
  return null;
}
