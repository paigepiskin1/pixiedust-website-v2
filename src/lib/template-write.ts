// Shared template create/update (INSERT OR REPLACE) used by the admin save
// endpoint and the AI create-from-prompt endpoint. Accepts string OR object
// for JSON columns (the AI returns objects; the form sends strings).
import type { D1Database } from "@cloudflare/workers-types";

const TEXT_COLS = ["id", "title", "kind", "type", "category", "provider", "model", "engine", "eta", "tone", "accent", "meta", "subtitle", "description", "preview_image", "preview_video"];
const JSON_COLS = ["input_json", "fields_json", "steps_json", "quality_json", "aspects_json", "quantities_json", "durations_json", "tags_json"];

function asJsonString(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (typeof v === "string") {
    JSON.parse(v); // throws if invalid
    return v;
  }
  return JSON.stringify(v);
}

export interface SaveResult {
  ok: boolean;
  id?: string;
  error?: string;
  status?: number;
}

export async function saveTemplate(db: D1Database, d: Record<string, any>): Promise<SaveResult> {
  const id = String(d.id || "").trim();
  if (!/^[a-z0-9-]{2,80}$/.test(id)) return { ok: false, error: "Slug must be 2–80 chars: a–z, 0–9, dash.", status: 400 };
  if (!d.title || !d.model) return { ok: false, error: "Title and model are required.", status: 400 };

  const jsons: Record<string, string | null> = {};
  for (const c of JSON_COLS) {
    try {
      jsons[c] = asJsonString(d[c]);
    } catch {
      return { ok: false, error: `${c} is not valid JSON.`, status: 400 };
    }
  }

  const val = (k: string) => (d[k] === "" || d[k] === undefined ? null : d[k]);
  const cols = [
    ...TEXT_COLS,
    ...JSON_COLS,
    "credit_cost", "price_per_second", "is_featured", "is_hidden", "sort_order", "updated_at",
  ];
  const binds = [
    ...TEXT_COLS.map((c) => val(c)),
    jsons.input_json ?? "{}",
    jsons.fields_json ?? "[]",
    jsons.steps_json,
    jsons.quality_json,
    jsons.aspects_json,
    jsons.quantities_json,
    jsons.durations_json,
    jsons.tags_json ?? "[]",
    Number(d.credit_cost) || 0,
    d.price_per_second ? Number(d.price_per_second) : null,
    d.is_featured ? 1 : 0,
    d.is_hidden ? 1 : 0,
    Number(d.sort_order) || 0,
    new Date().toISOString().replace("T", " ").slice(0, 19),
  ];

  try {
    await db.prepare(`INSERT OR REPLACE INTO templates (${cols.join(",")}) VALUES (${cols.map(() => "?").join(",")})`).bind(...binds).run();
  } catch (err) {
    return { ok: false, error: "DB error: " + String((err as Error).message || err), status: 500 };
  }
  return { ok: true, id };
}
