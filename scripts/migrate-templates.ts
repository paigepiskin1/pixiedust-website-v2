// Migrate legacy templates (old RDS `templates`) into the new D1 schema.
// Converts old params (legacy "__USER_INPUT__:type|Label|req|desc|opts" + {{key}})
// into input_json ({{placeholders}}) + typed fields_json. Carries preview media,
// model, featured flag; rescales token_cost -> credit_cost. New ids are "old-<slug>".
//   DBHOST=... DBUSER=... DBPASS=... DBNAME=... npx tsx scripts/migrate-templates.ts
//   npx wrangler d1 execute pixiedust --local  --file=seed/migrate-templates.sql
//   npx wrangler d1 execute pixiedust --remote --file=seed/migrate-templates.sql
import mysql from "mysql2/promise";
import { writeFileSync, mkdirSync } from "node:fs";

const env = process.env;
const sq = (v: unknown) => (v == null || v === "" ? "NULL" : `'${String(v).replace(/'/g, "''")}'`);
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
const humanize = (k: string) => k.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const TONES = ["teal", "lilac", "mint", "pink", "noir", "dusk", "ice", "amber"];

interface OldT {
  id: number; title: string; type: string; sync_node: number;
  syncnode_model: string | null; syncnode_params: string | null;
  replicate_model: string | null; replicate_params: string | null;
  tag_ids: string | null; token_cost: number | null; is_featured: number; is_hidden: number;
  thumbnail_path: string | null; video_path: string | null;
}

function convertParams(raw: unknown): { input: Record<string, unknown>; fields: Array<Record<string, unknown>> } {
  const input: Record<string, unknown> = {};
  const fields: Array<Record<string, unknown>> = [];
  const seen = new Set<string>();
  let obj: Record<string, unknown> = {};
  // mysql2 returns JSON columns already parsed (object); plain TEXT comes as a string.
  if (raw && typeof raw === "object") obj = raw as Record<string, unknown>;
  else if (typeof raw === "string") { try { obj = JSON.parse(raw); } catch { obj = {}; } }

  const addField = (f: Record<string, unknown>) => { if (!seen.has(f.key as string)) { seen.add(f.key as string); fields.push(f); } };
  const guess = (k: string) => (/(prompt|caption|description|negative)/i.test(k) ? "textarea" : /(image|img|photo|file|mask|video)/i.test(k) ? "file" : /(num|count|steps|scale|strength|fps|duration|seed|width|height)/i.test(k) ? "number" : "text");

  for (const [key, val] of Object.entries(obj)) {
    if (typeof val === "string" && val.startsWith("__USER_INPUT__:")) {
      const parts = val.slice("__USER_INPUT__:".length).split("|");
      const type = (parts[0] || "text").trim();
      const required = (parts[2] || "").trim().toLowerCase() === "required";
      input[key] = `{{${key}${required ? "*" : ""}}}`;
      const f: Record<string, unknown> = { key, type, label: (parts[1] || humanize(key)).trim(), required };
      if (parts[3]) f.help = parts[3].trim();
      if (parts[4]) f.options = parts[4].split(",").map((o) => ({ value: o.trim(), label: o.trim() }));
      if (/image|img|photo|mask/i.test(key)) f.accept = "image/*";
      else if (/video/i.test(key)) f.accept = "video/*";
      addField(f);
    } else if (typeof val === "string" && /\{\{(\w+)\*?\}\}/.test(val)) {
      input[key] = val;
      for (const m of val.matchAll(/\{\{(\w+)(\*?)\}\}/g)) {
        addField({ key: m[1], type: guess(m[1]), label: humanize(m[1]), required: m[2] === "*" });
      }
    } else {
      input[key] = val;
    }
  }
  return { input, fields };
}

const conn = await mysql.createConnection({ host: env.DBHOST, user: env.DBUSER, password: env.DBPASS, database: env.DBNAME, connectTimeout: 15000 });

// tag id -> name
const [tagRows] = await conn.query("SELECT tag_id, tag_name FROM tags");
const tagMap: Record<string, string> = {};
for (const t of tagRows as any[]) tagMap[String(t.tag_id)] = t.tag_name;

const [rows] = await conn.query("SELECT * FROM templates ORDER BY id");
await conn.end();
const templates = rows as unknown as OldT[];

const usedIds = new Set<string>();
const values: string[] = [];
let order = 1000; // after seeded templates

for (const t of templates) {
  // Legacy data is inconsistent: params/model can live in either the syncnode_*
  // or replicate_* column regardless of the sync_node flag. Pick whichever has content.
  const model = [t.replicate_model, t.syncnode_model].find((m) => m && String(m).trim()) || "";
  if (!model) continue;
  const provider = model.startsWith("fal-ai/") ? "fal" : "replicate";
  const raw = [t.syncnode_params, t.replicate_params].find((p) => p && String(p).trim()) || null;
  const { input, fields } = convertParams(raw);

  let id = "old-" + slug(t.title || `template-${t.id}`);
  while (usedIds.has(id)) id = id + "-" + t.id;
  usedIds.add(id);

  let tags: string[] = [];
  try { tags = (JSON.parse(t.tag_ids || "[]") as unknown[]).map((x) => tagMap[String(x)]).filter(Boolean); } catch {}

  const isVideo = t.type === "video";
  const kind = isVideo ? "i2v" : "preset";
  const creditCost = Math.max(1, Math.round((t.token_cost ?? 20) / 10)); // rescale legacy credits
  const engine = /seedance/i.test(model) ? "Seedance Lite" : /flux/i.test(model) ? "Flux" : model.split("/").pop() || "Replicate";
  const tone = TONES[order % TONES.length];

  const cols = [
    sq(id), sq(t.title), sq(kind), sq(t.type || "image"), sq(tags[0] ?? null),
    sq(provider), sq(model),
    sq(JSON.stringify(input)), sq(JSON.stringify(fields)), "NULL",
    String(creditCost), "NULL", "NULL",
    sq(JSON.stringify(isVideo ? { std: 1, pro: 1.5, cinema: 2.5 } : { std: 1, pro: 1.5, cinema: 2.5 })),
    sq(JSON.stringify(isVideo ? ["16:9", "9:16", "1:1"] : ["1:1", "4:5", "16:9", "9:16"])),
    sq(JSON.stringify(isVideo ? [1] : [1, 2, 4])),
    sq(engine), sq(isVideo ? "~60s" : "~10s"), sq(JSON.stringify(tags)),
    sq(tone), sq("var(--pd-lilac)"), "NULL",
    sq(null), sq(null),
    sq(t.thumbnail_path), sq(t.video_path),
    String(t.is_featured ? 1 : 0), "0", "0", String(order++),
  ];
  values.push(`(${cols.join(",")})`);
}

const colNames =
  "id,title,kind,type,category,provider,model,input_json,fields_json,steps_json,credit_cost,price_per_second,durations_json,quality_json,aspects_json,quantities_json,engine,eta,tags_json,tone,accent,meta,subtitle,description,preview_image,preview_video,is_featured,is_hidden,is_adult,sort_order";

const sql = [
  `-- Migrated ${values.length} legacy templates. Idempotent by id (old-<slug>). Generated ${new Date().toISOString()}.`,
  `INSERT OR REPLACE INTO templates (${colNames}) VALUES`,
  values.join(",\n") + ";",
  "",
].join("\n");

mkdirSync("seed", { recursive: true });
writeFileSync("seed/migrate-templates.sql", sql);
console.log(`Wrote seed/migrate-templates.sql — ${values.length} templates (${templates.filter((t) => t.type === "video").length} video).`);
