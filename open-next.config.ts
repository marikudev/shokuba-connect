import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// OpenNext adapter configuration for Cloudflare Workers. The app
// uses no Workers bindings (no KV, D1, or R2), so the default
// configuration is the whole configuration.
export default defineCloudflareConfig();
