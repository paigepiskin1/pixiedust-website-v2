/**
 * Backfill preview_image / preview_video from existing completed generations.
 * For each template that still has no preview, find the most recent completed
 * generation and use its first output URL.
 *
 * Run: node scripts/backfill-previews.mjs [--remote]
 */
import { execSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

const isRemote = process.argv.includes("--remote");
const flag = isRemote ? "--remote" : "--local";
console.log(`Running against ${isRemote ? "REMOTE" : "local"} D1…\n`);

function runSql(sql) {
  const tmp = path.join(os.tmpdir(), `pd_sql_${Date.now()}.sql`);
  fs.writeFileSync(tmp, sql);
  try {
    const out = execSync(
      `node scripts/dev.mjs wrangler d1 execute pixiedust ${flag} --file=${tmp} --json`,
      { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 }
    );
    const m = out.match(/\[\s*\{[\s\S]*\}/);
    if (!m) return [];
    const parsed = JSON.parse(m[0] + (m[0].trimEnd().endsWith("]") ? "" : "]"));
    return parsed[0]?.results ?? [];
  } catch (e) {
    console.error("SQL error:", e.message.slice(0, 300));
    return [];
  } finally {
    fs.unlinkSync(tmp);
  }
}

function runSqlWrite(sql) {
  const tmp = path.join(os.tmpdir(), `pd_sql_${Date.now()}.sql`);
  fs.writeFileSync(tmp, sql);
  try {
    execSync(
      `node scripts/dev.mjs wrangler d1 execute pixiedust ${flag} --file=${tmp}`,
      { encoding: "utf8" }
    );
    return true;
  } catch (e) {
    console.error("SQL write error:", e.message.slice(0, 200));
    return false;
  } finally {
    fs.unlinkSync(tmp);
  }
}

// 1. Get all templates missing both previews
const missing = runSql(`
  SELECT id, type FROM templates
  WHERE (preview_image IS NULL OR preview_image = '')
    AND (preview_video IS NULL OR preview_video = '')
  ORDER BY id
`);
console.log(`Templates missing previews: ${missing.length}`);

// 2. For each, find the most recent completed generation with output_urls
let updated = 0;
let skipped = 0;

for (const tpl of missing) {
  const rows = runSql(`
    SELECT output_urls FROM generations
    WHERE template_id = '${tpl.id.replace(/'/g, "''")}'
      AND status = 'completed'
      AND output_urls IS NOT NULL
      AND output_urls != '[]'
    ORDER BY created_at DESC
    LIMIT 1
  `);

  if (!rows.length || !rows[0]?.output_urls) { skipped++; continue; }

  let urls;
  try { urls = JSON.parse(rows[0].output_urls); } catch { skipped++; continue; }
  if (!urls?.length) { skipped++; continue; }

  const url = urls[0];
  const isVideo = tpl.type === "video" || /\.(mp4|webm|mov)(\?|$)/i.test(url);
  const col = isVideo ? "preview_video" : "preview_image";

  const ok = runSqlWrite(
    `UPDATE templates SET ${col} = '${url.replace(/'/g, "''")}' WHERE id = '${tpl.id.replace(/'/g, "''")}'`
  );
  if (ok) {
    console.log(`  ✓ ${tpl.id} → ${col}`);
    updated++;
  }
}

console.log(`\nBackfill complete: ${updated} updated, ${skipped} still missing`);
