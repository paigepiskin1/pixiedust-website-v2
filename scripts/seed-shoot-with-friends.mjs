#!/usr/bin/env node
/**
 * Seed 10 "With Friends" photoshoot templates (dual You + Friend uploads).
 * Usage:
 *   node scripts/dev.mjs node scripts/seed-shoot-with-friends.mjs
 *   node scripts/dev.mjs node scripts/seed-shoot-with-friends.mjs --covers
 *   node scripts/dev.mjs node scripts/seed-shoot-with-friends.mjs --covers --force
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SYNCNODE_KEY = process.env.SYNCNODE_API_KEY;
const DB_ID = process.env.CF_D1_DATABASE_ID || "105e2276-0d51-430a-8c6f-b4f7ee699aaf";
const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID || "15149dc8d99998b6c96a67c2cf52ad7c";
const CF_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

const GIRL_A =
  "https://pixiecdn.b-cdn.net/uploads/ry1mTnFZgZYzASRGD2N0A6TbW5k1/355c2fcb-45ce-4523-a81a-90e1cddda0a4.png";
const GIRL_B =
  "https://pixiecdn.b-cdn.net/uploads/ry1mTnFZgZYzASRGD2N0A6TbW5k1/5055cf92-d177-4be1-9d81-33333e9b057d.png";
const GIRL_C =
  "https://pixiecdn.b-cdn.net/uploads/ry1mTnFZgZYzASRGD2N0A6TbW5k1/9387528e-3f14-4bd6-8055-ff3b4dacd02b.png";

const FIELDS = [
  {
    key: "person",
    type: "file",
    label: "You",
    required: true,
    accept: "image/*",
    ui: "square",
    help: "Main character — one clear face photo",
  },
  {
    key: "friend",
    type: "file",
    label: "Friend",
    required: true,
    accept: "image/*",
    ui: "square",
    help: "Friend — one clear face photo",
  },
];

const ROLE =
  "Use the first reference photo as me (main character) and the second reference photo as my friend. Keep both facial identities sharp and distinct — do not blend faces or swap who is who.";

/** @type {Array<{id:string,title:string,subtitle:string,description:string,prompt:string,tags:string[],tone:string,accent:string,pair:[string,string],sort:number}>} */
const TEMPLATES = [
  {
    id: "friends-concert-selfie",
    title: "Concert Besties",
    subtitle: "With Friends · concert selfie",
    description: "Cute duo selfie at a live concert — stage lights, crowd energy, both faces sharp.",
    prompt: `Generate a cute candid selfie of me and my friend at a packed outdoor concert at night. ${ROLE} Ultra-wide front-camera selfie, arms extended, both of us squeezed into frame smiling, colorful stage lights and bokeh behind us, crowd silhouettes, slight motion blur on lights, natural skin texture, authentic phone selfie energy, no text overlays.`,
    tags: ["friends", "concert", "selfie", "night", "duo"],
    tone: "lilac",
    accent: "var(--pd-lilac)",
    pair: [GIRL_A, GIRL_C],
    sort: 40,
  },
  {
    id: "friends-baseball-game",
    title: "Baseball Game Duo",
    subtitle: "With Friends · stadium digicam",
    description: "Two friends at a baseball game — digicam snapshot from a short distance in the stands.",
    prompt: `Generate a candid digital-camera photo of me and my friend at a baseball game. ${ROLE} Shot from a few steps away (not a close selfie) — both standing in the stadium seats, sunny afternoon, field and crowd soft in the background, slightly grainy early-2000s digicam look, on-camera flash optional, natural skin texture, authentic snapshot, no text overlays.`,
    tags: ["friends", "baseball", "stadium", "digicam", "duo"],
    tone: "amber",
    accent: "var(--pd-amber)",
    pair: [GIRL_A, GIRL_C],
    sort: 41,
  },
  {
    id: "friends-car-passenger-wide",
    title: "Car Passenger Wide",
    subtitle: "With Friends · wide car selfie",
    description: "Wide-angle passenger selfie — friend driving, me in passenger seat.",
    prompt: `Generate an ultra-wide front-camera selfie of me riding passenger while my friend drives. ${ROLE} Me in the passenger seat holding the phone, friend behind the wheel looking over, dashboard and windshield visible, sunny day road light, slight wide-angle distortion, candid car-ride energy, sharp facial likeness for both, natural skin texture, no text overlays.`,
    tags: ["friends", "car", "passenger", "wide", "selfie", "duo"],
    tone: "mint",
    accent: "var(--pd-mint)",
    pair: [GIRL_A, GIRL_C],
    sort: 42,
  },
  {
    id: "friends-car-overhead",
    title: "Car Overhead Duo",
    subtitle: "With Friends · overhead car selfie",
    description: "Phone held overhead looking down at both of us in the front seats.",
    prompt: `Generate an overhead high-angle car selfie of me and my friend in the front seats. ${ROLE} Phone held above us looking straight down, both faces looking up at the camera, steering wheel and lap area visible, soft daylight through the windshield, playful candid duo shot, sharp facial likeness for both, natural skin texture, no text overlays.`,
    tags: ["friends", "car", "overhead", "selfie", "duo"],
    tone: "teal",
    accent: "var(--pd-teal)",
    pair: [GIRL_A, GIRL_C],
    sort: 43,
  },
  {
    id: "friends-cafe-coffee",
    title: "Café Coffee Duo",
    subtitle: "With Friends · café selfie",
    description: "Cute café selfie with coffee cups — cozy table vibes.",
    prompt: `Generate a cute café selfie of me and my friend getting coffee together. ${ROLE} Sitting side by side at a small café table, iced coffees or lattes in frame, warm interior light, soft bokeh, cozy weekend energy, sharp facial likeness for both, natural skin texture, authentic phone selfie, no text overlays.`,
    tags: ["friends", "cafe", "coffee", "selfie", "duo"],
    tone: "amber",
    accent: "var(--pd-amber)",
    pair: [GIRL_A, GIRL_C],
    sort: 44,
  },
  {
    id: "friends-pilates-cafe",
    title: "Pilates Café Duo",
    subtitle: "With Friends · pink athleisure",
    description: "Post-pilates café photo in matching cute pink tanks, wrap tops, and leggings.",
    prompt: `Generate a trendy café photo of me and my friend right after pilates. ${ROLE} Both wearing cute matching-energy pink athleisure — pink tank tops or wrap tops with coordinating pink or blush leggings, sitting at a bright café with drinks, soft natural window light, polished influencer look, sharp facial likeness for both, natural skin texture, no text overlays.`,
    tags: ["friends", "pilates", "cafe", "pink", "athleisure", "duo"],
    tone: "pink",
    accent: "var(--pd-pink)",
    pair: [GIRL_A, GIRL_C],
    sort: 45,
  },
  {
    id: "friends-digicam-street",
    title: "Street Digicam Duo",
    subtitle: "With Friends · standing distance",
    description: "Digital-camera photo of two friends standing together on a city street from a short distance.",
    prompt: `Generate a candid early-2000s digital-camera photo of me and my friend standing together on a city sidewalk. ${ROLE} Photographed from a short distance (full upper-body / standing), not a close selfie — both posing casually side by side, daytime street, slight digicam grain and color cast, natural skin texture, authentic snapshot energy, no text overlays.`,
    tags: ["friends", "digicam", "street", "standing", "duo"],
    tone: "noir",
    accent: "var(--pd-ink)",
    pair: [GIRL_A, GIRL_C],
    sort: 46,
  },
  {
    id: "friends-night-out-flash",
    title: "Night Out Flash",
    subtitle: "With Friends · digicam flash",
    description: "Night-out digicam flash photo of two friends dressed up on the sidewalk.",
    prompt: `Generate a night-out digital-camera flash photo of me and my friend. ${ROLE} Standing together on a city sidewalk at night, dressed up, harsh on-camera flash, dark background with street lights, slight grain, candid party energy, sharp facial likeness for both, natural skin texture, no text overlays.`,
    tags: ["friends", "night", "flash", "digicam", "duo"],
    tone: "dusk",
    accent: "var(--pd-lilac)",
    pair: [GIRL_A, GIRL_C],
    sort: 47,
  },
  {
    id: "friends-mirror-bathroom",
    title: "Bathroom Mirror Duo",
    subtitle: "With Friends · mirror selfie",
    description: "Classic bathroom mirror selfie with a friend — tiled walls, flash.",
    prompt: `Generate a classic bathroom mirror selfie of me and my friend. ${ROLE} Standing in front of a bathroom mirror holding the phone, tiled walls, soft flash, cute matching energy, both faces clearly visible in the reflection, candid duo vibe, sharp facial likeness for both, natural skin texture, no text overlays.`,
    tags: ["friends", "mirror", "bathroom", "selfie", "duo"],
    tone: "pink",
    accent: "var(--pd-pink)",
    pair: [GIRL_A, GIRL_C],
    sort: 48,
  },
  {
    id: "friends-mall-digicam",
    title: "Mall Digicam Duo",
    subtitle: "With Friends · standing mall snap",
    description: "Standing-distance digicam photo of two friends at the mall.",
    prompt: `Generate a candid digital-camera photo of me and my friend standing together at a bright shopping mall. ${ROLE} Shot from a few steps away (standing distance, not a tight selfie), both posing casually near storefronts or an escalator, fluorescent mall lighting, slight digicam compression and grain, authentic Y2K snapshot energy, sharp facial likeness for both, natural skin texture, no text overlays.`,
    tags: ["friends", "mall", "digicam", "standing", "duo"],
    tone: "lilac",
    accent: "var(--pd-lilac)",
    pair: [GIRL_A, GIRL_C],
    sort: 49,
  },
];

