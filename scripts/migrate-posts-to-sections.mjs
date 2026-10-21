// Move blog posts that are really section content into their section.
//
//   node scripts/migrate-posts-to-sections.mjs          # dry run
//   node scripts/migrate-posts-to-sections.mjs --apply
//
// The AR case studies and press mentions were written as blog posts, but they
// are sub-pages of the AR Effects Archive and Press & Media sections. This
// copies them across, preserving slug, body, image, tags and — importantly —
// published_at, so anything scheduled still goes live on its own date in its
// new home.
//
// Posts that are already live are reported and skipped by default: moving a
// published URL needs a redirect, which is a separate decision. Pass
// --include-live to move them anyway.

import { execFileSync } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const APPLY = process.argv.includes("--apply");
const INCLUDE_LIVE = process.argv.includes("--include-live");

// blog category -> collection id
const MAP = {
  "ar-work": "ar-effects",
  press: "press",
};

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
    { encoding: "utf8", maxBuffer: 128 * 1024 * 1024 }
  );
  if (!json) return out;
  const lines = out.split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim() === "[");
  if (start === -1) throw new Error("No JSON payload:\n" + out.slice(0, 400));
  return JSON.parse(lines.slice(start).join("\n"));
}

const esc = (s) => String(s ?? "").replace(/'/g, "''");
const q = (s) => (s === null || s === undefined || s === "" ? "NULL" : `'${esc(s)}'`);

const cats = Object.keys(MAP).map((c) => `'${c}'`).join(",");
// Kept on one line: a multi-line string passed through --command is mangled
// before it reaches D1, which reports "incomplete input".
const SELECT_SQL =
  "SELECT id, slug, title, excerpt, content_html, thumbnail_url, thumbnail_alt, tags_json, status, published_at, category, " +
  "(status='published' AND published_at IS NOT NULL AND published_at <= datetime('now')) AS is_live " +
  `FROM blog_posts WHERE category IN (${cats}) ORDER BY category, id;`;

const rows = d1(SELECT_SQL)[0].results;

const live = rows.filter((r) => r.is_live === 1);
const movable = INCLUDE_LIVE ? rows : rows.filter((r) => r.is_live !== 1);

console.log(`${rows.length} posts in section categories`);
for (const [cat, col] of Object.entries(MAP)) {
  const n = movable.filter((r) => r.category === cat).length;
  console.log(`  ${cat.padEnd(10)} -> ${col.padEnd(12)} ${n} to move`);
}
if (live.length) {
  console.log(`\n  ${live.length} already live — skipped (moving a public URL needs a redirect).`);
  live.slice(0, 10).forEach((r) => console.log(`     /blog/${r.slug}`));
  if (!INCLUDE_LIVE) console.log("     Pass --include-live to move them too.");
}

const statements = [];
for (const r of movable) {
  const col = MAP[r.category];
  statements.push(
    `INSERT INTO collection_items
       (collection_id, slug, title, summary, content_html, hero_url, hero_alt, tags_json, status, published_at, sort_order)
     VALUES (${q(col)}, ${q(r.slug)}, ${q(r.title)}, ${q(r.excerpt)}, ${q(r.content_html)},
             ${q(r.thumbnail_url)}, ${q(r.thumbnail_alt)}, ${q(r.tags_json || "[]")},
             ${q(r.status)}, ${q(r.published_at)}, 0)
     ON CONFLICT(collection_id, slug) DO UPDATE SET
       title = excluded.title, summary = excluded.summary, content_html = excluded.content_html,
       hero_url = excluded.hero_url, tags_json = excluded.tags_json,
       status = excluded.status, published_at = excluded.published_at, updated_at = datetime('now');`
  );
  statements.push(`DELETE FROM blog_posts WHERE id = ${Number(r.id)};`);
}

console.log(`\n${movable.length} posts to move (${statements.length} statements)`);

if (!APPLY) {
  console.log("\nDry run. Re-run with --apply to write.");
  process.exit(0);
}

d1(statements.join("\n"), { json: false, viaFile: true });
console.log("Moved.");
