#!/usr/bin/env node
/**
 * Regenerate preset thumbnails from a single reference photo.
 * Usage: node scripts/dev.mjs node scripts/regen-preset-thumbs.mjs
 */
const SYNCNODE_KEY = process.env.SYNCNODE_API_KEY;
const DB_ID = process.env.CF_D1_DATABASE_ID || "105e2276-0d51-430a-8c6f-b4f7ee699aaf";
const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID || "15149dc8d99998b6c96a67c2cf52ad7c";
const CF_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

if (!SYNCNODE_KEY || !CF_TOKEN) {
  console.error("Missing SYNCNODE_API_KEY or CLOUDFLARE_API_TOKEN");
  process.exit(1);
}

const SUBJECT =
  process.env.SUBJECT_URL ||
  "https://pixiecdn.b-cdn.net/gen_d80b0323-9f76-44ee-bb08-a6aed948e196_1785163617749.png";

const IDS = [
  "preset-fisheye-ultra-wide",
  "cinestill-night",
  "polaroid-instant",
  "subway-platform-copy-2-copy-copy-copy", // Real HD Skin Enhance
  "kodak-gold",
  "preset-high-angle-down",
];

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
  if (!d.success) throw new Error(`D1 error: ${JSON.stringify(d.errors)}`);
  return d.result?.[0]?.results ?? [];
}

async function submit(model, input) {
  const r = await fetch("https://run.syncnode.ai/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey: SYNCNODE_KEY, model, input }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.job_id) throw new Error(d.error || d.detail || `Submit failed (${r.status})`);
  return d.job_id;
}

async function poll(jobId, maxMs = 240000) {
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

function prepareInput(raw) {
  const input = JSON.parse(raw);
  // Resolve aspect placeholders to a portrait catalog ratio.
  if (input.aspect_ratio === "{{aspect}}" || !input.aspect_ratio) {
    input.aspect_ratio = "2:3";
  }
  // Wire the subject into whichever field the model expects.
  if ("input_images" in input) {
    input.input_images = [SUBJECT];
  }
  if ("image_input" in input) {
    input.image_input = [SUBJECT];
  }
  if ("image" in input && typeof input.image === "string") {
    input.image = SUBJECT;
  }
  input.moderation = input.moderation || "low";
  return input;
}

const rows = await d1(
  `SELECT id, title, model, input_json FROM templates WHERE id IN (${IDS.map((i) => `'${i}'`).join(",")})`
);
const byId = Object.fromEntries(rows.map((r) => [r.id, r]));

const results = {};
let done = 0;
let failed = 0;

for (const id of IDS) {
  const t = byId[id];
  if (!t) {
    console.log(`skip ${id} (missing)`);
    failed++;
    continue;
  }
  process.stdout.write(`${t.title} (${id}) … `);
  try {
    const input = prepareInput(t.input_json);
    const jobId = await submit(t.model, input);
    const url = await poll(jobId);
    await d1(
      `UPDATE templates SET preview_image = '${url.replace(/'/g, "''")}', updated_at = datetime('now') WHERE id = '${id}'`
    );
    results[id] = url;
    console.log(`✓ ${url}`);
    done++;
  } catch (e) {
    console.log(`✗ ${e.message.slice(0, 160)}`);
    failed++;
  }
}

console.log(`\nDone: ${done} ok, ${failed} failed`);
console.log(JSON.stringify(results, null, 2));
