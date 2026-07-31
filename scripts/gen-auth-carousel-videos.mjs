#!/usr/bin/env node
/**
 * Build + upload sign-in left-panel montage videos:
 *  1) Preset before→after wipe showcase
 *  2) One selfie → many photoshoot scenes
 *
 * Usage: node scripts/dev.mjs node scripts/gen-auth-carousel-videos.mjs
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";

const SYNCNODE_KEY = process.env.SYNCNODE_API_KEY;
const ZONE = process.env.BUNNY_STORAGE_ZONE || "pixiecdn";
const BKEY = process.env.BUNNY_API_KEY;
const PULL = (process.env.BUNNY_PULL_ZONE_URL || "https://pixiecdn.b-cdn.net").replace(/\/$/, "");

if (!SYNCNODE_KEY || !BKEY) {
  console.error("Missing SYNCNODE_API_KEY or BUNNY_API_KEY");
  process.exit(1);
}

const WORK = join(tmpdir(), `auth-carousel-${Date.now()}`);
mkdirSync(WORK, { recursive: true });
console.log("work:", WORK);

const SUBJECT =
  "https://pixiecdn.b-cdn.net/gen_d80b0323-9f76-44ee-bb08-a6aed948e196_1785163341156.png";

const PRESET_BA = [
  {
    name: "Kodak Gold",
    before: "https://pixiecdn.b-cdn.net/gen_d80b0323-9f76-44ee-bb08-a6aed948e196_1785163341156.png",
    after: "https://pixiecdn.b-cdn.net/media/templates/ba-sliders/kodak-gold-1785511169463-after.jpg",
  },
  {
    name: "Polaroid Instant",
    before: "https://pixiecdn.b-cdn.net/gen_d80b0323-9f76-44ee-bb08-a6aed948e196_1784460312296.png",
    after: "https://pixiecdn.b-cdn.net/media/templates/ba-sliders/polaroid-instant-1785511110342-after.jpg",
  },
  {
    name: "Fisheye Ultra Wide",
    before: "https://pixiecdn.b-cdn.net/gen_d80b0323-9f76-44ee-bb08-a6aed948e196_1784460312296.png",
    after: "https://pixiecdn.b-cdn.net/media/templates/ba-sliders/preset-fisheye-ultra-wide-1785511307073-after.jpg",
  },
  {
    name: "Y2K Digicam",
    before: "https://pixiecdn.b-cdn.net/gen_d80b0323-9f76-44ee-bb08-a6aed948e196_1784545434857.png",
    after: "https://pixiecdn.b-cdn.net/media/templates/ba-sliders/preset-y2k-digicam-flash-1785503485832-after.jpg",
  },
  {
    name: "Magic Hour Flare",
    before: "https://pixiecdn.b-cdn.net/gen_d80b0323-9f76-44ee-bb08-a6aed948e196_1785163341156.png",
    after: "https://pixiecdn.b-cdn.net/media/templates/ba-sliders/preset-magic-hour-flare-1785511382439-after.jpg",
  },
];

const SCENE_SPECS = [
  {
    id: "subway",
    label: "Subway .5",
    prompt:
      "Photorealistic ultra-wide iPhone 0.5x candid photo of this same woman standing on a NYC subway platform. Digital flash, train motion blur behind her, wind in hair, sharp facial likeness, natural skin, fashion street style, no text.",
  },
  {
    id: "tennis",
    label: "Hamptons Tennis",
    prompt:
      "Photorealistic candid lifestyle photo of this same woman on a manicured Hamptons tennis court near the net, racket over one shoulder, soft smile, white tennis outfit, bright summer daylight, sharp facial likeness, natural skin, no text.",
  },
  {
    id: "bodega",
    label: "NYC Bodega",
    prompt:
      "Photorealistic ultra-wide .5 iPhone street photo of this same woman outside a classic NYC bodega with awning and produce crates. Daytime digital flash, fashion pose, sharp facial likeness, natural skin, no text.",
  },
  {
    id: "night",
    label: "Night Out",
    prompt:
      "Photorealistic night-out digital-camera flash photo of this same woman on a city sidewalk at night, dressed up, harsh on-camera flash, street lights, slight grain, sharp facial likeness, natural skin, no text.",
  },
];

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
    await new Promise((r) => setTimeout(r, 4000));
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
  writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
  const png = dest.replace(/\.[^.]+$/, "") + ".png";
  const res = spawnSync("ffmpeg", ["-y", "-i", dest, png], { encoding: "utf8" });
  if (res.status !== 0 || !existsSync(png)) throw new Error(`ffmpeg convert failed for ${url}`);
  return png;
}

async function uploadBunny(localPath, remotePath, contentType) {
  const body = readFileSync(localPath);
  const r = await fetch(`https://storage.bunnycdn.com/${ZONE}/${remotePath}`, {
    method: "PUT",
    headers: { AccessKey: BKEY, "Content-Type": contentType },
    body,
  });
  if (!r.ok) throw new Error(`Bunny ${remotePath}: ${r.status} ${await r.text()}`);
  return `${PULL}/${remotePath}`;
}

function runPy(code, name) {
  const f = join(WORK, `${name}.py`);
  writeFileSync(f, code);
  const r = spawnSync("python3", [f], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`${name} failed:\n${r.stderr || r.stdout}`);
  return (r.stdout || "").trim();
}

function framesToMp4(framesDir, outMp4, fps = 24) {
  const r = spawnSync(
    "ffmpeg",
    [
      "-y",
      "-framerate",
      String(fps),
      "-i",
      join(framesDir, "f%04d.png"),
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      "-an",
      outMp4,
    ],
    { encoding: "utf8" }
  );
  if (r.status !== 0) throw new Error(`mp4 failed: ${r.stderr?.slice(-400)}`);
}

async function generateScenes(subjectUrl) {
  const out = [];
  for (const scene of SCENE_SPECS) {
    process.stdout.write(`scene ${scene.id} … `);
    let url = null;
    let lastErr;
    for (const model of ["google/nano-banana", "google/nano-banana-pro"]) {
      try {
        const jobId = await submit(model, {
          prompt: scene.prompt,
          image_input: [subjectUrl],
          aspect_ratio: "1:1",
          output_format: "jpg",
        });
        url = await poll(jobId);
        break;
      } catch (e) {
        lastErr = e;
        process.stdout.write(`(${model} fail) `);
      }
    }
    if (!url) throw lastErr || new Error(`scene ${scene.id} failed`);
    console.log(url);
    out.push({ ...scene, url });
  }
  return out;
}

// ---------- download BA assets ----------
const baLocal = [];
for (const p of PRESET_BA) {
  const b = await download(p.before, join(WORK, `${p.name.replace(/\s+/g, "-")}-before.bin`));
  const a = await download(p.after, join(WORK, `${p.name.replace(/\s+/g, "-")}-after.bin`));
  baLocal.push({ name: p.name, before: b, after: a });
}
const subjectPng = await download(SUBJECT, join(WORK, "subject.bin"));

// ---------- generate scene variants (parallel-ish sequential for rate limits) ----------
const scenes = await generateScenes(SUBJECT);
const sceneLocal = [];
for (const s of scenes) {
  const png = await download(s.url, join(WORK, `scene-${s.id}.bin`));
  sceneLocal.push({ ...s, png });
}

// ---------- VIDEO 1: preset BA showcase ----------
const baFrames = join(WORK, "ba-frames");
mkdirSync(baFrames, { recursive: true });
runPy(
  `
from PIL import Image, ImageDraw, ImageFont
import os, math

W, H = 1280, 720
FPS = 24
OUT = ${JSON.stringify(baFrames)}
pairs = ${JSON.stringify(baLocal)}

def font(size):
    for p in (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf",
    ):
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()

F_TITLE = font(42)
F_META = font(20)
F_SMALL = font(16)

def fit_cover(im, tw, th):
    im = im.convert("RGB")
    scale = max(tw/im.width, th/im.height)
    nw, nh = int(im.width*scale), int(im.height*scale)
    im = im.resize((nw, nh), Image.Resampling.LANCZOS)
    x = (nw-tw)//2; y = (nh-th)//2
    return im.crop((x, y, x+tw, y+th))

def ease(t):
    return t*t*(3-2*t)

def make_bg():
    img = Image.new("RGB", (W, H), (10, 10, 11))
    d = ImageDraw.Draw(img)
    for y in range(H):
        t = y / H
        v = int(10 + 16 * t)
        d.line([(0, y), (W, y)], fill=(v, v, v + 2))
    # soft vignette corners
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    od.ellipse([-200, -160, 420, 360], fill=(80, 60, 120, 35))
    od.ellipse([W - 480, H - 360, W + 160, H + 120], fill=(40, 70, 90, 28))
    img = Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")
    return img

BG = make_bg()

frames = []
# intro beat
base = BG.copy()
d = ImageDraw.Draw(base)
d.text((64, 64), "PRESETS", font=F_META, fill=(245, 201, 139))
d.text((64, 100), "Before → After", font=F_TITLE, fill=(255,255,255))
d.text((64, 160), "One tap. Instant glow-up.", font=F_META, fill=(200,200,205))
for _ in range(int(0.7*FPS)):
    frames.append(base.copy())

CARD_W, CARD_H = 620, 620
OX, OY = (W-CARD_W)//2, (H-CARD_H)//2 - 10

for pi, pair in enumerate(pairs):
    before = fit_cover(Image.open(pair["before"]), CARD_W, CARD_H)
    after = fit_cover(Image.open(pair["after"]), CARD_W, CARD_H)
    hold_b = int(0.35 * FPS)
    wipe = int(1.15 * FPS)
    hold_a = int(0.55 * FPS)
    seq = [0.0]*hold_b + [ease(i/(wipe-1)) for i in range(wipe)] + [1.0]*hold_a
    for p in seq:
        frame = BG.copy()
        x = max(0, min(CARD_W, int(round(p * CARD_W))))
        card = before.copy()
        if x > 0:
            card.paste(after.crop((0,0,x,CARD_H)), (0,0))
        dr = ImageDraw.Draw(card)
        dr.line([(x,0),(x,CARD_H)], fill=(255,255,255), width=3)
        cy = CARD_H//2
        dr.ellipse([x-11, cy-18, x+11, cy+18], fill=(255,255,255), outline=(20,20,24))
        # subtle shadow
        shadow = Image.new("RGBA", (CARD_W+20, CARD_H+20), (0,0,0,0))
        sd = ImageDraw.Draw(shadow)
        sd.rounded_rectangle([8,8,CARD_W+12,CARD_H+12], radius=28, fill=(0,0,0,90))
        frame.paste(shadow, (OX-10, OY-6), shadow)
        mask = Image.new("L", (CARD_W, CARD_H), 0)
        md = ImageDraw.Draw(mask)
        md.rounded_rectangle([0,0,CARD_W,CARD_H], radius=26, fill=255)
        rounded = Image.new("RGB", (CARD_W, CARD_H), (10,10,11))
        rounded.paste(card, (0,0))
        frame.paste(rounded, (OX, OY), mask)
        d = ImageDraw.Draw(frame)
        d.text((64, 48), "PRESET LOOK", font=F_SMALL, fill=(245, 201, 139))
        d.text((64, H-78), pair["name"], font=F_TITLE, fill=(255,255,255))
        d.text((64, H-36), "BEFORE" if p < 0.5 else "AFTER", font=F_SMALL, fill=(210,210,215))
        # progress pips
        for i in range(len(pairs)):
            px = W - 64 - (len(pairs)-1-i)*16
            d.ellipse([px, 52, px+8, 60], fill=(255,255,255) if i==pi else (80,80,86))
        frames.append(frame)

# outro hold on collage strip of afters
outro = BG.copy()
d = ImageDraw.Draw(outro)
d.text((64, 48), "100+ PRESETS", font=F_META, fill=(245, 201, 139))
d.text((64, 90), "Every look. One upload.", font=F_TITLE, fill=(255,255,255))
thumb_w = 210
gap = 18
total_w = len(pairs)*thumb_w + (len(pairs)-1)*gap
start_x = (W - total_w)//2
for i, pair in enumerate(pairs):
    im = fit_cover(Image.open(pair["after"]), thumb_w, thumb_w)
    mask = Image.new("L", (thumb_w, thumb_w), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0,0,thumb_w,thumb_w], radius=18, fill=255)
    canvas = Image.new("RGB", (thumb_w, thumb_w), (10,10,11))
    canvas.paste(im, (0,0))
    outro.paste(canvas, (start_x + i*(thumb_w+gap), 250), mask)
for _ in range(int(1.0*FPS)):
    frames.append(outro.copy())

for i, fr in enumerate(frames):
    fr.save(os.path.join(OUT, f"f{i:04d}.png"), "PNG")
print(len(frames))
`,
  "mk-ba"
);
const baMp4 = join(WORK, "auth-presets-ba.mp4");
framesToMp4(baFrames, baMp4, 24);
const baPoster = join(WORK, "auth-presets-ba-poster.jpg");
spawnSync("ffmpeg", ["-y", "-i", baMp4, "-vf", "select=eq(n\\,40)", "-vframes", "1", baPoster], {
  encoding: "utf8",
});

// ---------- VIDEO 2: one photo → many scenes ----------
const shootFrames = join(WORK, "shoot-frames");
mkdirSync(shootFrames, { recursive: true });
runPy(
  `
from PIL import Image, ImageDraw, ImageFont
import os, math

W, H = 1280, 720
FPS = 24
OUT = ${JSON.stringify(shootFrames)}
subject = ${JSON.stringify(subjectPng)}
scenes = ${JSON.stringify(sceneLocal.map((s) => ({ label: s.label, png: s.png })))}

def font(size):
    for p in (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf",
    ):
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()

F_TITLE = font(44)
F_META = font(20)
F_SMALL = font(16)
F_LABEL = font(18)

def fit_cover(im, tw, th):
    im = im.convert("RGB")
    scale = max(tw/im.width, th/im.height)
    nw, nh = int(im.width*scale), int(im.height*scale)
    im = im.resize((nw, nh), Image.Resampling.LANCZOS)
    x = (nw-tw)//2; y = (nh-th)//2
    return im.crop((x, y, x+tw, y+th))

def ease(t):
    return t*t*(3-2*t)

def bg_grad():
    img = Image.new("RGB", (W, H), (10,10,11))
    d = ImageDraw.Draw(img)
    for y in range(H):
        t = y/H
        r = int(14 + 18*t)
        g = int(12 + 10*t)
        b = int(22 + 28*(1-t))
        d.line([(0,y),(W,y)], fill=(r,g,b))
    return img

def rounded(im, rad=22):
    im = im.convert("RGB")
    mask = Image.new("L", im.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0,0,im.width,im.height], radius=rad, fill=255)
    out = Image.new("RGB", im.size, (10,10,11))
    out.paste(im, (0,0))
    return out, mask

frames = []
src = fit_cover(Image.open(subject), 520, 650)

# 1) hero source photo
for i in range(int(1.1*FPS)):
    frame = bg_grad()
    card, mask = rounded(src, 28)
    shadow = Image.new("RGBA", (card.width+24, card.height+24), (0,0,0,0))
    ImageDraw.Draw(shadow).rounded_rectangle([10,10,card.width+14,card.height+14], radius=30, fill=(0,0,0,100))
    ox, oy = 80, (H-card.height)//2
    frame.paste(shadow, (ox-8, oy-4), shadow)
    frame.paste(card, (ox, oy), mask)
    d = ImageDraw.Draw(frame)
    d.text((680, 180), "ONE SELFIE", font=F_META, fill=(245,201,139))
    d.text((680, 220), "Endless", font=F_TITLE, fill=(255,255,255))
    d.text((680, 272), "photoshoots.", font=F_TITLE, fill=(255,255,255))
    d.text((680, 360), "Same you. New scene.", font=F_META, fill=(200,200,208))
    frames.append(frame)

# 2) source shrinks left, scene cards cascade in
n = len(scenes)
cell = 250
gap = 16
grid_w = 2*cell + gap
grid_h = 2*cell + gap
gx0 = W - 80 - grid_w
gy0 = (H - grid_h)//2

cascade = int(1.6 * FPS)
for i in range(cascade):
    t = ease(i/(cascade-1))
    frame = bg_grad()
    # shrinking source
    sw = int(520 - 200*t)
    sh = int(650 - 250*t)
    src_s = fit_cover(Image.open(subject), sw, sh)
    card, mask = rounded(src_s, 24)
    ox = int(80 + 20*t)
    oy = (H-sh)//2
    frame.paste(card, (ox, oy), mask)
    d = ImageDraw.Draw(frame)
    chip = "YOUR PHOTO"
    bw = d.textlength(chip, font=F_SMALL) + 20
    d.rounded_rectangle([ox+14, oy+14, ox+14+bw, oy+40], radius=8, fill=(10,10,11,))
    d.text((ox+24, oy+18), chip, font=F_SMALL, fill=(255,255,255))

    # reveal scene tiles with stagger
    for si, sc in enumerate(scenes):
        row, col = divmod(si, 2)
        appear = max(0.0, min(1.0, (t - si*0.12) / 0.35))
        if appear <= 0: continue
        a = ease(appear)
        cx = gx0 + col*(cell+gap)
        cy = gy0 + row*(cell+gap) + int((1-a)*40)
        im = fit_cover(Image.open(sc["png"]), cell, cell)
        # fade via darken
        if a < 1:
            overlay = Image.new("RGB", (cell, cell), (10,10,11))
            im = Image.blend(overlay, im, a)
        tile, tmask = rounded(im, 18)
        frame.paste(tile, (cx, cy), tmask)
        dd = ImageDraw.Draw(frame)
        dd.rounded_rectangle([cx+10, cy+cell-38, cx+10+dd.textlength(sc["label"], font=F_LABEL)+16, cy+cell-12], radius=8, fill=(10,10,11))
        dd.text((cx+18, cy+cell-34), sc["label"], font=F_LABEL, fill=(255,255,255))
    frames.append(frame)

# 3) hold collage
for _ in range(int(0.7*FPS)):
    frames.append(frames[-1].copy())

# 4) full-bleed cycle through each scene
for si, sc in enumerate(scenes):
    im_full = fit_cover(Image.open(sc["png"]), W, H)
    hold = int(0.85 * FPS)
    fade = int(0.25 * FPS)
    prev = frames[-1]
    for i in range(fade):
        a = ease(i/(fade-1))
        frames.append(Image.blend(prev, im_full, a))
    for i in range(hold):
        frame = im_full.copy()
        d = ImageDraw.Draw(frame)
        # bottom gradient bar
        for y in range(H-140, H):
            alpha = int(180 * ((y-(H-140))/140))
            d.line([(0,y),(W,y)], fill=(0,0,0))
        # redraw with translucent via paste
        bar = Image.new("RGBA", (W, 140), (0,0,0,160))
        frame = frame.convert("RGBA")
        frame.paste(bar, (0, H-140), bar)
        frame = frame.convert("RGB")
        d = ImageDraw.Draw(frame)
        d.text((48, H-110), "PHOTOSHOOT", font=F_SMALL, fill=(245,201,139))
        d.text((48, H-80), sc["label"], font=F_TITLE, fill=(255,255,255))
        d.text((48, H-36), "Same face · new world", font=F_META, fill=(220,220,225))
        frames.append(frame)

# 5) end on 2x2 grid with source inset
end = bg_grad()
for si, sc in enumerate(scenes):
    row, col = divmod(si, 2)
    cx = 80 + col*(cell+gap)
    cy = gy0 + row*(cell+gap)
    im = fit_cover(Image.open(sc["png"]), cell, cell)
    tile, tmask = rounded(im, 18)
    end.paste(tile, (cx, cy), tmask)
    d = ImageDraw.Draw(end)
    d.text((cx+14, cy+cell-32), sc["label"], font=F_LABEL, fill=(255,255,255))
inset = fit_cover(Image.open(subject), 200, 250)
ic, imask = rounded(inset, 18)
ix, iy = W-80-200, H-80-250
end.paste(ic, (ix, iy), imask)
d = ImageDraw.Draw(end)
d.rounded_rectangle([ix+10, iy+10, ix+110, iy+36], radius=8, fill=(10,10,11))
d.text((ix+18, iy+14), "YOU", font=F_SMALL, fill=(245,201,139))
d.text((80, 40), "One upload. So many sets.", font=F_TITLE, fill=(255,255,255))
for _ in range(int(1.1*FPS)):
    frames.append(end.copy())

for i, fr in enumerate(frames):
    fr.save(os.path.join(OUT, f"f{i:04d}.png"), "PNG")
print(len(frames))
`,
  "mk-shoot"
);
const shootMp4 = join(WORK, "auth-photoshoot-possibilities.mp4");
framesToMp4(shootFrames, shootMp4, 24);
const shootPoster = join(WORK, "auth-photoshoot-possibilities-poster.jpg");
spawnSync(
  "ffmpeg",
  ["-y", "-i", shootMp4, "-vf", "select=eq(n\\,30)", "-vframes", "1", shootPoster],
  { encoding: "utf8" }
);

// ---------- VIDEO 3: rapid preset look flip (full-bleed afters) ----------
const flipFrames = join(WORK, "flip-frames");
mkdirSync(flipFrames, { recursive: true });
runPy(
  `
from PIL import Image, ImageDraw, ImageFont
import os

W, H = 1280, 720
FPS = 24
OUT = ${JSON.stringify(flipFrames)}
pairs = ${JSON.stringify(baLocal)}

def font(size):
    for p in (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf",
    ):
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()

F_TITLE = font(48)
F_SMALL = font(18)

def fit_cover(im, tw, th):
    im = im.convert("RGB")
    scale = max(tw/im.width, th/im.height)
    nw, nh = int(im.width*scale), int(im.height*scale)
    im = im.resize((nw, nh), Image.Resampling.LANCZOS)
    x = (nw-tw)//2; y = (nh-th)//2
    return im.crop((x, y, x+tw, y+th))

def ease(t):
    return t*t*(3-2*t)

frames = []
for i, pair in enumerate(pairs):
    after = fit_cover(Image.open(pair["after"]), W, H)
    before = fit_cover(Image.open(pair["before"]), W, H)
    # quick wipe
    wipe = int(0.7*FPS)
    hold = int(0.55*FPS)
    for j in range(wipe):
        p = ease(j/(wipe-1))
        x = int(p*W)
        frame = before.copy()
        if x > 0:
            frame.paste(after.crop((0,0,x,H)), (0,0))
        d = ImageDraw.Draw(frame)
        d.line([(x,0),(x,H)], fill=(255,255,255), width=4)
        frames.append(frame)
    for j in range(hold):
        frame = after.copy()
        d = ImageDraw.Draw(frame)
        bar = Image.new("RGBA", (W, 120), (0,0,0,150))
        frame = frame.convert("RGBA"); frame.paste(bar, (0, H-120), bar); frame = frame.convert("RGB")
        d = ImageDraw.Draw(frame)
        d.text((48, H-95), pair["name"].upper(), font=F_TITLE, fill=(255,255,255))
        d.text((48, H-40), "Preset · before & after", font=F_SMALL, fill=(230,230,235))
        frames.append(frame)

for i, fr in enumerate(frames):
    fr.save(os.path.join(OUT, f"f{i:04d}.png"), "PNG")
print(len(frames))
`,
  "mk-flip"
);
const flipMp4 = join(WORK, "auth-presets-flip.mp4");
framesToMp4(flipFrames, flipMp4, 24);
const flipPoster = join(WORK, "auth-presets-flip-poster.jpg");
spawnSync("ffmpeg", ["-y", "-i", flipMp4, "-vf", "select=eq(n\\,20)", "-vframes", "1", flipPoster], {
  encoding: "utf8",
});

const stamp = Date.now();
const results = {};
for (const [key, mp4, poster] of [
  ["presets-ba", baMp4, baPoster],
  ["photoshoot-possibilities", shootMp4, shootPoster],
  ["presets-flip", flipMp4, flipPoster],
]) {
  process.stdout.write(`upload ${key} … `);
  const videoUrl = await uploadBunny(mp4, `media/auth/carousel/${key}-${stamp}.mp4`, "video/mp4");
  const posterUrl = await uploadBunny(poster, `media/auth/carousel/${key}-${stamp}.jpg`, "image/jpeg");
  results[key] = { videoUrl, posterUrl };
  console.log("✓");
}

writeFileSync(join(WORK, "results.json"), JSON.stringify({ results, scenes }, null, 2));
writeFileSync(join(process.cwd(), "scripts/.auth-carousel-results.json"), JSON.stringify({ results, scenes }, null, 2));
console.log(JSON.stringify(results, null, 2));
