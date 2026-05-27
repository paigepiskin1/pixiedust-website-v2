// Dev launcher: loads .dev.vars into process.env so wrangler remote auth works,
// then spawns astro dev. Use via: npm run dev
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

const args = ["astro", "dev", ...process.argv.slice(2)];
const proc = spawn("npx", args, { stdio: "inherit", env: process.env, shell: true });
proc.on("exit", (code) => process.exit(code ?? 0));
