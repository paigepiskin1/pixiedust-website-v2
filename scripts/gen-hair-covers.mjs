#!/usr/bin/env node
/**
 * Generate on-model hair cut covers with GPT Image 2.
 *
 * Usage: node scripts/dev.mjs node scripts/gen-hair-covers.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SYNCNODE_KEY = process.env.SYNCNODE_API_KEY;
const ZONE = process.env.BUNNY_STORAGE_ZONE || "pixiecdn";
const BKEY = process.env.BUNNY_API_KEY;
const PULL = (process.env.BUNNY_PULL_ZONE_URL || "https://pixiecdn.b-cdn.net").replace(/\/$/, "");

const MODEL =
  "https://pixiecdn.b-cdn.net/uploads/ry1mTnFZgZYzASRGD2N0A6TbW5k1/9adf7a8f-5a8b-4d7e-a883-ce6e57596018.png";

const BASE =
  "Generate an edited version of the first photo in which ONLY the person's hair is restyled. " +
  "Keep their face, identity, facial features, skin tone, expression, pose, body, clothing and background exactly the same — change nothing except the hair. " +
  "Make the new hair look photorealistic and natural, matching the person's head shape and the scene's lighting and perspective. ";

const CUTS = [
  {
    id: "f-long-layers",
    prompt: "a long layered haircut with soft face-framing layers, feathered ends, and natural movement like a salon layered blowout",
    ref: "https://pixiecdn.b-cdn.net/uploads/ry1mTnFZgZYzASRGD2N0A6TbW5k1/3f3d3515-7c51-4605-b7ea-3f0c519d2927.jpg",
  },
  {
    id: "f-long-wolf",
    prompt: "a long wolf cut with shaggy disconnected layers, volume at the crown, face-framing pieces, and a soft curtain fringe",
    ref: "https://pixiecdn.b-cdn.net/uploads/ry1mTnFZgZYzASRGD2N0A6TbW5k1/8090eeca-8ca9-408d-b662-c5d706c25a8c.jpg",
  },
  {
    id: "f-short-wolf",
    prompt: "a short wolf cut with choppy layered fringe, textured shaggy crown, and shorter layered ends around the shoulders",
    ref: "https://pixiecdn.b-cdn.net/uploads/ry1mTnFZgZYzASRGD2N0A6TbW5k1/545be481-4153-4823-be74-19e3881286d7.jpg",
  },
  {
    id: "f-long-angles",
    prompt: "long angled layers with a sharp A-line silhouette, longer in front, sleek face-framing pieces, and polished ends",
    ref: "https://pixiecdn.b-cdn.net/media/hair/refs/f-long-angles.jpg",
  },
  {
    id: "f-curtain-bangs",
    prompt: "long hair with soft Sabrina Carpenter-style curtain bangs sweeping apart at the center, face-framing fringe, and glossy length",
    ref: "https://pixiecdn.b-cdn.net/uploads/ry1mTnFZgZYzASRGD2N0A6TbW5k1/35e97a44-13f8-4b86-95ed-d26bccf485b2.jpg",
  },
  {
    id: "f-long-straight",
    prompt: "long sleek straight hair with a clean center or soft side part, glassy shine, and blunt polished ends",
    ref: "https://pixiecdn.b-cdn.net/uploads/ry1mTnFZgZYzASRGD2N0A6TbW5k1/a22bc279-10a0-41ae-b29e-99df3b80df6c.jpg",
  },
  {
    id: "f-long-curly",
    prompt: "long curly hair with defined springy curls, natural volume, and soft face-framing curl pieces",
    ref: "https://pixiecdn.b-cdn.net/uploads/ry1mTnFZgZYzASRGD2N0A6TbW5k1/eae83b93-beb7-4314-9359-4c225817ba77.jpg",
  },
  {
    id: "f-traditional-bob",
    prompt: "a classic traditional bob cut at chin length, soft rounded shape, light internal layering, and a clean polished finish",
    ref: "https://pixiecdn.b-cdn.net/uploads/ry1mTnFZgZYzASRGD2N0A6TbW5k1/b4ed556a-ee5f-4b70-ad94-0521b521262f.jpg",
  },
  {
    id: "f-flipped-bob",
    prompt: "a chin-to-shoulder bob with flipped-out ends, soft bounce, and a retro blowout flip at the tips",
    ref: "https://pixiecdn.b-cdn.net/uploads/ry1mTnFZgZYzASRGD2N0A6TbW5k1/c78a01e7-6245-4b18-a4b0-714374bb1d07.jpg",
  },
  {
    id: "f-y2k-bob",
    prompt: "an early-2000s Y2K bob with chunky layers, slight flip, face-framing pieces, and glossy blowout volume",
    ref: "https://pixiecdn.b-cdn.net/uploads/ry1mTnFZgZYzASRGD2N0A6TbW5k1/d68d75b7-be46-4e80-bca6-94d3161b5ea0.jpg",
  },
  {
    id: "f-angled-bob",
    prompt: "a 1990s Victoria Beckham / Posh Spice angled bob — shorter in back, longer sharp points in front, sleek blowout, blunt polished ends",
  },
  {
    id: "f-pixie",
    prompt: "a chic short pixie cut with textured crown, softly tapered sides, and a light feathered fringe",
  },
  {
    id: "f-mullet",
    prompt: "a modern women's mullet with shorter layered front and sides, longer textured length in the back, and soft face-framing pieces",
  },
  {
    id: "f-long-mullet",
    prompt: "a long women's mullet with shaggy layered top and fringe, disconnected shorter sides, and much longer textured length down the back",
  },
  {
    id: "f-emo",
    prompt: "an emo haircut with a heavy side-swept fringe covering one eye, choppy layered length, and razor-cut face-framing pieces",
  },
  {
    id: "f-scene-queen",
    prompt: "a scene queen haircut with choppy asymmetrical layers, heavy side-swept fringe, teased volume at the crown, and razor-cut ends",
  },
  {
    id: "f-afro",
    prompt: "a full rounded natural afro with dense coily texture, even spherical shape, and soft volume framing the face",
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
  if (url.includes("pixiecdn.b-cdn.net")) return url;
  const r = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      Referer: "https://www.pinterest.com/",
    },
  });
  if (!r.ok) throw new Error(`Download ${url} → ${r.status}`);
  const ct = r.headers.get("content-type") || "image/jpeg";
  const ext = ct.includes("png") ? "png" : ct.includes("webp") ? "webp" : "jpg";
  const buf = Buffer.from(await r.arrayBuffer());
  return uploadBunny(
    buf,
    `media/hair/refs/${name}.${ext}`,
    ct.includes("png") ? "image/png" : ct.includes("webp") ? "image/webp" : "image/jpeg"
  );
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

async function poll(jobId, maxMs = 420000) {
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
  const prompt = buildPrompt({ ...cut, ref: refUrl });
  // Prefer nano-banana when GPT flags sensitive; still try GPT first for fidelity.
  const models = ["openai/gpt-image-2", "google/nano-banana", "google/nano-banana-pro"];
  let lastErr;
  for (const model of models) {
    try {
      process.stdout.write(`[${model.split("/").pop()}] `);
      const input = model.includes("gpt-image")
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
      console.log(`\n    fail: ${String(e.message).slice(0, 180)}`);
      process.stdout.write("  ");
    }
  }
  throw lastErr || new Error("generate failed");
}

const results = {};
console.log("Rehosting external style refs…");
for (const cut of CUTS) {
  if (!cut.ref) continue;
  try {
    cut.hostedRef = await rehost(cut.ref, cut.id);
    console.log(`  ${cut.id} → ${cut.hostedRef}`);
  } catch (e) {
    console.log(`  ${cut.id} rehost failed: ${String(e.message).slice(0, 120)}`);
    // Skip broken external refs — generate from text prompt only.
    cut.hostedRef = null;
    cut.ref = null;
  }
}

console.log(`\nGenerating ${CUTS.length} covers…`);
for (const cut of CUTS) {
  process.stdout.write(`\n${cut.id} … `);
  try {
    const url = await generateCover(cut, cut.hostedRef || null);
    console.log(`\n✓ ${url}`);
    results[cut.id] = { preview: url, ref: cut.hostedRef || cut.ref || null };
  } catch (e) {
    console.log(`\n✗ ${String(e.message).slice(0, 220)}`);
    results[cut.id] = { error: String(e.message) };
  }
}

const outPath = join(process.cwd(), "scripts/.hair-cover-results.json");
writeFileSync(outPath, JSON.stringify(results, null, 2));
console.log("\nWrote", outPath);

const packsPath = join(process.cwd(), "src/lib/hair-packs.ts");
let src = readFileSync(packsPath, "utf8");
for (const [id, data] of Object.entries(results)) {
  if (!data.preview) continue;
  const idRe = new RegExp(`(id:\\s*"${id}"[\\s\\S]*?preview:\\s*")[^"]+(")`);
  if (idRe.test(src)) src = src.replace(idRe, `$1${data.preview}$2`);
  if (data.ref) {
    const refRe = new RegExp(`(id:\\s*"${id}"[\\s\\S]*?ref:\\s*")[^"]+(")`);
    if (refRe.test(src)) src = src.replace(refRe, `$1${data.ref}$2`);
  }
}
writeFileSync(packsPath, src);
console.log("Patched src/lib/hair-packs.ts");

const ok = Object.values(results).filter((r) => r.preview).length;
const fail = Object.values(results).filter((r) => r.error).length;
console.log(`\nDone: ${ok} ok, ${fail} failed`);
console.log(JSON.stringify(results, null, 2));
