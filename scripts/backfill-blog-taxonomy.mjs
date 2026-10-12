// Classify every blog post into a primary category + tags using the same rules
// the app uses at save time, so the backfill and future edits cannot disagree.
//
//   node scripts/backfill-blog-taxonomy.mjs          # dry run, prints a table
//   node scripts/backfill-blog-taxonomy.mjs --apply  # writes to remote D1
//
// Only fills what is empty: a post that already carries a category or tags is
// left alone, so re-running never overwrites an editor's correction.

import { execFileSync } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const APPLY = process.argv.includes("--apply");
const FORCE = process.argv.includes("--force");

// Node cannot import .ts directly, and duplicating the rules here would let the
// backfill and the live classifier drift apart — the one thing that must not
// happen, since a post classified by this script has to match what the app
// would produce on its next save. So transpile the real module and import that.
import { buildSync } from "esbuild";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const compiled = join(mkdtempSync(join(tmpdir(), "pd-tax-")), "taxonomy.mjs");
buildSync({
  entryPoints: [join(here, "..", "src", "lib", "blog-taxonomy.ts")],
  outfile: compiled,
  format: "esm",
  platform: "node",
  bundle: false,
});
const { classify } = await import(`file://${compiled.replace(/\\/g, "/")}`);

/** `--file` only ever reports a summary ("Total queries executed", "Rows read"),
 *  never the rows themselves, so reads must go through `--command`. Writes use
 *  `--file` because a multi-statement batch is too long for an argv. */
function d1(sql, { json = true, viaFile = !json } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "pd-"));
  const file = join(dir, "q.sql");
  if (viaFile) writeFileSync(file, sql, "utf8");
  const out = execFileSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    [
      "wrangler", "d1", "execute", "pixiedust", "--remote",
      ...(json ? ["--json"] : []),
      ...(viaFile ? ["--file", file] : ["--command", sql]),
    ],
    {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      env: {
        ...process.env,
        CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID,
        CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN,
      },
    }
  );
  if (!json) return out;
  // wrangler prints advisory banners before the payload, and those can contain
  // "[" (e.g. "[boolean] [default: false]"). Anchor on a line that is exactly
  // "[" instead of the first bracket anywhere in the stream.
  const lines = out.split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim() === "[");
  if (start === -1) throw new Error(`No JSON payload in wrangler output:\n${out.slice(0, 400)}`);
  return JSON.parse(lines.slice(start).join("\n"));
}

const esc = (s) => String(s).replace(/'/g, "''");
const textOf = (html) =>
  String(html || "")
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const rows = d1(
  "SELECT id, title, excerpt, content_html, category, tags_json, status FROM blog_posts ORDER BY id;"
)[0].results;

console.log(`${rows.length} posts\n`);

const updates = [];
let skipped = 0;

for (const r of rows) {
  const hasCategory = !!r.category;
  let hasTags = false;
  try {
    hasTags = (JSON.parse(r.tags_json || "[]") || []).length > 0;
  } catch {}

  if (!FORCE && hasCategory && hasTags) {
    skipped++;
    continue;
  }

  const { category, tags } = classify(r.title || "", r.excerpt || "", textOf(r.content_html));
  const nextCategory = FORCE ? category : r.category || category;
  const nextTags = FORCE || !hasTags ? tags : JSON.parse(r.tags_json || "[]");

  console.log(
    String(r.id).padStart(3),
    (nextCategory || "—").padEnd(12),
    (nextTags.join(", ") || "—").padEnd(44).slice(0, 44),
    String(r.title).slice(0, 46)
  );

  if (nextCategory || nextTags.length) {
    updates.push(
      `UPDATE blog_posts SET category = ${nextCategory ? `'${esc(nextCategory)}'` : "NULL"}, ` +
        `tags_json = '${esc(JSON.stringify(nextTags))}' WHERE id = ${r.id};`
    );
  }
}

console.log(`\n${updates.length} to update, ${skipped} already classified`);

if (!APPLY) {
  console.log("\nDry run. Re-run with --apply to write.");
  process.exit(0);
}

d1(updates.join("\n"), { json: false });
console.log("Applied.");
