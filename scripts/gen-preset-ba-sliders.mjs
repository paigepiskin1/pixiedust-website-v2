#!/usr/bin/env node
/**
 * Generate before/after slider preview videos for presets and set them as
 * catalog thumbnails (preview_video + preview_image poster).
 *
 * Behavior: play wipe once in view → freeze on after → replay from start on hover.
 *
 * Usage:
 *   node scripts/dev.mjs node scripts/gen-preset-ba-sliders.mjs
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";

const SYNCNODE_KEY = process.env.SYNCNODE_API_KEY;
const DB_ID = process.env.CF_D1_DATABASE_ID || "105e2276-0d51-430a-8c6f-b4f7ee699aaf";
const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID || "15149dc8d99998b6c96a67c2cf52ad7c";
const CF_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const ZONE = process.env.BUNNY_STORAGE_ZONE || "pixiecdn";
const BKEY = process.env.BUNNY_API_KEY;
const PULL = (process.env.BUNNY_PULL_ZONE_URL || "https://pixiecdn.b-cdn.net").replace(/\/$/, "");

const SUBJECTS = [
  "https://pixiecdn.b-cdn.net/gen_d80b0323-9f76-44ee-bb08-a6aed948e196_1784545434857.png",
  "https://pixiecdn.b-cdn.net/gen_d80b0323-9f76-44ee-bb08-a6aed948e196_1784460312296.png",
  "https://pixiecdn.b-cdn.net/gen_d80b0323-9f76-44ee-bb08-a6aed948e196_1785163341156.png",
];

// kodak-gold built via join to avoid environment string mangling in some shells/editors
const KODAK_GOLD = ["kodak", "-", "gold"].join("");

const IDS = [
  "subway-platform-copy-2-copy-copy-copy",
  "polaroid-instant",
  KODAK_GOLD,
  "cinestill-night",
  "preset-fisheye-ultra-wide",
  "preset-magic-hour-flare",
  "preset-fisheye-peephole",
  "preset-portrait-50mm",
  "preset-anamorphic-flare",
  "subway-platform-copy-2-copy-copy-copy-3",
  "preset-disposable-flash",
];

if (!SYNCNODE_KEY || !CF_TOKEN || !BKEY) {
  console.error("Missing SYNCNODE_API_KEY, CLOUDFLARE_API_TOKEN, or BUNNY_API_KEY");
  process.exit(1);
}

const WORK = join(tmpdir(), `ba-slider-${Date.now()}`);
mkdirSync(WORK, { recursive: true });
console.log("work dir:", WORK);

async function d1(sql) {
  const r = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/d1/database/${DB_ID}/query`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${CF_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ sql }),
    }
  );
  const d = await r.json();
  if (!d.success) throw new Error(`D1: ${JSON.stringify(d.errors)}`);
  return d.result?.[0]?.results ?? [];
}

async function submit(model, input) {
  const r = await fetch("https://run.syncnode.ai/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey: SYNCNODE_KEY, model, input }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.job_id) throw new Error(d.error || d.detail || `Submit ${r.status}`);
  return d.job_id;
}

async function poll(jobId, maxMs = 360000) {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 5000));
    const r = await fetch(
      `https://run.syncnode.ai/prediction-status?job_id=${encodeURIComponent(jobId)}&apiKey=${encodeURIComponent(SYNCNODE_KEY)}`
    );
    const d = await r.json().catch(() => ({}));
    const st = d.replicate_status || d.task_status || d.status;
    if (["succeeded", "COMPLETED", "SUCCEEDED", "completed"].includes(st)) {
      const out = d.output;
      if (typeof out === "string") return out;
      if (Array.isArray(out) && out.length) return out[0];
      if (out?.url) return out.url;
      if (Array.isArray(out?.images) && out.images.length) return out.images[0]?.url ?? out.images[0];
      throw new Error("No output URL");
    }
    if (["failed", "FAILED", "CANCELED", "error"].includes(st)) {
      throw new Error(`Job failed: ${d.error || d.output || "unknown"}`);
    }
  }
  throw new Error("Timed out");
}

async function download(url, dest) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Download ${url} → ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  writeFileSync(dest, buf);
  // Normalize to PNG via ffmpeg (handles webp)
  if (!dest.endsWith(".png") || buf.slice(0, 4).toString() !== "\x89PNG") {
    const png = dest.replace(/\.[^.]+$/, "") + ".norm.png";
    const res = spawnSync("ffmpeg", ["-y", "-i", dest, png], { encoding: "utf8" });
    if (res.status !== 0 || !existsSync(png)) {
      throw new Error(`ffmpeg convert failed: ${res.stderr?.slice(-200)}`);
    }
    return png;
  }
  return dest;
}

async function uploadBunny(localPath, remotePath, contentType) {
  const body = readFileSync(localPath);
  const r = await fetch(`https://storage.bunnycdn.com/${ZONE}/${remotePath}`, {
    method: "PUT",
    headers: { AccessKey: BKEY, "Content-Type": contentType },
    body,
  });
  if (!r.ok) throw new Error(`Bunny upload ${remotePath}: ${r.status} ${await r.text()}`);
  return `${PULL}/${remotePath}`;
}

function prepareInput(raw, subjectUrl) {
  const input = JSON.parse(raw);
  if (input.aspect_ratio === "{{aspect}}" || !input.aspect_ratio) input.aspect_ratio = "1:1";
  if ("input_images" in input) input.input_images = [subjectUrl];
  if ("image_input" in input) input.image_input = [subjectUrl];
  if ("image" in input && typeof input.image === "string") input.image = subjectUrl;
  input.moderation = input.moderation || "low";
  return input;
}

/** Soften prompt wording that often trips GPT Image safety filters. */
function softenPrompt(input) {
  const next = { ...input };
  if (typeof next.prompt === "string") {
    next.prompt = next.prompt
      .replace(/\bsexy\b/gi, "stylish")
      .replace(/\bseductive\b/gi, "confident")
      .replace(/\bnude\b/gi, "fully clothed")
      .replace(/\bnaked\b/gi, "fully clothed")
      .replace(/\bcleavage\b/gi, "neckline")
      .replace(/\bskin-tight\b/gi, "fitted");
  }
  return next;
}

