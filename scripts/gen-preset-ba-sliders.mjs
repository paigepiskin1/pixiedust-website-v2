#!/usr/bin/env node
/**
 * Generate before/after slider preview videos for presets and set them as
 * catalog thumbnails (preview_video + preview_image poster).
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

const BEFORE_URL =
  process.env.SUBJECT_URL ||
  "https://pixiecdn.b-cdn.net/gen_d80b0323-9f76-44ee-bb08-a6aed948e196_1784545458904.png";

const IDS = [
  "old-fisheye-lens",
  "preset-y2k-digicam-flash",
  "preset-y2k-pink-webcam",
  "preset-y2k-cyber-chrome",
  "preset-night-party-flash",
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

async function poll(jobId, maxMs = 300000) {
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
    const res = spawnSync(
      "ffmpeg",
      ["-y", "-i", dest, png],
      { encoding: "utf8" }
    );
    if (res.status !== 0 || !existsSync(png)) throw new Error(`ffmpeg convert failed: ${res.stderr?.slice(-200)}`);
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

function prepareInput(raw) {
  const input = JSON.parse(raw);
  if (input.aspect_ratio === "{{aspect}}" || !input.aspect_ratio) input.aspect_ratio = "1:1";
  if ("input_images" in input) input.input_images = [BEFORE_URL];
  if ("image_input" in input) input.image_input = [BEFORE_URL];
  if ("image" in input && typeof input.image === "string") input.image = BEFORE_URL;
  input.moderation = input.moderation || "low";
  return input;
}

/** Build a looping before→after→before wipe slider MP4 + GIF + poster. */
function buildSlider(beforePng, afterPng, outBase) {
  const mp4 = `${outBase}.mp4`;
  const gif = `${outBase}.gif`;
  const poster = `${outBase}-poster.jpg`;
  const framesDir = `${outBase}-frames`;
  mkdirSync(framesDir, { recursive: true });

  // Render classic slider frames in Python (white divider + ping-pong).
  const py = `
from PIL import Image, ImageDraw
import math, os
SIZE = 720
FPS = 16
# one way duration in seconds
WAY = 1.35
HOLD = 0.35
before = Image.open(${JSON.stringify(beforePng)}).convert("RGB")
after = Image.open(${JSON.stringify(afterPng)}).convert("RGB")
def fit(im):
    im = im.copy()
    im.thumbnail((SIZE, SIZE), Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", (SIZE, SIZE), (12,12,14))
    canvas.paste(im, ((SIZE-im.width)//2, (SIZE-im.height)//2))
    return canvas
b, a = fit(before), fit(after)
frames = []
# progress 0→1→0
steps = int(WAY * FPS)
hold = int(HOLD * FPS)
def ease(t):
    # smoothstep
    return t*t*(3-2*t)
seq = [0.0]*hold + [ease(i/(steps-1)) for i in range(steps)] + [1.0]*hold + [ease(1-i/(steps-1)) for i in range(steps)] + [0.0]*hold
for i, p in enumerate(seq):
    x = max(0, min(SIZE, int(round(p * SIZE))))
    frame = b.copy()
    if x > 0:
        frame.paste(a.crop((0,0,x,SIZE)), (0,0))
    d = ImageDraw.Draw(frame)
    # divider + small handle
    d.line([(x,0),(x,SIZE)], fill=(255,255,255), width=3)
    cy = SIZE//2
    d.ellipse([x-10, cy-18, x+10, cy+18], fill=(255,255,255), outline=(20,20,24))
    path = os.path.join(${JSON.stringify(framesDir)}, f"f{i:04d}.png")
    frame.save(path, "PNG")
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
      "-y", "-i", mp4,
      "-vf", "fps=10,scale=540:540:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=160[p];[s1][p]paletteuse=dither=bayer",
      "-loop", "0",
      gif,
    ],
    { encoding: "utf8" }
  );
  if (r2.status !== 0) throw new Error(`gif failed: ${r2.stderr?.slice(-400)}`);

  // Mid wipe frame as poster
  const mid = join(framesDir, "f0020.png");
  const r3 = spawnSync(
    "ffmpeg",
    ["-y", "-i", existsSync(mid) ? mid : mp4, "-frames:v", "1", "-q:v", "3", poster],
    { encoding: "utf8" }
  );
  if (r3.status !== 0) throw new Error(`poster failed: ${r3.stderr?.slice(-200)}`);

  return { mp4, gif, poster };
}

// Download before
const beforeRaw = join(WORK, "before-src.bin");
const beforePng = await download(BEFORE_URL, beforeRaw);
console.log("before:", beforePng);

const rows = await d1(
  `SELECT id, title, model, input_json FROM templates WHERE id IN (${IDS.map((i) => `'${i}'`).join(",")})`
);
const byId = Object.fromEntries(rows.map((r) => [r.id, r]));

// Optional cache of already-generated afters (from a prior partial run).
const AFTER_CACHE = {
  "old-fisheye-lens":
    "https://pixiecdn.b-cdn.net/gen_d80b0323-9f76-44ee-bb08-a6aed948e196_1785501615497.jpg",
  "preset-y2k-digicam-flash":
    "https://pixiecdn.b-cdn.net/gen_d80b0323-9f76-44ee-bb08-a6aed948e196_1785501644738.png",
};

const results = {};
let ok = 0;
let fail = 0;

async function generateAfter(t) {
  if (AFTER_CACHE[t.id]) return AFTER_CACHE[t.id];
  const input = prepareInput(t.input_json);
  // Prefer template model; on sensitive flag, fall back to nano-banana-pro.
  const models = [t.model, "google/nano-banana-pro"].filter(
    (m, i, arr) => m && arr.indexOf(m) === i
  );
  let lastErr;
  for (const model of models) {
    try {
      // Adapt image field for nano-banana-pro if needed
      const payload = { ...input };
      if (model.includes("nano-banana")) {
        if (!payload.image_input && payload.input_images) {
          payload.image_input = payload.input_images;
          delete payload.input_images;
        }
        delete payload.quality;
        delete payload.background;
        delete payload.moderation;
        delete payload.number_of_images;
        delete payload.output_compression;
        payload.output_format = payload.output_format || "jpg";
      }
      const jobId = await submit(model, payload);
      return await poll(jobId);
    } catch (e) {
      lastErr = e;
      console.log(`\n    retry with ${model} failed: ${e.message.slice(0, 100)}`);
    }
  }
  throw lastErr || new Error("generate failed");
}

for (const id of IDS) {
  const t = byId[id];
  if (!t) {
    console.log(`skip ${id} (missing)`);
    fail++;
    continue;
  }
  process.stdout.write(`\n${t.title} (${id})\n  generate … `);
  try {
    const afterUrl = await generateAfter(t);
    console.log(`✓ ${afterUrl}`);

    const afterRaw = join(WORK, `${id}-after.bin`);
    const afterPng = await download(afterUrl, afterRaw);
    process.stdout.write("  slider … ");
    const outBase = join(WORK, id);
    const { mp4, gif, poster } = buildSlider(beforePng, afterPng, outBase);
    console.log("✓");

    process.stdout.write("  upload … ");
    const stamp = Date.now();
    const videoUrl = await uploadBunny(mp4, `media/templates/ba-sliders/${id}-${stamp}.mp4`, "video/mp4");
    const gifUrl = await uploadBunny(gif, `media/templates/ba-sliders/${id}-${stamp}.gif`, "image/gif");
    const posterUrl = await uploadBunny(poster, `media/templates/ba-sliders/${id}-${stamp}-poster.jpg`, "image/jpeg");
    const afterStill = await uploadBunny(afterPng, `media/templates/ba-sliders/${id}-${stamp}-after.png`, "image/png");
    console.log("✓");

    // preview_video = looping wipe MP4 (catalog autoplays)
    // preview_image = GIF so <img> surfaces also animate
    await d1(
      `UPDATE templates SET
        preview_video = '${videoUrl.replace(/'/g, "''")}',
        preview_image = '${gifUrl.replace(/'/g, "''")}',
        updated_at = datetime('now')
      WHERE id = '${id}'`
    );

    results[id] = { afterUrl, videoUrl, gifUrl, posterUrl, afterStill };
    console.log(`  video: ${videoUrl}`);
    console.log(`  gif:   ${gifUrl}`);
    ok++;
  } catch (e) {
    console.log(`✗ ${e.message.slice(0, 220)}`);
    fail++;
  }
}

writeFileSync(join(WORK, "results.json"), JSON.stringify(results, null, 2));
console.log(`\nDone: ${ok} ok, ${fail} failed`);
console.log(JSON.stringify(results, null, 2));
