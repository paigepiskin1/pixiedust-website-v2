#!/usr/bin/env node
// Seed the five GPT Image 2 shoot presets into remote D1.
// Usage: node scripts/seed-shoot-presets-gpt.mjs
// Requires .dev.vars with CLOUDFLARE_API_TOKEN (loaded via scripts/dev.mjs pattern).

import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sql = join(root, "scripts/seed-shoot-presets-gpt.sql");

if (existsSync(join(root, ".dev.vars"))) {
  for (const line of readFileSync(join(root, ".dev.vars"), "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 1) continue;
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
}

if (!process.env.CLOUDFLARE_API_TOKEN && !process.env.CF_API_TOKEN) {
  console.error("Missing CLOUDFLARE_API_TOKEN. Put it in .dev.vars or the environment, then re-run.");
  process.exit(1);
}

const r = spawnSync(
  "npx",
  ["wrangler", "d1", "execute", "pixiedust", "--remote", "--file", sql],
  { cwd: root, env: process.env, stdio: "inherit", shell: true }
);
process.exit(r.status ?? 1);
