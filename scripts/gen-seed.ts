// Generates seed/seed.sql from the catalog datasets so D1 content matches the
// catalog UI. Run: npx tsx scripts/gen-seed.ts  → then apply with wrangler.
import { writeFileSync, mkdirSync } from "node:fs";
import { PRESETS, SHOOTS, VIDEO, MOTION, BEAUTY, FASHION, AVATAR, AD } from "../src/lib/catalog";
import type { CatalogItem } from "../src/lib/catalog";

const IMG_MODEL = "black-forest-labs/flux-schnell";
const VID_MODEL = "bytedance/seedance-1-lite";

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const sq = (s: unknown) => (s == null ? "NULL" : `'${String(s).replace(/'/g, "''")}'`);
const j = (o: unknown) => (o == null ? "NULL" : `'${JSON.stringify(o).replace(/'/g, "''")}'`);

interface Built {
  type: "image" | "video";
  input: Record<string, unknown>;
  fields: unknown[];
  quality: Record<string, number>;
  aspects: string[];
  quantities: number[];
  engine: string;
  eta: string;
}

function buildImage(item: CatalogItem): Built {
  return {
    type: "image",
    input: {
      prompt: `{{prompt}}, in the style of ${item.name} — ${item.sub ?? ""}`.trim(),
      go_fast: true,
      num_outputs: 1,
      aspect_ratio: "1:1",
      output_format: "webp",
    },
    fields: [
      { key: "prompt", type: "textarea", label: "Your subject", required: true, placeholder: "e.g. a woman in a leather jacket on a rainy street" },
    ],
    quality: { std: 1, pro: 1.5, cinema: 2.5 },
    aspects: ["1:1", "4:5", "16:9", "9:16"],
    quantities: [1, 2, 4],
    engine: "Flux Schnell",
    eta: "~10s",
  };
}

function buildVideo(item: CatalogItem): Built {
  return {
    type: "video",
    input: {
      prompt: `{{prompt}}, ${item.name} style`,
      duration: 5,
      aspect_ratio: "16:9",
      resolution: "720p",
      fps: 24,
      camera_fixed: false,
    },
    fields: [
      { key: "prompt", type: "textarea", label: "Describe the scene", required: true, placeholder: "e.g. a model walking a neon-lit runway, slow motion" },
    ],
    quality: { std: 1, pro: 1.5, cinema: 2.5 },
    aspects: ["16:9", "9:16", "1:1"],
    quantities: [1],
    engine: "Seedance Lite",
    eta: "~60s",
  };
}

const videoKind = (c?: string) =>
  c === "Cinematic" ? "cinema" : c === "Fashion" ? "fashion-video" : c === "Video Game" ? "game-video" : "i2v";

interface Dataset {
  items: CatalogItem[];
  kind: string | ((it: CatalogItem) => string);
  video?: boolean;
}
const datasets: Dataset[] = [
  { items: PRESETS, kind: "preset" },
  { items: SHOOTS, kind: "shoot" },
  { items: VIDEO, kind: (it) => videoKind(it.c), video: true },
  { items: MOTION, kind: "motion", video: true },
  { items: BEAUTY, kind: "beauty" },
  { items: FASHION, kind: "fashion" },
  { items: AVATAR, kind: "avatar" },
  { items: AD, kind: "ad" },
];

const rows: string[] = [];
let order = 0;
for (const ds of datasets) {
  ds.items.forEach((item, idx) => {
    const kind = typeof ds.kind === "function" ? ds.kind(item) : ds.kind;
    const b = ds.video ? buildVideo(item) : buildImage(item);
    const id = `${kind}-${slug(item.name)}`;
    const featured = idx < 2 ? 1 : 0;
    const cols = [
      sq(id), sq(item.name), sq(kind), sq(b.type), sq(item.c ?? null),
      sq("replicate"), sq(ds.video ? VID_MODEL : IMG_MODEL),
      j(b.input), j(b.fields), "NULL",
      String(item.cr ?? 1), j(b.quality), j(b.aspects), j(b.quantities),
      sq(b.engine), sq(b.eta), j([item.tag, item.c].filter(Boolean)),
      sq(item.tone), sq(item.accent), sq(item.meta ?? null),
      sq(item.sub ?? null), sq(`${item.name} — ${item.sub ?? ""}`.trim()),
      "NULL", "NULL", String(featured), "0", "0", String(order++),
    ];
    rows.push(`(${cols.join(",")})`);
  });
}

