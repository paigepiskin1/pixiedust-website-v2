/// <reference types="astro/client" />

type Runtime = import("@astrojs/cloudflare").Runtime<Env>;

interface Env {
  // --- bindings (configured in wrangler.toml) ---
  DB: import("@cloudflare/workers-types").D1Database;
  SESSIONS: import("@cloudflare/workers-types").KVNamespace;
  ASSETS_BUCKET: import("@cloudflare/workers-types").R2Bucket;

  // --- secrets (set via `wrangler secret put` / Pages env — never committed) ---
  SYNCNODE_API_KEY: string;
  BUNNY_STORAGE_ZONE: string;
  BUNNY_API_KEY: string;
  BUNNY_PULL_ZONE_URL: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
}

declare namespace App {
  interface Locals extends Runtime {
    user: import("./lib/users").PublicUser | null;
  }
}
