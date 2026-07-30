#!/usr/bin/env node
/**
 * Seed 7 Street/Lifestyle photoshoots that recreate specific editorial scenes.
 * Prompts lock face + hair from the upload and never invent hair color / body type.
 *
 * Usage:
 *   node scripts/dev.mjs node scripts/seed-shoot-pinterest-scenes.mjs
 *   node scripts/dev.mjs node scripts/seed-shoot-pinterest-scenes.mjs --covers
 *   node scripts/dev.mjs node scripts/seed-shoot-pinterest-scenes.mjs --covers --force
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

// Safer clothed cover refs (avoid sports-bra shots that trip moderation).
const SUBJECTS = [
  "https://pixiecdn.b-cdn.net/uploads/ry1mTnFZgZYzASRGD2N0A6TbW5k1/355c2fcb-45ce-4523-a81a-90e1cddda0a4.png",
  "https://pixiecdn.b-cdn.net/uploads/ry1mTnFZgZYzASRGD2N0A6TbW5k1/9387528e-3f14-4bd6-8055-ff3b4dacd02b.png",
  "https://pixiecdn.b-cdn.net/gen_d80b0323-9f76-44ee-bb08-a6aed948e196_1779903685242.png",
  "https://pixiecdn.b-cdn.net/gen_d80b0323-9f76-44ee-bb08-a6aed948e196_1779903751526.png",
];

const FIELDS = [
  {
    key: "files",
    type: "file",
    label: "Your photos",
    required: true,
    multiple: true,
    max: 4,
    accept: "image/*",
    help: "Clear face + upper-body shots work best — we keep your face and hair from the upload",
  },
];

/** Identity lock — never invent hair color / body type; never describe those of the muse. */
const ID =
  "Put me from the reference photos into this exact scene. Keep my exact face, facial features, and hair from my uploaded photos — do not restyle my hair, invent a different hair color, or change my body type. Match my facial likeness sharply.";