// One multi-step studio template to exercise steps_json (Avatar builder).
const avatarSteps = [
  {
    id: "source",
    title: "Source",
    subtitle: "Upload a base photo or describe one",
    fields: [
      { key: "photo", type: "file", label: "Base photo", accept: "image/*", help: "Optional — leave blank to generate from scratch" },
      { key: "prompt", type: "textarea", label: "Describe yourself", required: true, placeholder: "e.g. 28yo woman, freckles, auburn hair" },
    ],
  },
  {
    id: "customize",
    title: "Customize",
    fields: [
      { key: "hair", type: "select", label: "Hair", default: "as-is", options: [{ value: "as-is", label: "Keep" }, { value: "long-waves", label: "Long waves" }, { value: "bob", label: "Bob" }] },
      { key: "outfit", type: "select", label: "Outfit", default: "editorial", options: [{ value: "editorial", label: "Editorial" }, { value: "streetwear", label: "Streetwear" }, { value: "formal", label: "Formal" }] },
    ],
  },
];
const avatarInput = {
  prompt: "{{prompt}}, {{hair}} hair, wearing {{outfit}}, studio portrait, photorealistic",
  go_fast: true,
  num_outputs: 1,
  aspect_ratio: "4:5",
  output_format: "webp",
};
rows.push(
  `(${[
    sq("avatar-builder"), sq("Avatar Builder"), sq("avatar"), sq("image"), sq(null),
    sq("replicate"), sq(IMG_MODEL),
    j(avatarInput), j([]), j(avatarSteps),
    "4", j({ std: 1, pro: 1.5, cinema: 2.5 }), j(["1:1", "4:5", "9:16"]), j([1, 2, 4]),
    sq("Flux Schnell"), sq("~12s"), j(["Avatar", "Multi-step"]),
    sq("lilac"), sq("var(--pd-lilac)"), sq(null),
    sq("Build a custom avatar"), sq("Source · customize · generate — a multi-step builder."),
    "NULL", "NULL", "1", "0", "0", String(order++),
  ].join(",")})`
);

const templateCols =
  "id,title,kind,type,category,provider,model,input_json,fields_json,steps_json,credit_cost,quality_json,aspects_json,quantities_json,engine,eta,tags_json,tone,accent,meta,subtitle,description,preview_image,preview_video,is_featured,is_hidden,is_adult,sort_order";

const tiers = `INSERT OR REPLACE INTO subscription_tiers
 (id,name,price_cents,annual_price_cents,monthly_credits,pack_discount_pct,rate_limit_per_min,concurrency,features_json,sort_order,is_active) VALUES
 ('free','Free',0,0,5,0,6,3,${j(["5 credits / mo", "Watermarked", "Standard queue"])},0,1),
 ('plus','Plus',1500,15000,500,40,20,8,${j(["500 credits / mo", "No watermark", "Priority queue", "HD output"])},1,1),
 ('studio','Studio',4500,45000,2000,60,60,20,${j(["2000 credits / mo", "Commercial license", "4K output", "Custom workflows"])},2,1);`;

const packs = `INSERT OR REPLACE INTO credit_packs
 (id,name,credits,price_cents,subscriber_price_cents,badge,sort_order,is_active) VALUES
 ('starter','Starter',100,800,600,NULL,0,1),
 ('creator','Creator',500,3200,2200,'Best value',1,1),
 ('pro','Pro',2000,9600,6400,NULL,2,1);`;

const sql = [
  "-- Generated by scripts/gen-seed.ts — do not edit by hand. Re-run the script to regenerate.",
  "DELETE FROM templates;",
  `INSERT OR REPLACE INTO templates (${templateCols}) VALUES\n${rows.join(",\n")};`,
  "",
  "DELETE FROM subscription_tiers;",
  tiers,
  "",
  "DELETE FROM credit_packs;",
  packs,
  "",
].join("\n");

mkdirSync("seed", { recursive: true });
writeFileSync("seed/seed.sql", sql);
console.log(`Wrote seed/seed.sql — ${rows.length} templates, 3 tiers, 3 packs.`);
