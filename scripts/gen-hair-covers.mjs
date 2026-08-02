#!/usr/bin/env node
/**
 * Generate on-model hair cut covers with GPT Image 2.
 * Uses the provided model photo + each cut's style reference when available.
 *
 * Usage: node scripts/dev.mjs node scripts/gen-hair-covers.mjs
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const SYNCNODE_KEY = process.env.SYNCNODE_API_KEY;
const ZONE = process.env.BUNNY_STORAGE_ZONE || "pixiecdn";
const BKEY = process.env.BUNNY_API_KEY;
const PULL = (process.env.BUNNY_PULL_ZONE_URL || "https://pixiecdn.b-cdn.net").replace(/\/$/, "");

const MODEL =
  "https://pixiecdn.b-cdn.net/uploads/ry1mTnFZgZYzASRGD2N0A6TbW5k1/c385e363-674d-47f2-ba24-89ae54eb8f55.webp";

const BASE =
  "Generate an edited version of the first photo in which ONLY the person's hair is restyled. " +
  "Keep their face, identity, facial features, skin tone, expression, pose, body, clothing and background exactly the same — change nothing except the hair. " +
  "Make the new hair look photorealistic and natural, matching the person's head shape and the scene's lighting and perspective. ";

const CUTS = [
  {
    id: "f-long-layers",
    prompt: "a long layered haircut with soft face-framing layers, feathered ends, and natural movement like a salon layered blowout",
    ref: "https://i.pinimg.com/1200x/de/6f/62/de6f62df7939d7bc860fd33b3aa7121e.jpg",
  },
  {
    id: "f-long-wolf",
    prompt: "a long wolf cut with shaggy disconnected layers, volume at the crown, face-framing pieces, and a soft curtain fringe",
    ref: "https://i.pinimg.com/736x/f6/e6/d7/f6e6d72aa7dc2302847ec7422c202e50.jpg",
  },
  {
    id: "f-short-wolf",
    prompt: "a short wolf cut with choppy layered fringe, textured shaggy crown, and shorter layered ends around the shoulders",
    ref: "https://i.pinimg.com/736x/0e/e1/57/0ee1574d2c64c0d3af588c58073562ab.jpg",
  },
  {
    id: "f-long-angles",
    prompt: "long angled layers with a sharp A-line silhouette, longer in front, sleek face-framing pieces, and polished ends",
    ref: "https://i.pinimg.com/1200x/d3/18/21/d31821d081f4eff8632429cdb83a93d6.jpg",
  },
  {
    id: "f-curtain-bangs",
    prompt: "long hair with soft Sabrina Carpenter-style curtain bangs sweeping apart at the center, face-framing fringe, and glossy length",
    ref: "https://i.pinimg.com/736x/c6/e7/1d/c6e71d2236586a569a8275bf5b30797a.jpg",
  },
  {
    id: "f-long-straight",
    prompt: "long sleek straight hair with a clean center or soft side part, glassy shine, and blunt polished ends",
    ref: "https://i.pinimg.com/1200x/c6/eb/14/c6eb14598c62184f3b8cd1f05d8b1643.jpg",
  },
  {
    id: "f-long-curly",
    prompt: "long curly hair with defined springy curls, natural volume, and soft face-framing curl pieces",
    ref: "https://i.pinimg.com/1200x/0e/9b/66/0e9b66f1153e857766696d787632e870.jpg",
  },
  {
    id: "f-traditional-bob",
    prompt: "a classic traditional bob cut at chin length, soft rounded shape, light internal layering, and a clean polished finish",
    ref: "https://m.media-amazon.com/images/I/617+Ze3merL._SX679_.jpg",
  },
  {
    id: "f-flipped-bob",
    prompt: "a chin-to-shoulder bob with flipped-out ends, soft bounce, and a retro blowout flip at the tips",
    ref: "https://i.pinimg.com/736x/81/ce/83/81ce83c97886edf6474b3bb5b3c9e264.jpg",
  },
  {
    id: "f-y2k-bob",
    prompt: "an early-2000s Y2K bob with chunky layers, slight flip, face-framing pieces, and glossy blowout volume",
    ref: "https://i.pinimg.com/736x/00/c7/01/00c701b8fa209c9ad8b501471a7812bf.jpg",
  },
  {
    id: "f-mullet",
    prompt: "a modern women's mullet with shorter layered front and sides, longer textured length in the back, and soft face-framing pieces",
  },
  {
    id: "f-pixie",
    prompt: "a chic short pixie cut with textured crown, softly tapered sides, and a light feathered fringe",
  },
  {
    id: "f-scene-queen",
    prompt: "a scene queen haircut with choppy asymmetrical layers, heavy side-swept fringe, teased volume at the crown, and razor-cut ends",
    ref: "https://i.pinimg.com/1200x/fb/22/aa/fb22aacaac2c75bb52ae6d486c080d95.jpg",
  },
];

if (!SYNCNODE_KEY || !BKEY) {
  console.error("Missing SYNCNODE_API_KEY or BUNNY_API_KEY");
  process.exit(1);
}

async function uploadBunny(buf, remotePath, contentType) {
  const r = await fetch(`https://storage.bunnycdn.com/${ZONE}/${remotePath}`, {
    method: "PUT",
    headers: { AccessKey: BKEY, "Content-Type": contentType },
    body: buf,
  });
  if (!r.ok) throw new Error(`Bunny ${remotePath}: ${r.status} ${await r.text()}`);
  return `${PULL}/${remotePath}`;
}

async function rehost(url, name) {
  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 PixieDustCoverBot" } });
  if (!r.ok) throw new Error(`Download ${url} → ${r.status}`);
  const ct = r.headers.get("content-type") || "image/jpeg";
  const ext = ct.includes("png") ? "png" : ct.includes("webp") ? "webp" : "jpg";
  const buf = Buffer.from(await r.arrayBuffer());
  return uploadBunny(buf, `media/hair/refs/${name}.${ext}`, ct.includes("png") ? "image/png" : ct.includes("webp") ? "image/webp" : "image/jpeg");
}

async function submit(model, input) {
  const r = await fetch("https://run.syncnode.ai/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey: SYNCNODE_KEY, model, input }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.job_id) throw new Error(d.error || d.detail || JSON.stringify(d).slice(0, 240));
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
    process.stdout.write(`.${st || "?"}`);
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

function buildPrompt(cut) {
  if (cut.ref) {
    return (
      BASE +
      "Restyle their hair to closely match the hairstyle shown in the second reference image — copy its cut, length, shape, layers and texture, but keep the person's own identity, face, and natural hair color. " +
      `Aim for ${cut.prompt}.`
    );
  }
  return BASE + `Give them ${cut.prompt}. Keep their natural hair color.`;
}

async function generateCover(cut, refUrl) {
  const images = [MODEL];
  if (refUrl) images.push(refUrl);
  const prompt = buildPrompt(cut);
  const models = ["openai/gpt-image-2", "google/nano-banana"];
  let lastErr;
  for (const model of models) {
    try {
      process.stdout.write(`[${model.split("/").pop()}] `);
      const input =
        model.includes("gpt-image")
          ? {
              prompt,
              input_images: images,
              aspect_ratio: "2:3",
              quality: "high",
              moderation: "low",
              output_format: "jpeg",
              number_of_images: 1,
            }
          : {
              prompt,
              image_input: images,
              aspect_ratio: "2:3",
              output_format: "jpg",
            };
      const jobId = await submit(model, input);
      return await poll(jobId);
    } catch (e) {
      lastErr = e;
      console.log(`\n    fail: ${String(e.message).slice(0, 160)}`);
      process.stdout.write("  ");
    }
  }
  throw lastErr || new Error("generate failed");
}

const results = {};
console.log("Rehosting style refs…");
for (const cut of CUTS) {
  if (!cut.ref) continue;
  try {
    const hosted = await rehost(cut.ref, cut.id);
    cut.hostedRef = hosted;
    console.log(`  ${cut.id} → ${hosted}`);
  } catch (e) {
    console.log(`  ${cut.id} rehost failed, using original: ${e.message.slice(0, 100)}`);
    cut.hostedRef = cut.ref;
  }
}

console.log("\nGenerating covers…");
for (const cut of CUTS) {
  process.stdout.write(`\n${cut.id} … `);
  try {
    const url = await generateCover(cut, cut.hostedRef);
    console.log(`\n✓ ${url}`);
    results[cut.id] = { preview: url, ref: cut.hostedRef || null };
  } catch (e) {
    console.log(`\n✗ ${String(e.message).slice(0, 200)}`);
    results[cut.id] = { error: String(e.message) };
  }
}

const outPath = join(process.cwd(), "scripts/.hair-cover-results.json");
writeFileSync(outPath, JSON.stringify(results, null, 2));
console.log("\nWrote", outPath);

// Patch hair-packs.ts preview (+ hosted ref) URLs
const packsPath = join(process.cwd(), "src/lib/hair-packs.ts");
let src = readFileSync(packsPath, "utf8");
for (const [id, data] of Object.entries(results)) {
  if (!data.preview) continue;
  // Replace preview URL inside the object that has this id
  const idRe = new RegExp(`(id:\\s*"${id}"[\\s\\S]*?preview:\\s*")[^"]+(")`);
  if (idRe.test(src)) {
    src = src.replace(idRe, `$1${data.preview}$2`);
  }
  if (data.ref) {
    const refRe = new RegExp(`(id:\\s*"${id}"[\\s\\S]*?ref:\\s*")[^"]+(")`);
    if (refRe.test(src)) {
      src = src.replace(refRe, `$1${data.ref}$2`);
    }
  }
}
writeFileSync(packsPath, src);
console.log("Patched src/lib/hair-packs.ts");
console.log(JSON.stringify(results, null, 2));
