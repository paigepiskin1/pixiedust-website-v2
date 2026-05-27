// Pull the current preview_image / preview_video values from the remote D1
// and write them to seed/seed-previews.sql so local devs get matching data.
// Run via:  npm run db:export-previews   (needs CLOUDFLARE_API_TOKEN env var)
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID || "15149dc8d99998b6c96a67c2cf52ad7c";
const TOKEN = process.env.CLOUDFLARE_API_TOKEN || "";
if (!TOKEN) {
  console.error("Required: CLOUDFLARE_API_TOKEN env var.  CLOUDFLARE_API_TOKEN=... npm run db:export-previews");
  process.exit(1);
}

const raw = execSync(
  `npx wrangler d1 execute pixiedust --remote --command="SELECT id, preview_image, preview_video FROM templates WHERE preview_image IS NOT NULL OR preview_video IS NOT NULL ORDER BY id;"`,
  { env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: ACCOUNT, CLOUDFLARE_API_TOKEN: TOKEN }, encoding: "utf8" }
);

const m = raw.match(/\[\s*\{[\s\S]*\}\s*\]/);
if (!m) { console.error("Could not parse wrangler output"); process.exit(1); }
const results = JSON.parse(m[0])[0].results;

const lines = [
  "-- Preview images/videos for templates. Regenerate with: npm run db:export-previews",
  "-- Applied after seed.sql. Safe to re-run (idempotent).",
  "",
];
for (const r of results) {
  const img = (r.preview_image && r.preview_image !== "null") ? JSON.stringify(r.preview_image) : "NULL";
  const vid = (r.preview_video && r.preview_video !== "null") ? JSON.stringify(r.preview_video) : "NULL";
  lines.push(`UPDATE templates SET preview_image=${img}, preview_video=${vid} WHERE id='${r.id}';`);
}
lines.push("");

writeFileSync("seed/seed-previews.sql", lines.join("\n"));
console.log(`Wrote seed/seed-previews.sql with ${results.length} preview(s).`);
console.log("Commit this file to keep all devs in sync.");
