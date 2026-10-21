// One-time seed: copy the Help Centre content that lived in src/lib/help.ts
// into D1, so the admin becomes the source of truth.
//
//   node scripts/seed-help.mjs            # dry run, prints what it would write
//   node scripts/seed-help.mjs --apply
//
// Idempotent: rows are UPSERTed on their natural keys (category id, and
// category+slug for articles), so a re-run refreshes rather than duplicates.
// It will not clobber edits made in the admin unless --force is passed.

import { execFileSync } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSync } from "esbuild";

const APPLY = process.argv.includes("--apply");
const FORCE = process.argv.includes("--force");

// Transpile the real module rather than re-typing its content: the seed has to
// be exactly what the site has been serving.
const here = dirname(fileURLToPath(import.meta.url));
const out = join(mkdtempSync(join(tmpdir(), "pd-help-")), "help.mjs");
buildSync({
  entryPoints: [join(here, "..", "src", "lib", "help.ts")],
  outfile: out,
  format: "esm",
  platform: "node",
  bundle: false,
});
const { HELP_CATEGORIES, popularArticles } = await import(`file://${out.replace(/\\/g, "/")}`);

const popular = new Set(popularArticles().map((a) => `${a.categoryId}/${a.slug}`));
const esc = (s) => String(s).replace(/'/g, "''");

const statements = [];
let catN = 0;
let artN = 0;

HELP_CATEGORIES.forEach((c, ci) => {
  catN++;
  statements.push(
    `INSERT INTO help_categories (id, title, icon, blurb, sort_order, status)
     VALUES ('${esc(c.id)}', '${esc(c.title)}', '${esc(c.icon)}', '${esc(c.blurb)}', ${ci}, 'published')
     ON CONFLICT(id) DO UPDATE SET ${
       FORCE
         ? `title = excluded.title, icon = excluded.icon, blurb = excluded.blurb, sort_order = excluded.sort_order, updated_at = datetime('now')`
         : `sort_order = excluded.sort_order`
     };`
  );

  c.articles.forEach((a, ai) => {
    artN++;
    const key = `${c.id}/${a.slug}`;
    statements.push(
      `INSERT INTO help_articles (category_id, slug, title, summary, body_json, sort_order, status, popular)
       VALUES ('${esc(c.id)}', '${esc(a.slug)}', '${esc(a.title)}', '${esc(a.summary)}',
               '${esc(JSON.stringify(a.body))}', ${ai}, 'published', ${popular.has(key) ? 1 : 0})
       ON CONFLICT(category_id, slug) DO UPDATE SET ${
         FORCE
           ? `title = excluded.title, summary = excluded.summary, body_json = excluded.body_json,
              sort_order = excluded.sort_order, popular = excluded.popular, updated_at = datetime('now')`
           : `sort_order = excluded.sort_order`
       };`
    );
  });
});

console.log(`${catN} categories, ${artN} articles`);
HELP_CATEGORIES.forEach((c) =>
  console.log(`  ${c.id.padEnd(18)} ${String(c.articles.length).padStart(2)} articles  ${c.title}`)
);

if (!APPLY) {
  console.log("\nDry run. Re-run with --apply to write.");
  process.exit(0);
}

const dir = mkdtempSync(join(tmpdir(), "pd-"));
const file = join(dir, "seed.sql");
writeFileSync(file, statements.join("\n"), "utf8");
execFileSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["wrangler", "d1", "execute", "pixiedust", "--remote", "--file", file],
  { encoding: "utf8", stdio: "inherit", maxBuffer: 64 * 1024 * 1024 }
);
console.log("Seeded.");
