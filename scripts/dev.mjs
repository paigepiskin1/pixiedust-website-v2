// Env loader + command runner. Loads .dev.vars into process.env (so wrangler
// remote auth works), then runs any command. Used by all npm scripts that need
// Cloudflare credentials. Usage: node scripts/dev.mjs [cmd args...]
// Defaults to: astro dev
import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";

try {
  for (const line of readFileSync(".dev.vars", "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 1) continue;
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
} catch {}

const userArgs = process.argv.slice(2);
const args = userArgs.length ? userArgs : ["astro", "dev"];

// node/npx are system binaries — run directly. Everything else goes through npx.
const [bin, ...rest] = ["node", "npx"].includes(args[0]) ? args : ["npx", ...args];
const proc = spawn(bin, rest, { stdio: "inherit", env: process.env, shell: true });
proc.on("exit", (code) => process.exit(code ?? 0));
