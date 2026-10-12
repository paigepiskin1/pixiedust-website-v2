// Verify the D1 Help Centre content matches the original src/lib/help.ts
// exactly: same articles, same titles, same summaries, byte-identical bodies.
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildSync } from "esbuild";

const outDir = mkdtempSync(join(tmpdir(), "pd-v-"));
const out = join(outDir, "help.mjs");
buildSync({
  entryPoints: ["src/lib/help.ts"],
  outfile: out,
  format: "esm",
  platform: "node",
  bundle: false,
});
const href = "file://" + out.split("\\").join("/");
const { HELP_CATEGORIES } = await import(href);

const raw = execFileSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  [
    "wrangler", "d1", "execute", "pixiedust", "--remote", "--json",
    "--command", "SELECT category_id, slug, title, summary, body_json FROM help_articles;",
  ],
  { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
);
const lines = raw.split(/\r?\n/);
const start = lines.findIndex((l) => l.trim() === "[");
const rows = JSON.parse(lines.slice(start).join("\n"))[0].results;
const db = new Map(rows.map((r) => [r.category_id + "/" + r.slug, r]));

let missing = 0, differing = 0, identical = 0, srcChars = 0, dbChars = 0;
const seen = new Set();

for (const c of HELP_CATEGORIES) {
  for (const a of c.articles) {
    const key = c.id + "/" + a.slug;
    seen.add(key);
    const r = db.get(key);
    const srcBody = JSON.stringify(a.body);
    srcChars += srcBody.length;
    if (!r) {
      console.log("  MISSING FROM D1:", key);
      missing++;
      continue;
    }
    dbChars += (r.body_json || "").length;
    const titleSame = r.title === a.title;
    const sumSame = (r.summary || "") === (a.summary || "");
    const bodySame = r.body_json === srcBody;
    if (titleSame && sumSame && bodySame) identical++;
    else {
      differing++;
      const why = [];
      if (!titleSame) why.push("title");
      if (!sumSame) why.push("summary");
      if (!bodySame) why.push(`body ${srcBody.length}->${(r.body_json || "").length} chars`);
      console.log("  DIFFERS:", key, "(" + why.join(", ") + ")");
    }
  }
}

const extra = rows.filter((r) => !seen.has(r.category_id + "/" + r.slug));
const srcCount = HELP_CATEGORIES.reduce((n, c) => n + c.articles.length, 0);

console.log("");
console.log("  source : " + HELP_CATEGORIES.length + " categories, " + srcCount + " articles");
console.log("  in D1  : " + new Set(rows.map((r) => r.category_id)).size + " categories, " + rows.length + " articles");
console.log("");
console.log("  byte-identical : " + identical);
console.log("  differing      : " + differing);
console.log("  missing from D1: " + missing);
console.log("  extra in D1     : " + extra.length + (extra.length ? " -> " + extra.map((r) => r.category_id + "/" + r.slug).join(", ") : ""));
console.log("  body characters : source " + srcChars + "  vs  D1 " + dbChars);
console.log("");
console.log(missing === 0 && differing === 0 ? "  RESULT: all content preserved exactly." : "  RESULT: discrepancies above.");