/** Build a one-way before→after wipe MP4 + after still poster (for play-once + hover replay). */
function buildSlider(beforePng, afterPng, outBase) {
  const mp4 = `${outBase}.mp4`;
  const gif = `${outBase}.gif`;
  const poster = `${outBase}-poster.jpg`;
  const framesDir = `${outBase}-frames`;
  mkdirSync(framesDir, { recursive: true });

  const py = `
from PIL import Image, ImageDraw
import os
SIZE = 720
FPS = 16
WAY = 1.4
HOLD_BEFORE = 0.35
HOLD_AFTER = 0.55
before = Image.open(${JSON.stringify(beforePng)}).convert("RGB")
after = Image.open(${JSON.stringify(afterPng)}).convert("RGB")
def fit(im):
    im = im.copy()
    im.thumbnail((SIZE, SIZE), Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", (SIZE, SIZE), (12,12,14))
    canvas.paste(im, ((SIZE-im.width)//2, (SIZE-im.height)//2))
    return canvas
b, a = fit(before), fit(after)
steps = max(2, int(WAY * FPS))
hb = int(HOLD_BEFORE * FPS)
ha = int(HOLD_AFTER * FPS)
def ease(t):
    return t*t*(3-2*t)
seq = [0.0]*hb + [ease(i/(steps-1)) for i in range(steps)] + [1.0]*ha
for i, p in enumerate(seq):
    x = max(0, min(SIZE, int(round(p * SIZE))))
    frame = b.copy()
    if x > 0:
        frame.paste(a.crop((0,0,x,SIZE)), (0,0))
    d = ImageDraw.Draw(frame)
    d.line([(x,0),(x,SIZE)], fill=(255,255,255), width=3)
    cy = SIZE//2
    d.ellipse([x-10, cy-18, x+10, cy+18], fill=(255,255,255), outline=(20,20,24))
    path = os.path.join(${JSON.stringify(framesDir)}, f"f{i:04d}.png")
    frame.save(path, "PNG")
a.save(${JSON.stringify(poster)}, quality=90)
print(len(seq))
`;
  const pyFile = `${outBase}-mkframes.py`;
  writeFileSync(pyFile, py);
  const rp = spawnSync("python3", [pyFile], { encoding: "utf8" });
  if (rp.status !== 0) throw new Error(`frames failed: ${rp.stderr || rp.stdout}`);

  const r1 = spawnSync(
    "ffmpeg",
    [
      "-y",
      "-framerate", "16",
      "-i", `${framesDir}/f%04d.png`,
      "-c:v", "libx264",
      "-pix_fmt", "yuv420p",
      "-movflags", "+faststart",
      "-an",
      mp4,
    ],
    { encoding: "utf8" }
  );
  if (r1.status !== 0) throw new Error(`mp4 failed: ${r1.stderr?.slice(-400)}`);

  const r2 = spawnSync(
    "ffmpeg",
    [
      "-y",
      "-i",
      mp4,
      "-vf",
      "fps=10,scale=540:540:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=160[p];[s1][p]paletteuse=dither=bayer",
      "-loop",
      "0",
      gif,
    ],
    { encoding: "utf8" }
  );
  if (r2.status !== 0) throw new Error(`gif failed: ${r2.stderr?.slice(-400)}`);

  return { mp4, gif, poster };
}

