#!/usr/bin/env node
/**
 * Generate on-model men's hair cut covers.
 *
 * Usage: node scripts/dev.mjs node scripts/gen-mens-hair-covers.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SYNCNODE_KEY = process.env.SYNCNODE_API_KEY;
const ZONE = process.env.BUNNY_STORAGE_ZONE || "pixiecdn";
const BKEY = process.env.BUNNY_API_KEY;
const PULL = (process.env.BUNNY_PULL_ZONE_URL || "https://pixiecdn.b-cdn.net").replace(/\/$/, "");

const MODEL =
  "https://pixiecdn.b-cdn.net/uploads/ry1mTnFZgZYzASRGD2N0A6TbW5k1/ef44d116-5cdc-4751-ac9e-6e6875702003.png";

const BASE =
  "Generate an edited version of the first photo in which ONLY the person's hair is restyled. " +
  "Keep their face, identity, facial features, skin tone, expression, pose, body, clothing and background exactly the same — change nothing except the hair. " +
  "Make the new hair look photorealistic and natural, matching the person's head shape and the scene's lighting and perspective. ";

const CUTS = [
  {
    id: "m-flow",
    prompt:
      "a men's flow haircut — medium-length hair swept back and slightly to the side, soft natural movement, longer on top with tapered sides, clean and athletic",
  },
  {
    id: "m-short-mullet",
    prompt:
      "a short men's mullet — cropped textured top and fringe, shorter sides, with distinctly longer length at the nape, modern and tight rather than extreme",
  },
  {
    id: "m-modern-mullet",
    prompt:
      "a modern men's mullet — textured shaggy layers on top, faded or tapered sides, and longer layered length down the back, stylish and contemporary",
  },
  {
    id: "m-fade",
    prompt:
      "a clean men's skin fade haircut — sides faded tightly into the skin, short textured crop on top, sharp line-up and polished barber finish",
  },
  {
    id: "m-mohawk",
    prompt:
      "a men's mohawk — a raised strip of longer hair running down the center of the head with the sides closely shaved or faded, bold and sharp",
  },
  {
    id: "m-quiff",
    prompt:
      "a classic men's quiff — longer hair on top swept up and slightly forward with volume at the front, tapered sides, polished barber style",
  },
  {
    id: "m-braids",
    prompt:
      "neat men's cornrow braids — clean straight or slightly curved braids from the hairline back across the scalp, precise parts, natural hair color, barbershop finish",
  },
  {
    id: "m-taper",
    prompt:
      "a classic men's taper haircut — sides and back gradually tapered shorter toward the ears and neckline, natural medium-short length on top, clean and timeless",
  },
  {
    id: "m-faux-hawk",
    prompt:
      "a men's faux hawk — longer textured hair styled into a hawk ridge down the center with faded sides, spiked slightly upward but softer than a full mohawk",
  },
  {
    id: "m-90s-spiky",
    prompt:
      "1990s men's spiky hair — short twisted gel spikes standing up across the top, textured and crunchy with product, tapered sides, classic late-90s look",
  },
  {
    id: "m-00s-spiky",
    prompt:
      "early-2000s club-era men's spiked hair in Jersey Shore style — heavily gelled forward-and-up spikes on top, shiny with product, short sides, bold nightlife look",
  },
  {
    id: "m-burst-fade",
    prompt:
      "a men's burst fade — a fade that radiates in a semi-circle around the ear into longer hair on top and back, textured crown, sharp modern barber cut",
  },
  {
    id: "m-messy-fringe",
    prompt:
      "a men's messy fringe haircut — medium-length tousled hair falling forward into a textured fringe over the forehead, casual and undone with natural movement",
  },
  {
    id: "m-spiky-fringe",
    prompt:
      "a men's spiky fringe — short-to-medium hair styled into pointed spikes angled forward over the forehead, textured with product, tapered sides",
  },
  {
    id: "m-long-undercut",
    prompt:
      "a men's long undercut with a man bun — sides and back closely cropped undercut, longer top hair gathered into a neat bun on the crown, clean contrast",
  },
  {
    id: "m-textured-fringe",
    prompt:
      "a men's textured fringe crop — short choppy layers on top with a soft textured fringe sitting on the forehead, faded or tapered sides, modern barber finish",
  },
  {
    id: "m-choppy-fringe",
    prompt:
      "a men's choppy fringe haircut — medium length with razor-cut uneven layers and a heavy choppy fringe across the forehead, edgy textured finish",
  },
  {
    id: "m-modern-quiff",
    prompt:
      "a modern men's quiff — high textured volume swept up and back from the forehead, disconnected or skin-faded sides, matte product finish, sharp and contemporary",
  },
  {
    id: "m-wavy-undercut",
    prompt:
      "a men's wavy undercut — longer wavy hair on top with natural wave pattern, closely cropped undercut sides, soft parting or swept style",
  },
  {
    id: "m-shaggy-long",
    prompt:
      "long shaggy men's hair — shoulder-grazing layered length with textured ends, soft curtain pieces around the face, casual undone volume",
  },
  {
    id: "m-surfer",
    prompt:
      "men's surfer hair — medium-long sun-tousled beachy waves with natural texture and movement, slightly messy fringe, casual coastal look",
  },
];

if (!SYNCNODE_KEY || !BKEY) {
  console.error("Missing SYNCNODE_API_KEY or BUNNY_API_KEY");
  process.exit(1);
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
  return BASE + `Give them ${cut.prompt}. Keep their natural hair color.`;
}

async function generateCover(cut) {
  const images = [MODEL];
  const prompt = buildPrompt(cut);
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

const only = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const queue = only.length ? CUTS.filter((c) => only.includes(c.id)) : CUTS;

const results = {};
console.log(`Generating ${queue.length} men's covers…`);
for (const cut of queue) {
  process.stdout.write(`\n${cut.id} … `);
  try {
    const url = await generateCover(cut);
    console.log(`\n✓ ${url}`);
    results[cut.id] = { preview: url };
  } catch (e) {
    console.log(`\n✗ ${String(e.message).slice(0, 220)}`);
    results[cut.id] = { error: String(e.message) };
  }
}

const outPath = join(process.cwd(), "scripts/.mens-hair-cover-results.json");
writeFileSync(outPath, JSON.stringify(results, null, 2));
console.log("\nWrote", outPath);

const packsPath = join(process.cwd(), "src/lib/hair-packs.ts");
let src = readFileSync(packsPath, "utf8");
for (const [id, data] of Object.entries(results)) {
  if (!data.preview) continue;
  // Match only within this cut's object: id … preview (non-greedy, stops at first preview)
  const idRe = new RegExp(`(id:\\s*"${id}"[\\s\\S]*?preview:\\s*")[^"]+(")`);
  if (idRe.test(src)) src = src.replace(idRe, `$1${data.preview}$2`);
  else console.warn("No preview field matched for", id);
}
writeFileSync(packsPath, src);
console.log("Patched src/lib/hair-packs.ts");

const ok = Object.values(results).filter((r) => r.preview).length;
const fail = Object.values(results).filter((r) => r.error).length;
console.log(`\nDone: ${ok} ok, ${fail} failed`);
console.log(JSON.stringify(results, null, 2));
