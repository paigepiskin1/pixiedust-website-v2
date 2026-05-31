/**
 * One-time: re-encode template preview videos to be web-optimized for fast
 * mobile load — +faststart (moov at front → instant playback), capped to 1080p,
 * CRF 24, audio stripped (previews autoplay muted). Uploads the optimized file
 * to Bunny and repoints templates.preview_video. Originals are left in place.
 *
 * Run: FFMPEG="C:/Users/AIGEN/ffmpeg/ffmpeg.exe" node scripts/dev.mjs node scripts/optimize-preview-videos.mjs
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const FFMPEG = process.env.FFMPEG || "ffmpeg";
const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID || "15149dc8d99998b6c96a67c2cf52ad7c";
const DB_ID = process.env.CF_D1_DATABASE_ID || "105e2276-0d51-430a-8c6f-b4f7ee699aaf";
const CF = process.env.CLOUDFLARE_API_TOKEN;
const ZONE = process.env.BUNNY_STORAGE_ZONE;
const BKEY = process.env.BUNNY_API_KEY;
const PULL = (process.env.BUNNY_PULL_ZONE_URL || "https://pixiecdn.b-cdn.net").replace(/\/$/, "");
const STORAGE = "https://storage.bunnycdn.com";

if (!CF || !ZONE || !BKEY) {
  console.error("Missing CLOUDFLARE_API_TOKEN / BUNNY_STORAGE_ZONE / BUNNY_API_KEY in env.");
  process.exit(1);
}

async function d1(sql, params) {
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/d1/database/${DB_ID}/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${CF}`, "Content-Type": "application/json" },
    body: JSON.stringify(params ? { sql, params } : { sql }),
  });
  const d = await r.json();
  if (!d.success) throw new Error(JSON.stringify(d.errors));
  return d.result?.[0]?.results ?? [];
}

const mb = (n) => (n / 1048576).toFixed(2) + "MB";

async function run() {
  const rows = await d1("SELECT id, preview_video FROM templates WHERE preview_video IS NOT NULL AND preview_video LIKE '%.mp4'");
  console.log(`Optimizing ${rows.length} preview videos…\n`);
  const tmp = os.tmpdir();
  let okCount = 0, savedTotal = 0;

  for (const t of rows) {
    const src = t.preview_video;
    if (/-opt\.mp4$/.test(src)) { console.log(`  skip (already optimized)  ${t.id}`); continue; }
    const inFile = path.join(tmp, `pv_in_${t.id}.mp4`);
    const outFile = path.join(tmp, `pv_out_${t.id}.mp4`);
    try {
      const buf = Buffer.from(await (await fetch(src)).arrayBuffer());
      fs.writeFileSync(inFile, buf);
      const before = buf.length;

      const args = ["-y", "-i", inFile, "-an",
        "-vf", "scale='min(1080,iw)':-2",
        "-c:v", "libx264", "-profile:v", "high", "-pix_fmt", "yuv420p",
        "-crf", "24", "-preset", "veryfast", "-movflags", "+faststart", outFile];
      const res = spawnSync(FFMPEG, args, { stdio: ["ignore", "ignore", "pipe"] });
      if (res.status !== 0 || !fs.existsSync(outFile)) {
        console.log(`  ❌ ffmpeg failed  ${t.id}  ${String(res.stderr || "").split("\n").slice(-3).join(" ").slice(0, 120)}`);
        continue;
      }
      const outBuf = fs.readFileSync(outFile);
      const after = outBuf.length;

      const newPath = new URL(src).pathname.replace(/^\//, "").replace(/\.(mp4|mov|webm)$/i, "-opt.mp4");
      const up = await fetch(`${STORAGE}/${ZONE}/${newPath}`, {
        method: "PUT",
        headers: { AccessKey: BKEY, "Content-Type": "video/mp4" },
        body: outBuf,
      });
      if (up.status !== 201 && up.status !== 200) { console.log(`  ❌ upload ${up.status}  ${t.id}`); continue; }

      const newUrl = `${PULL}/${newPath}`;
      await d1("UPDATE templates SET preview_video = ? WHERE id = ?", [newUrl, t.id]);

      okCount++; savedTotal += before - after;
      console.log(`  ✅ ${mb(before)} → ${mb(after)}  ${t.id}`);
    } catch (e) {
      console.log(`  ❌ error  ${t.id}  ${e.message}`);
    } finally {
      try { fs.unlinkSync(inFile); } catch {}
      try { fs.unlinkSync(outFile); } catch {}
    }
  }
  console.log(`\nDone: ${okCount}/${rows.length} optimized · total saved ${mb(savedTotal)}`);
}
run().catch((e) => { console.error(e); process.exit(1); });
