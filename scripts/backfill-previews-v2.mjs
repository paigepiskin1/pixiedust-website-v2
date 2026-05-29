/**
 * Backfill preview_image / preview_video on remote D1 using Cloudflare REST API.
 * Run: node scripts/backfill-previews-v2.mjs
 */
// Secrets come from env only (loaded from .dev.vars). Run via:
//   node scripts/dev.mjs node scripts/backfill-previews-v2.mjs
const DB_ID   = process.env.CF_D1_DATABASE_ID || "105e2276-0d51-430a-8c6f-b4f7ee699aaf";
const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID || "15149dc8d99998b6c96a67c2cf52ad7c";
const TOKEN   = process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN;
if (!TOKEN) {
  console.error("Missing CLOUDFLARE_API_TOKEN in env.\nRun via: node scripts/dev.mjs node scripts/backfill-previews-v2.mjs");
  process.exit(1);
}

async function query(sql) {
  const r = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/d1/database/${DB_ID}/query`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ sql }),
    }
  );
  const d = await r.json();
  if (!d.success) throw new Error(JSON.stringify(d.errors));
  return d.result?.[0]?.results ?? [];
}

// 1. Get all completed gens grouped by template (pick most recent per template)
const gens = await query(`
  SELECT template_id, type, output_url
  FROM generations
  WHERE status = 'completed'
    AND output_url IS NOT NULL
    AND output_url != ''
  ORDER BY created_at DESC
`);

// Build map: template_id → { output_url, type }
const genMap = new Map();
for (const g of gens) {
  if (!genMap.has(g.template_id)) genMap.set(g.template_id, g);
}
console.log(`Found ${genMap.size} distinct templates with completed generations`);

// 2. Get all templates (to know their type and current preview state)
const templates = await query(`
  SELECT id, type, preview_image, preview_video
  FROM templates
  ORDER BY id
`);
console.log(`Total templates: ${templates.length}`);

// 3. Update templates missing a preview
let updated = 0;
let skipped = 0;
for (const tpl of templates) {
  const hasPrev = (tpl.preview_image && tpl.preview_image !== "") ||
                  (tpl.preview_video && tpl.preview_video !== "");
  if (hasPrev) { skipped++; continue; }

  const gen = genMap.get(tpl.id);
  if (!gen) { skipped++; continue; }

  const url    = gen.output_url;
  const isVideo = tpl.type === "video" || /\.(mp4|webm|mov)(\?|$)/i.test(url);
  const col    = isVideo ? "preview_video" : "preview_image";

  await query(`UPDATE templates SET ${col} = '${url.replace(/'/g, "''")}' WHERE id = '${tpl.id.replace(/'/g, "''")}'`);
  console.log(`  ✓ ${tpl.id} → ${col}`);
  updated++;
}

console.log(`\nBackfill complete: ${updated} updated, ${skipped} skipped (already had preview or no gen)`);