const TEMPLATES = [
  {
    id: "street-elevator-fur-flash",
    title: "Elevator Fur Flash",
    category: "Street",
    subtitle: "Street · elevator · direct flash",
    description:
      "Arms out against brushed-metal elevator walls — shaggy fur jacket, patent mini, elbow gloves, slim shades, harsh flash.",
    prompt: `${ID} Standing centered in a brushed-metal elevator doorway, arms stretched out to both sides with palms flat against the elevator side panels, wide confident stance, looking straight at the camera with a fierce editorial expression. Wearing a voluminous cropped shaggy brown-and-black faux-fur jacket worn open and draped over the shoulders, a short black patent leather mini skirt with horizontal tiers and decorative front buckles, elbow-length glossy black gloves, slim black rectangular sunglasses, a black leather shoulder bag with a wide grommeted strap under one arm, and chunky silver earrings. Harsh direct-flash night-out photography, high contrast on metal walls, sharp shadows, fashion-editorial energy, no text overlays.`,
    tags: ["street", "elevator", "fur", "flash", "editorial", "y2k"],
    tone: "noir",
    accent: "var(--pd-ink)",
    sort: 50,
    subject: [SUBJECTS[0], SUBJECTS[1]],
  },
  {
    id: "street-bodega-snack-fisheye",
    title: "Bodega Snack Fisheye",
    category: "Street",
    subtitle: "Street · bodega aisle · digicam",
    description:
      "Ultra-wide digicam flash in a packed snack aisle — acid-wash crop jacket, low-rise mini, knee boots.",
    prompt: `${ID} Standing in the middle of a narrow convenience-store snack aisle packed with colorful chip bags and candy on wire shelves, one hand on hip, the other arm extended resting on a shelf edge, slight lean, confident street pose. Ultra-wide / fisheye digicam look with barrel distortion, harsh direct flash, grainy lo-fi film texture, bright recessed ceiling lights. Wearing a cropped dark acid-wash zip-up denim jacket with high collar and vertical ribbing, a very low-rise distressed olive-grey denim mini skirt with a circular metal logo patch on the hip, knee-high dark textured boots, and small dark wraparound sunglasses. Authentic bodega snapshot energy, no text overlays.`,
    tags: ["street", "bodega", "fisheye", "digicam", "snack", "y2k"],
    tone: "amber",
    accent: "var(--pd-amber)",
    sort: 51,
    subject: [SUBJECTS[1], SUBJECTS[2]],
  },
  {
    id: "street-bodega-cooler-pose",
    title: "Bodega Cooler Pose",
    category: "Street",
    subtitle: "Street · fridge aisle · film grain",
    description:
      "Hand on the cooler frame in a bodega drink aisle — white front-tie crop, oversized ripped jeans, sweater at the hips.",
    prompt: `${ID} Full-body pose inside a bodega convenience store drink aisle next to glass-front refrigerated coolers stocked with colorful cans, snack shelves on the other side, fluorescent green-yellow cast, grainy lo-fi film look. Standing casually with one hand reaching up resting on the top metal frame of the cooler door, head tilted slightly toward camera, relaxed expression, weight on one hip. Wearing a white front-tie crop top, oversized dark-wash blue jeans with heavy horizontal rips and shredded panels worn low on the hips, a white long-sleeve sweatshirt with a light-blue graphic print tied around the waist, and chunky black sneakers. Eye-level vertical composition, soft focus background, no text overlays. Do not add tattoos that are not in my reference photos.`,
    tags: ["street", "bodega", "cooler", "film", "ripped-jeans"],
    tone: "mint",
    accent: "var(--pd-mint)",
    sort: 52,
    subject: [SUBJECTS[2], SUBJECTS[3]],
  },
  {
    id: "street-stone-leather-editorial",
    title: "Stone Portico Editorial",
    category: "Street",
    subtitle: "Street · classical facade · leather",
    description:
      "Leaning on a classical stone ledge — black turtleneck, leather blazer on shoulders, leather shorts, burgundy tights and heels.",
    prompt: `${ID} Full-body editorial outdoor shot beside a grand classical stone building with ornate moldings and an ornate dark metal door. Leaning lower back against a low stone ledge, one arm extended with hand flat on the ledge, the other hand at the hip holding a small structured burgundy clutch, looking at the camera with a poised high-fashion expression, slightly low camera angle. Wearing a fitted black mock-neck turtleneck, an oversized black leather blazer draped open over the shoulders, black leather high-waisted shorts with a black belt and gold buckle, opaque deep burgundy tights, matching pointed burgundy high-heel pumps, slim dark-red tinted rectangular sunglasses, sleek burgundy leather gloves, and small chunky gold hoop earrings. Soft warm natural daylight, polished stone texture, monochrome-with-burgundy editorial look, no text overlays.`,
    tags: ["street", "editorial", "leather", "burgundy", "classical"],
    tone: "dusk",
    accent: "var(--pd-lilac)",
    sort: 53,
    subject: [SUBJECTS[0], SUBJECTS[3]],
  },
  {
    id: "studio-overhead-denim-digicam",
    title: "Overhead Denim Digicam",
    category: "Lifestyle",
    subtitle: "Lifestyle · bird's-eye · digicam",
    description:
      "Extreme high-angle wide shot leaning toward camera — denim halter + shorts, white socks, buckled heels, holding a digicam.",
    prompt: `${ID} Extreme high-angle bird's-eye editorial photo looking straight down, wide-angle lens with slight fisheye distortion so the head and shoulders feel larger. Leaning deep forward toward the camera looking up into the lens, torso almost parallel to the floor, one hand holding a small black point-and-shoot digital camera aimed at the viewer with a wrist strap, the other hand resting on a knee for balance. Wearing a light-wash denim halter top and matching frayed denim shorts, white ankle socks with beige pointed-toe slingback heels with a silver buckle on the toe, and large thick black-frame glasses with lightly rose-tinted lenses. Minimalist seamless off-white studio floor and backdrop, bright even editorial lighting, cool shadow tint, playful Y2K digicam fashion energy, no text overlays.`,
    tags: ["lifestyle", "studio", "overhead", "denim", "digicam", "y2k"],
    tone: "ice",
    accent: "var(--pd-teal)",
    sort: 54,
    subject: [SUBJECTS[1], SUBJECTS[0]],
  },
  {
    id: "street-times-square-lowbag",
    title: "Times Square Low Bag",
    category: "Street",
    subtitle: "Street · Times Square · ultra-wide",
    description:
      "Extreme low fisheye looking up mid-stride in a crosswalk — baby-blue set, silver platform boots, glossy pink tote filling the frame.",
    prompt: `${ID} Extreme low-angle ultra-wide / fisheye shot looking straight up from the crosswalk, mid-stride through Times Square NYC, skyscrapers and digital billboards curving inward from the lens distortion, bright daylight, white striped crosswalk. Looking down toward the camera with a confident expression, wearing slim dark rectangular sunglasses, holding a large glossy pale-pink designer tote bag very close to the lens so the bag dominates the foreground. Wearing a light-blue ribbed long-sleeve cropped sweater with matching light-blue mini shorts, reflective metallic silver platform boots with thick block heels and a chunky silver chain at the ankle, and a chunky silver chain necklace. High-energy NYC street editorial, sharp facial likeness, no text overlays.`,
    tags: ["street", "nyc", "times-square", "fisheye", "bag", "silver-boots"],
    tone: "lilac",
    accent: "var(--pd-lilac)",
    sort: 55,
    subject: [SUBJECTS[0], SUBJECTS[2]],
  },
  {
    id: "street-clocktower-butterfly-heels",
    title: "Clocktower Butterfly Heels",
    category: "Street",
    subtitle: "Street · low angle · Y2K platforms",
    description:
      "Dramatic low-angle wide stance under a brick clock tower — brown wrap crop, denim cutoffs, yellow wrap platforms with butterfly charms.",
    prompt: `${ID} Dramatic full-body extreme low-angle shot looking up from the ground, wide stance bent forward at the waist, one arm reaching down toward the camera holding sunglasses, the other arm extended high behind holding a small crescent beaded purse by a thin strap, one leg forward for depth. Standing on flat concrete with a large multi-story red brick building and central clock tower behind under a deep blue sky with fluffy white clouds. Wearing a long-sleeve chocolate-brown open-back crop top with thin wrap ties at the waist, very short dark-blue denim cutoff shorts, bright yellow satin platform sandals with chunky heels and long yellow wrap cords climbing up the legs to mid-thigh covered in colorful 3D butterfly appliqués in pink, blue, and yellow, large gold hoop earrings, and chunky colorful rings. Bright direct daylight, high-contrast saturated Y2K fashion energy, no text overlays.`,
    tags: ["street", "y2k", "butterfly", "platforms", "clocktower", "low-angle"],
    tone: "pink",
    accent: "var(--pd-pink)",
    sort: 56,
    subject: [SUBJECTS[3], SUBJECTS[1]],
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
    input_images: "{{files*}}",
    output_format: "webp",
    number_of_images: 1,
    output_compression: 90,
  };
}

