import {
  clearedApiKeyCookieHeader,
  isSecureRequest,
} from "@/lib/session";

// POST /api/logout : clears the
// cookie that holds the user's API key, so that セッションを削除
// forgets the key as well as the local session data. No
// credential is required: the response only ever clears a cookie in
// the caller's own browser, and the cookie's SameSite=Strict
// attribute keeps cross-site requests from carrying or planting it.
// Only POST is exported (405 otherwise).

export async function POST(request: Request): Promise<Response> {
  const response = new Response(null, { status: 204 });
  response.headers.append(
    "Set-Cookie",
    clearedApiKeyCookieHeader(isSecureRequest(request)),
  );
  return response;
}
