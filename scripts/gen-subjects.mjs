// Generate a pool of DIVERSE subject photos with openai/gpt-image-2 via SyncNode
// (outputs auto-host to Bunny). Writes scripts/subjects.json — an array of image
// URLs used as varied file inputs by generate-examples.ts so the examples aren't
// all the same person.
//   node scripts/gen-subjects.mjs
import { writeFileSync } from "node:fs";

const KEY = process.env.SYNCNODE_API_KEY || "";
const MODEL = "openai/gpt-image-2";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const base = "a photorealistic, high-quality portrait photo, head and shoulders, neutral studio background, soft natural lighting, looking at the camera, sharp focus";
const PROMPTS = [
  `${base}, of a young East Asian woman in her 20s with long dark hair`,
  `${base}, of a middle-aged Black man with a short beard and short hair`,
  `${base}, of a young Latina woman with wavy brown hair`,
  `${base}, of an older white woman in her 60s with silver hair and a warm expression`,
  `${base}, of a South Asian man in his 30s with neat hair`,
  `${base}, of a young white man in his 20s with light stubble and freckles`,
  `${base}, of a Black woman in her 20s with braided hair`,
  `${base}, of a Southeast Asian teenage boy with short hair`,
];

async function submit(prompt) {
  const res = await fetch("https://run.syncnode.ai/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey: KEY, model: MODEL, input: { prompt, aspect_ratio: "1:1", number_of_images: 1 } }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.job_id) throw new Error(`submit failed (${res.status}): ${data.error || JSON.stringify(data).slice(0, 120)}`);
  return data.job_id;
}

function outputs(data) {
  const o = data.output;
  if (!o) return [];
  return Array.isArray(o) ? o.filter((x) => typeof x === "string") : typeof o === "string" ? [o] : [];
}

async function poll(jobId) {
  for (let i = 0; i < 45; i++) {
    await sleep(4000);
    const res = await fetch(`https://run.syncnode.ai/prediction-status?job_id=${encodeURIComponent(jobId)}&apiKey=${encodeURIComponent(KEY)}`);
    const data = await res.json().catch(() => ({}));
    const st = data.replicate_status || data.status;
    const out = outputs(data);
    if (["succeeded", "completed", "SUCCEEDED", "COMPLETED"].includes(st) || out.length) return out;
    if (["failed", "FAILED", "canceled", "error"].includes(st)) throw new Error(typeof data.output === "string" ? data.output : data.error || "failed");
  }
  throw new Error("timeout");
}

const urls = [];
for (let i = 0; i < PROMPTS.length; i++) {
  try {
    const job = await submit(PROMPTS[i]);
    const out = await poll(job);
    if (out[0]) {
      urls.push(out[0]);
      console.log(`  ✓ subject ${i + 1}: ${out[0].slice(0, 60)}`);
    } else {
      console.log(`  ✗ subject ${i + 1}: no output`);
    }
  } catch (e) {
    console.log(`  ✗ subject ${i + 1}: ${e.message}`);
  }
  await sleep(3000);
}
writeFileSync("scripts/subjects.json", JSON.stringify(urls, null, 2));
console.log(`\nWrote ${urls.length} subject(s) to scripts/subjects.json`);
