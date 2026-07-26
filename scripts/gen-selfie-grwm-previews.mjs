#!/usr/bin/env node
// Generate cover previews for the GRWM / tropical selfie shoots via SyncNode.
// Usage: node scripts/dev.mjs node scripts/gen-selfie-grwm-previews.mjs
import { readFileSync, existsSync } from "node:fs";

const SYNCNODE_KEY = process.env.SYNCNODE_API_KEY;
const DB_ID = process.env.CF_D1_DATABASE_ID || "105e2276-0d51-430a-8c6f-b4f7ee699aaf";
const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID || "15149dc8d99998b6c96a67c2cf52ad7c";
const CF_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
if (!SYNCNODE_KEY || !CF_TOKEN) {
  console.error("Missing SYNCNODE_API_KEY or CLOUDFLARE_API_TOKEN");
  process.exit(1);
}

const SUBJECTS = (() => {
  try {
    if (existsSync("scripts/subjects.json")) {
      const arr = JSON.parse(readFileSync("scripts/subjects.json", "utf8"));
      if (Array.isArray(arr) && arr.length) return arr;
    }
  } catch {}
  return ["https://pixiecdn.b-cdn.net/gen_d80b0323-9f76-44ee-bb08-a6aed948e196_1779890226156.png"];
})();

const IDS = [
  "grwm-lipgloss-selfie",
  "grwm-face-cream-selfie",
  "facial-bed-selfie",
  "ocean-underwater-selfie",
  "tropical-wet-hair-selfie",
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

async function poll(jobId, maxMs = 180000) {
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

const rows = await d1(
  `SELECT id, title, model, input_json, preview_image FROM templates WHERE id IN (${IDS.map((i) => `'${i}'`).join(",")})`
);
const byId = Object.fromEntries(rows.map((r) => [r.id, r]));

let done = 0, failed = 0;
for (let i = 0; i < IDS.length; i++) {
  const id = IDS[i];
  const t = byId[id];
  if (!t) {
    console.log(`skip ${id} (missing)`);
    continue;
  }
  if (t.preview_image) {
    console.log(`skip ${id} (has preview)`);
    continue;
  }
  const subject = SUBJECTS[i % SUBJECTS.length];
  let input;
  try {
    input = JSON.parse(t.input_json);
  } catch {
    console.log(`✗ ${id} bad input_json`);
    failed++;
    continue;
  }
  input.input_images = [subject];
  input.aspect_ratio = "2:3";
  delete input.number_of_images; // keep if model wants it
  process.stdout.write(`${id} … `);
  try {
    const jobId = await submit(t.model || "openai/gpt-image-2", input);
    const url = await poll(jobId);
    await d1(`UPDATE templates SET preview_image = '${url.replace(/'/g, "''")}', updated_at = datetime('now') WHERE id = '${id}'`);
    console.log(`✓ ${url.slice(0, 70)}`);
    done++;
  } catch (e) {
    console.log(`✗ ${e.message.slice(0, 120)}`);
    failed++;
  }
}
console.log(`\nDone: ${done} ok, ${failed} failed`);
