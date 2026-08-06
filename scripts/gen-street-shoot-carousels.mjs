#!/usr/bin/env node
/**
 * Generate 3-model carousel thumbnails for street photoshoot templates.
 *
 * Usage: node scripts/dev.mjs node scripts/gen-street-shoot-carousels.mjs
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const SYNCNODE_KEY = process.env.SYNCNODE_API_KEY;
const DB_ID = process.env.CF_D1_DATABASE_ID || "105e2276-0d51-430a-8c6f-b4f7ee699aaf";
const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID || "15149dc8d99998b6c96a67c2cf52ad7c";
const CF_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

const MODELS = [
  "https://pixiecdn.b-cdn.net/gen_d80b0323-9f76-44ee-bb08-a6aed948e196_1785163390801.png",
  "https://pixiecdn.b-cdn.net/gen_d80b0323-9f76-44ee-bb08-a6aed948e196_1784545458904.png",
  "https://pixiecdn.b-cdn.net/gen_d80b0323-9f76-44ee-bb08-a6aed948e196_1784380570300.png",
  "https://pixiecdn.b-cdn.net/gen_d80b0323-9f76-44ee-bb08-a6aed948e196_1785163736666.png",
];

const IDS = [
  "street-clocktower-butterfly-heels",
  "street-times-square-lowbag",
  "street-stone-leather-editorial",
  "street-bodega-cooler-pose",
  "street-bodega-snack-fisheye",
  "street-elevator-fur-flash",
];

if (!SYNCNODE_KEY || !CF_TOKEN) {
  console.error("Missing SYNCNODE_API_KEY or CLOUDFLARE_API_TOKEN");
  process.exit(1);
}

async function d1(sql, params) {
  const body = params ? { sql, params } : { sql };
  const r = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/d1/database/${DB_ID}/query`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${CF_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
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
    if (["succeeded", "COMPLETED", "SUCCEEDED", "completed"].includes(st)) {
      const out = d.output;
      if (typeof out === "string") return out;
      if (Array.isArray(out) && out.length) return out[0];
      if (out?.url) return out.url;
      if (Array.isArray(out?.images) && out.images.length) return out.images[0]?.url ?? out.images[0];
      throw new Error("No output URL");
    }
    if (["failed", "FAILED", "CANCELED", "error"].includes(st)) {
      throw new Error(`Job failed: ${d.error || d.output || JSON.stringify(d).slice(0, 300)}`);
    }
  }
  throw new Error("Timed out");
}

function prepareInput(raw, subjectUrl) {
  const input = JSON.parse(raw);
  if (input.aspect_ratio === "{{aspect}}" || !input.aspect_ratio) input.aspect_ratio = "2:3";
  if ("input_images" in input) input.input_images = [subjectUrl];
  if ("image_input" in input) input.image_input = [subjectUrl];
  input.moderation = "low";
  input.quality = input.quality === "auto" ? "high" : input.quality || "high";
  return input;
}

function adaptForModel(input, model, subjectUrl) {
  const payload = { ...input };
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
    payload.output_format = "jpg";
  } else {
    if (!payload.input_images && payload.image_input) {
      payload.input_images = payload.image_input;
      delete payload.image_input;
    }
    if (!payload.input_images) payload.input_images = [subjectUrl];
    payload.moderation = "low";
  }
  return payload;
}

async function generateOne(t, subjectUrl) {
  const input = prepareInput(t.input_json, subjectUrl);
  // Prefer nano-banana first for these editorial street prompts — GPT Image often
  // trips sensitive flags on heels/fur/bodega flash looks.
  const models = ["google/nano-banana", t.model || "openai/gpt-image-2", "google/nano-banana-pro"].filter(
    (m, i, a) => m && a.indexOf(m) === i
  );
  let lastErr;
  for (const model of models) {
    try {
      process.stdout.write(`[${model.split("/").pop()}] `);
      const jobId = await submit(model, adaptForModel(input, model, subjectUrl));
      return await poll(jobId);
    } catch (e) {
      lastErr = e;
      console.log(`\n    retry fail: ${String(e.message).slice(0, 160)}`);
      process.stdout.write("  ");
    }
  }
  throw lastErr || new Error("generate failed");
}

function subjectsForShoot(shootIndex) {
  // Rotate through 4 models so each shoot gets 3 distinct subjects.
  return [0, 1, 2].map((offset) => MODELS[(shootIndex + offset) % MODELS.length]);
}

const rows = await d1(
  `SELECT id, title, model, input_json, meta FROM templates WHERE id IN (${IDS.map((i) => `'${i}'`).join(",")})`
);
const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
console.log(`loaded ${rows.length}/${IDS.length}`);

const results = {};
let ok = 0;
let fail = 0;

for (let si = 0; si < IDS.length; si++) {
  const id = IDS[si];
  const t = byId[id];
  if (!t) {
    console.log(`missing ${id}`);
    fail++;
    continue;
  }
  const subjects = subjectsForShoot(si);
  console.log(`\n${t.title} (${id})`);
  const urls = [];
  try {
    for (let mi = 0; mi < subjects.length; mi++) {
      const subjectUrl = subjects[mi];
      process.stdout.write(`  model ${mi + 1}/${subjects.length} ${subjectUrl.split("/").pop()} … `);
      const out = await generateOne(t, subjectUrl);
      console.log(`✓ ${out}`);
      urls.push(out);
    }

    let meta = {};
    try {
      meta = t.meta && /^\s*[[{]/.test(t.meta) ? JSON.parse(t.meta) : {};
    } catch {
      meta = {};
    }
    meta.previewImages = urls;
    const metaJson = JSON.stringify(meta).replace(/'/g, "''");
    const first = urls[0].replace(/'/g, "''");
    await d1(
      `UPDATE templates SET
        preview_image = '${first}',
        meta = '${metaJson}',
        updated_at = datetime('now')
      WHERE id = '${id}'`
    );
    results[id] = { title: t.title, urls, subjects };
    ok++;
    console.log(`  saved carousel (${urls.length})`);
  } catch (e) {
    console.log(`✗ ${String(e.message).slice(0, 220)}`);
    fail++;
  }
}

const outPath = join(tmpdir(), `street-carousels-${Date.now()}.json`);
writeFileSync(outPath, JSON.stringify(results, null, 2));
writeFileSync(join(process.cwd(), "scripts/.street-carousel-results.json"), JSON.stringify(results, null, 2));
console.log(`\nDone: ${ok} ok, ${fail} failed`);
console.log(outPath);
console.log(JSON.stringify(results, null, 2));