function adaptForModel(input, model, subjectUrl) {
  const payload = softenPrompt({ ...input });
  if (model.includes("nano-banana")) {
    if (!payload.image_input && payload.input_images) {
      payload.image_input = payload.input_images;
      delete payload.input_images;
    }
    if (!payload.image_input) payload.image_input = [subjectUrl];
    delete payload.quality;
    delete payload.background;
    delete payload.moderation;
    delete payload.number_of_images;
    delete payload.output_compression;
    payload.output_format = payload.output_format || "jpg";
  } else if (model.includes("gpt-image")) {
    if (!payload.input_images && payload.image_input) {
      payload.input_images = payload.image_input;
      delete payload.image_input;
    }
    if (!payload.input_images) payload.input_images = [subjectUrl];
    payload.moderation = "low";
  }
  return payload;
}

async function generateAfter(t, subjectUrl) {
  const input = prepareInput(t.input_json, subjectUrl);
  // Prefer template model; fall back through safer nano-banana variants on flags/timeouts.
  const models = [t.model, "google/nano-banana", "google/nano-banana-pro"].filter(
    (m, i, arr) => m && arr.indexOf(m) === i
  );
  let lastErr;
  for (const model of models) {
    try {
      const payload = adaptForModel(input, model, subjectUrl);
      process.stdout.write(`[${model}] `);
      const jobId = await submit(model, payload);
      return await poll(jobId);
    } catch (e) {
      lastErr = e;
      console.log(`\n    retry failed (${model}): ${String(e.message).slice(0, 140)}`);
      process.stdout.write("  ");
    }
  }
  throw lastErr || new Error("generate failed");
}

// Pre-download all subjects
const subjectPngs = {};
for (let i = 0; i < SUBJECTS.length; i++) {
  const url = SUBJECTS[i];
  const raw = join(WORK, `subject-${i}.bin`);
  subjectPngs[url] = await download(url, raw);
  console.log(`subject[${i}]:`, subjectPngs[url]);
}

const rows = await d1(
  `SELECT id, title, model, input_json FROM templates WHERE id IN (${IDS.map((i) => `'${i}'`).join(",")})`
);
const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
console.log(`loaded ${rows.length}/${IDS.length} templates`);

const results = {};
let ok = 0;
let fail = 0;

for (let i = 0; i < IDS.length; i++) {
  const id = IDS[i];
  const subjectUrl = SUBJECTS[i % SUBJECTS.length];
  const beforePng = subjectPngs[subjectUrl];
  const t = byId[id];
  if (!t) {
    console.log(`skip ${id} (missing)`);
    fail++;
    continue;
  }
  process.stdout.write(`\n${t.title} (${id})\n  subject: ${subjectUrl.split("/").pop()}\n  generate … `);
  try {
    const afterUrl = await generateAfter(t, subjectUrl);
    console.log(`✓ ${afterUrl}`);

    const afterRaw = join(WORK, `${id}-after.bin`);
    const afterPng = await download(afterUrl, afterRaw);
    process.stdout.write("  slider … ");
    const outBase = join(WORK, id);
    const { mp4, poster } = buildSlider(beforePng, afterPng, outBase);
    console.log("✓");

    process.stdout.write("  upload … ");
    const stamp = Date.now();
    const videoUrl = await uploadBunny(
      mp4,
      `media/templates/ba-sliders/${id}-${stamp}.mp4`,
      "video/mp4"
    );
    const posterUrl = await uploadBunny(
      poster,
      `media/templates/ba-sliders/${id}-${stamp}-after.jpg`,
      "image/jpeg"
    );
    console.log("✓");

    await d1(
      `UPDATE templates SET
        preview_video = '${videoUrl.replace(/'/g, "''")}',
        preview_image = '${posterUrl.replace(/'/g, "''")}',
        updated_at = datetime('now')
      WHERE id = '${id}'`
    );

    results[id] = { afterUrl, videoUrl, posterUrl, subjectUrl };
    console.log(`  video:  ${videoUrl}`);
    console.log(`  poster: ${posterUrl}`);
    ok++;
  } catch (e) {
    console.log(`✗ ${String(e.message).slice(0, 220)}`);
    fail++;
  }
}

writeFileSync(join(WORK, "results.json"), JSON.stringify(results, null, 2));
console.log(`\nDone: ${ok} ok, ${fail} failed`);
console.log(JSON.stringify(results, null, 2));