function sqlStr(s) {
  return `'${String(s).replace(/'/g, "''")}'`;
}

function buildInput(prompt) {
  return {
    prompt,
    quality: "auto",
    background: "auto",
    moderation: "low",
    aspect_ratio: "{{aspect}}",
    input_images: ["{{person}}", "{{friend}}"],
    output_format: "webp",
    number_of_images: 1,
    output_compression: 90,
  };
}

function buildMeta(t) {
  return {
    kicker: `Photoshoot · ${t.title}`,
    howItWorks: [
      "Upload one photo of you and one of your friend",
      "We place both of you in the scene together",
      "Pick a ratio and generate",
    ],
  };
}

function rowSql(t) {
  const input = JSON.stringify(buildInput(t.prompt));
  const fields = JSON.stringify(FIELDS);
  const tags = JSON.stringify(t.tags);
  const meta = JSON.stringify(buildMeta(t));
  return `(
  ${sqlStr(t.id)},
  ${sqlStr(t.title)},
  'shoot', 'image', 'With Friends', 'replicate', 'openai/gpt-image-2',
  ${sqlStr(input)},
  ${sqlStr(fields)},
  5, NULL, '["match","1:1","2:3","3:2"]', '[1,2,4]',
  '~2 min', ${sqlStr(tags)}, ${sqlStr(t.tone)}, ${sqlStr(t.accent)},
  ${sqlStr(t.subtitle)},
  ${sqlStr(t.description)},
  NULL,
  ${sqlStr(meta)},
  1, 0, 0, 0, ${t.sort}, datetime('now')
)`;
}

