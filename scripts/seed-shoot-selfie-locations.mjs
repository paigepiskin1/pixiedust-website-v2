#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sql = join(root, "scripts/seed-shoot-selfie-locations.sql");

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

const r = spawnSync(
  "npx",
  ["wrangler", "d1", "execute", "pixiedust", "--remote", "--file", sql],
  { cwd: root, env: process.env, stdio: "inherit", shell: true }
);
process.exit(r.status ?? 1);
