import type { NextConfig } from "next";

// Baseline security headers for every response. The CSP keeps
// everything same-origin; 'unsafe-inline' is required for scripts
// and styles because the App Router injects inline bootstrap
// scripts and the UI uses inline style attributes (per-panel
// font-size variables) — a nonce pipeline is out of scope.
// Development additionally needs 'unsafe-eval' and
// websocket connections for React Fast Refresh / HMR, so those are
// only present when NODE_ENV=development.
const isDev = process.env.NODE_ENV === "development";

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  // The app must never be framed by another site.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "no-referrer" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
];

const nextConfig: NextConfig = {
  // Cache Components is intentionally not enabled: the app uses
  // no "use cache" directives, and its cross-request cache
  // promises cannot settle in the Workers runtime (page renders
  // hang there). Standard rendering serves every route.
  // No floating Next.js badge in the corner; it would overlay
  // the card sidebar in development.
  devIndicators: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
