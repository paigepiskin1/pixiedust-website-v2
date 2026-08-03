#!/usr/bin/env node
// Usage: node scripts/dev.mjs node scripts/gen-selfie-location-previews.mjs [--force]
import { readFileSync, existsSync } from "node:fs";

const SYNCNODE_KEY = process.env.SYNCNODE_API_KEY;
const DB_ID = process.env.CF_D1_DATABASE_ID || "105e2276-0d51-430a-8c6f-b4f7ee699aaf";
const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID || "15149dc8d99998b6c96a67c2cf52ad7c";
const CF_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const FORCE = process.argv.includes("--force");
const MODEL = "openai/gpt-image-2";
const SUBJECTS = [
  "https://pixiecdn.b-cdn.net/uploads/ry1mTnFZgZYzASRGD2N0A6TbW5k1/355c2fcb-45ce-4523-a81a-90e1cddda0a4.png",
  "https://pixiecdn.b-cdn.net/uploads/ry1mTnFZgZYzASRGD2N0A6TbW5k1/5055cf92-d177-4be1-9d81-33333e9b057d.png",
  "https://pixiecdn.b-cdn.net/uploads/ry1mTnFZgZYzASRGD2N0A6TbW5k1/9387528e-3f14-4bd6-8055-ff3b4dacd02b.png",
];
const IDS = [
  "bali-motorcycle-selfie",
  "santa-teresa-surf-sunset",
  "hawaii-surf-gopro",
  "rangerover-latte-selfie",
  "paris-cafe-terrace-selfie",
  "tokyo-neon-night-selfie",
  "amalfi-cliff-selfie",
  "london-black-cab-selfie",
  "santorini-caldera-selfie",
  "lake-como-boat-selfie",
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
  if (!d.success) throw new Error(JSON.stringify(d.errors));
  return d.result?.[0]?.results ?? [];
}
async function submit(input) {
  const r = await fetch("https://run.syncnode.ai/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey: SYNCNODE_KEY, model: MODEL, input }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.job_id) throw new Error(d.error || d.detail || `Submit ${r.status}`);
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
      if (Array.isArray(out) && out.length) return typeof out[0] === "string" ? out[0] : (out[0]?.url ?? out[0]);
      if (out?.url) return out.url;
      throw new Error("No output URL");
    }
    if (["failed", "FAILED", "CANCELED", "error"].includes(st)) throw new Error(String(d.output || d.error).slice(0, 200));
  }
  throw new Error("Timed out");
}

const rows = await d1(`SELECT id, input_json, preview_image FROM templates WHERE id IN (${IDS.map((i) => `'${i}'`).join(",")})`);
const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
let done = 0, failed = 0;
for (const id of IDS) {
  const t = byId[id];
  if (!t) { console.log("missing", id); failed++; continue; }
  if (t.preview_image && !FORCE) { console.log("skip", id); continue; }
  const input = JSON.parse(t.input_json);
  input.input_images = SUBJECTS;
  input.aspect_ratio = "2:3";
  input.moderation = "low";
  process.stdout.write(`${id} … `);
  try {
    const jobId = await submit(input);
    const url = await poll(jobId);
    await d1(`UPDATE templates SET preview_image = '${url.replace(/'/g, "''")}', updated_at = datetime('now') WHERE id = '${id}'`);
    console.log("✓", url.slice(0, 70));
    done++;
  } catch (e) {
    console.log("✗", String(e.message).slice(0, 120));
    failed++;
  }
}
console.log(`Done: ${done} ok, ${failed} failed`);