function buildMeta(t) {
  return {
    kicker: `Photoshoot · ${t.title}`,
    howItWorks: [
      "Upload clear photos of yourself",
      "We recreate this exact scene, pose, and outfit on you",
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
  'shoot', 'image', ${sqlStr(t.category)}, 'replicate', 'openai/gpt-image-2',
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

const sqlPath = join(root, "migrations/0030_seed_shoot_pinterest_scenes.sql");
writeFileSync(
  sqlPath,
  `-- Editorial scene recreations (Street / Lifestyle). Face + hair locked from upload; no invented hair color / body type.\n${UPSERT}\n`
);
console.log("Wrote", sqlPath);

if (!CF_TOKEN) {
  console.warn("No CLOUDFLARE_API_TOKEN — wrote SQL only. Re-run with credentials to seed D1.");
  process.exit(0);
}

const r = spawnSync(
  "npx",
  ["wrangler", "d1", "execute", "pixiedust", "--remote", "--file", sqlPath],
  { cwd: root, env: process.env, stdio: "inherit", shell: true }
);
if ((r.status ?? 1) !== 0) process.exit(r.status ?? 1);
console.log("Seeded scene photoshoots into D1.");

if (!process.argv.includes("--covers")) {
  console.log("Done (seed only). Re-run with --covers to generate previews.");
  process.exit(0);
}

if (!SYNCNODE_KEY) {
  console.error("Missing SYNCNODE_API_KEY for --covers");
  process.exit(1);
}

const force = process.argv.includes("--force");

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

async function poll(jobId, maxMs = 300000) {
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
const previewUpdates = [];

for (const t of TEMPLATES) {
  const row = byId[t.id];
  if (row?.preview_image && !force) {
    console.log(`skip ${t.id} (has preview)`);
    previewUpdates.push({ id: t.id, url: row.preview_image });
    continue;
  }
  process.stdout.write(`${t.title} … `);
  try {
    const input = {
      ...buildInput(t.prompt),
      aspect_ratio: "2:3",
      input_images: t.subject,
    };
    const jobId = await submit("openai/gpt-image-2", input);
    const url = await poll(jobId);
    await d1(
      `UPDATE templates SET preview_image = '${url.replace(/'/g, "''")}', updated_at = datetime('now') WHERE id = '${t.id}'`
    );
    previewUpdates.push({ id: t.id, url });
    console.log(`✓ ${url}`);
    done++;
  } catch (e) {
    console.log(`✗ ${e.message.slice(0, 180)}`);
    failed++;
  }
}

if (previewUpdates.length) {
  const updates = previewUpdates
    .map(
      (p) =>
        `UPDATE templates SET preview_image = '${p.url.replace(/'/g, "''")}', updated_at = datetime('now') WHERE id = '${p.id}';`
    )
    .join("\n");
  const cur = await import("node:fs").then((fs) => fs.readFileSync(sqlPath, "utf8"));
  if (!cur.includes("-- Preview covers")) {
    writeFileSync(sqlPath, `${cur.trimEnd()}\n\n-- Preview covers\n${updates}\n`);
  }
}

console.log(`\nCovers: ${done} ok, ${failed} failed`);
