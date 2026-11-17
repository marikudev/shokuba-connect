// Best-effort throttling of failed API-key verifications at
// POST /api/verify . Without it, anyone who finds the app
// could use its key-check as a free tester for stolen OpenRouter
// keys; failed checks are counted per client address and repeated
// failures block the client for a few minutes. State lives in this
// module's memory: per server instance, lost on cold start, and not
// shared between instances. That makes it a brake on bulk testing,
// not a wall — platform rate limiting (e.g. a platform firewall) is the
// durable layer. Keys are client IPs kept only in memory, never
// logged (SEC-06).
//
// Policy: MAX_FAILURES failed attempts inside WINDOW_MS block the
// client for BLOCK_MS. While blocked, even a valid key is refused
// with the same 401 as an invalid one (no signal about which state
// the client is in). A successful verification clears the client's
// failure history immediately.

export const MAX_FAILURES = 20;
export const WINDOW_MS = 15 * 60 * 1000;
export const BLOCK_MS = 5 * 60 * 1000;

interface ClientWindow {
  failures: number[];
  blockedUntil: number;
}

const clients = new Map<string, ClientWindow>();

// The client identity for throttling: the first hop of
// x-forwarded-for (set by the hosting platform), else x-real-ip.
export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first || request.headers.get("x-real-ip") || "unknown";
}

export function isAuthBlocked(key: string, now: number = Date.now()): boolean {
  const entry = clients.get(key);
  if (!entry) {
    return false;
  }
  if (entry.blockedUntil > now) {
    return true;
  }
  if (entry.blockedUntil !== 0) {
    // The block just expired; start the client fresh.
    clients.delete(key);
    return false;
  }
  return false;
}

export function recordAuthFailure(
  key: string,
  now: number = Date.now(),
): void {
  const entry = clients.get(key) ?? { failures: [], blockedUntil: 0 };
  entry.failures = entry.failures.filter((at) => now - at < WINDOW_MS);
  entry.failures.push(now);
  if (entry.failures.length >= MAX_FAILURES) {
    entry.blockedUntil = now + BLOCK_MS;
    entry.failures = [];
  }
  clients.set(key, entry);
}

export function recordAuthSuccess(key: string): void {
  clients.delete(key);
}

// Test support: the module state is otherwise private per process.
export function resetAuthThrottle(): void {
  clients.clear();
}