const UPSERT = `
INSERT INTO templates (
  id, title, kind, type, category, provider, model,
  input_json, fields_json, credit_cost, quality_json, aspects_json, quantities_json,
  eta, tags_json, tone, accent, subtitle, description, preview_image, meta,
  is_featured, is_hidden, is_admin_only, is_adult, sort_order, updated_at
) VALUES
${TEMPLATES.map(rowSql).join(",\n")}
ON CONFLICT(id) DO UPDATE SET
  title=excluded.title,
  kind=excluded.kind,
  type=excluded.type,
  category=excluded.category,
  provider=excluded.provider,
  model=excluded.model,
  input_json=excluded.input_json,
  fields_json=excluded.fields_json,
  credit_cost=excluded.credit_cost,
  quality_json=excluded.quality_json,
  aspects_json=excluded.aspects_json,
  quantities_json=excluded.quantities_json,
  eta=excluded.eta,
  tags_json=excluded.tags_json,
  tone=excluded.tone,
  accent=excluded.accent,
  subtitle=excluded.subtitle,
  description=excluded.description,
  preview_image=COALESCE(templates.preview_image, excluded.preview_image),
  meta=excluded.meta,
  is_featured=excluded.is_featured,
  is_hidden=excluded.is_hidden,
  is_admin_only=excluded.is_admin_only,
  is_adult=excluded.is_adult,
  sort_order=excluded.sort_order,
  updated_at=excluded.updated_at;
`;

