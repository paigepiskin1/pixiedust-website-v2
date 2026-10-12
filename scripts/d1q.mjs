// Read-only query helper for the remote D1, printing rows as a table.
//
//   node scripts/d1q.mjs "SELECT ..."          # SQL as an argument
//   node scripts/d1q.mjs --file query.sql      # or from a file
//   node scripts/d1q.mjs --local "SELECT ..."  # against the local dev database
//
// Exists because passing SQL through a shell into `wrangler --command` breaks
// on quotes, brackets and `||`, and multi-line SQL is reported by D1 as
// "incomplete input". execFileSync hands the string over untouched.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const local = args.includes("--local");
const fileIdx = args.indexOf("--file");
const sql = (fileIdx >= 0 ? readFileSync(args[fileIdx + 1], "utf8") : args.filter((a) => !a.startsWith("--")).join(" "))
  .replace(/\s+/g, " ")
  .trim();

if (!sql) {
  console.error('usage: node scripts/d1q.mjs [--local] "SELECT ..."');
  process.exit(1);
}
// Guard: this helper is for looking, not changing.
if (!/^\s*(SELECT|WITH|PRAGMA|EXPLAIN)\b/i.test(sql)) {
  console.error("d1q is read-only: only SELECT / WITH / PRAGMA / EXPLAIN are allowed.");
  process.exit(1);
}

const out = execFileSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["wrangler", "d1", "execute", "pixiedust", local ? "--local" : "--remote", "--json", "--command", sql],
  { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] }
);
const lines = out.split(/\r?\n/);
const start = lines.findIndex((l) => l.trim() === "[");
const rows = JSON.parse(lines.slice(start).join("\n"))[0].results ?? [];

if (!rows.length) {
  console.log("(no rows)");
  process.exit(0);
}
const cols = Object.keys(rows[0]);
const width = Object.fromEntries(
  cols.map((c) => [c, Math.min(60, Math.max(c.length, ...rows.map((r) => String(r[c] ?? "NULL").length)))])
);
const fmt = (r) => cols.map((c) => String(r[c] ?? "NULL").slice(0, 60).padEnd(width[c])).join("  ");
console.log(fmt(Object.fromEntries(cols.map((c) => [c, c]))));
console.log(cols.map((c) => "-".repeat(width[c])).join("  "));
rows.forEach((r) => console.log(fmt(r)));
console.log(`(${rows.length} row${rows.length === 1 ? "" : "s"})`);