const sqlPath = join(root, "migrations/0029_seed_shoot_with_friends.sql");
writeFileSync(sqlPath, `-- With Friends: 10 duo photoshoot templates (You + Friend square uploads).\n${UPSERT}\n`);
console.log("Wrote", sqlPath);

const seedOnly = !process.argv.includes("--covers");
const force = process.argv.includes("--force");

if (!CF_TOKEN) {
  console.error("Missing CLOUDFLARE_API_TOKEN");
  process.exit(1);
}

const r = spawnSync(
  "npx",
  ["wrangler", "d1", "execute", "pixiedust", "--remote", "--file", sqlPath],
  { cwd: root, env: process.env, stdio: "inherit", shell: true }
);
if ((r.status ?? 1) !== 0) process.exit(r.status ?? 1);
console.log("Seeded With Friends templates into D1.");

if (seedOnly) {
  console.log("Done (seed only). Re-run with --covers to generate previews.");
  process.exit(0);
}

if (!SYNCNODE_KEY) {
  console.error("Missing SYNCNODE_API_KEY for --covers");
  process.exit(1);
}

async function d1(sql) {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/d1/database/${DB_ID}/query`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${CF_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ sql }),
    }
  );
  const d = await res.json();
  if (!d.success) throw new Error(`D1 error: ${JSON.stringify(d.errors)}`);
  return d.result?.[0]?.results ?? [];
}

async function submit(model, input) {
  const res = await fetch("https://run.syncnode.ai/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey: SYNCNODE_KEY, model, input }),
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok || !d.job_id) throw new Error(d.error || d.detail || `Submit failed (${res.status})`);
  return d.job_id;
}

async function poll(jobId, maxMs = 240000) {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 5000));
    const res = await fetch(
      `https://run.syncnode.ai/prediction-status?job_id=${encodeURIComponent(jobId)}&apiKey=${encodeURIComponent(SYNCNODE_KEY)}`
    );
    const d = await res.json().catch(() => ({}));
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

const ids = TEMPLATES.map((t) => t.id);
const existing = await d1(
  `SELECT id, preview_image FROM templates WHERE id IN (${ids.map((i) => `'${i}'`).join(",")})`
);
const byId = Object.fromEntries(existing.map((r) => [r.id, r]));

let done = 0;
let failed = 0;
for (const t of TEMPLATES) {
  const row = byId[t.id];
  if (row?.preview_image && !force) {
    console.log(`skip ${t.id} (has preview)`);
    continue;
  }
  process.stdout.write(`${t.title} … `);
  try {
    const input = {
      ...buildInput(t.prompt),
      aspect_ratio: "2:3",
      input_images: t.pair,
    };
    const jobId = await submit("openai/gpt-image-2", input);
    const url = await poll(jobId);
    await d1(
      `UPDATE templates SET preview_image = '${url.replace(/'/g, "''")}', updated_at = datetime('now') WHERE id = '${t.id}'`
    );
    console.log(`✓ ${url}`);
    done++;
  } catch (e) {
    console.log(`✗ ${e.message.slice(0, 160)}`);
    failed++;
  }
}
console.log(`\nCovers: ${done} ok, ${failed} failed`);
