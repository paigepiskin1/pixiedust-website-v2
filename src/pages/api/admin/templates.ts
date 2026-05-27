export const prerender = false;
import type { APIContext } from "astro";
import { isAdmin, auditAdmin } from "../../../lib/admin";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

const TEXT_COLS = ["id", "title", "kind", "type", "category", "provider", "model", "engine", "eta", "tone", "accent", "meta", "subtitle", "description", "preview_image", "preview_video"];
const JSON_COLS = ["input_json", "fields_json", "steps_json", "quality_json", "aspects_json", "quantities_json", "tags_json"];

export async function POST({ request, locals }: APIContext) {
  if (!isAdmin(locals)) return json({ error: "Forbidden" }, 403);
  const env = locals.runtime.env;

  let d: Record<string, any>;
  try {
    d = (await request.json()) as Record<string, any>;
  } catch {
    return json({ error: "Invalid body" }, 400);
  }

  const id = String(d.id || "").trim();
  if (!/^[a-z0-9-]{2,80}$/.test(id)) return json({ error: "Slug must be 2–80 chars: a–z, 0–9, dash." }, 400);
  if (!d.title || !d.model) return json({ error: "Title and model are required." }, 400);

  // Validate JSON columns
  for (const c of JSON_COLS) {
    const raw = String(d[c] ?? "").trim();
    if (!raw) continue;
    try {
      JSON.parse(raw);
    } catch {
      return json({ error: `${c} is not valid JSON.` }, 400);
    }
  }

  const val = (k: string) => (d[k] === "" || d[k] === undefined ? null : d[k]);
  const text: Record<string, unknown> = {};
  for (const c of TEXT_COLS) text[c] = val(c);
  const jsons: Record<string, unknown> = {};
  for (const c of JSON_COLS) jsons[c] = String(d[c] ?? "").trim() || null;

  const cols = [
    ...TEXT_COLS,
    "input_json", "fields_json", "steps_json", "quality_json", "aspects_json", "quantities_json", "tags_json",
    "credit_cost", "is_featured", "is_hidden", "sort_order", "updated_at",
  ];
  const placeholders = cols.map(() => "?").join(",");
  const binds = [
    ...TEXT_COLS.map((c) => text[c]),
    jsons.input_json ?? "{}",
    jsons.fields_json ?? "[]",
    jsons.steps_json,
    jsons.quality_json,
    jsons.aspects_json,
    jsons.quantities_json,
    jsons.tags_json ?? "[]",
    Number(d.credit_cost) || 0,
    d.is_featured ? 1 : 0,
    d.is_hidden ? 1 : 0,
    Number(d.sort_order) || 0,
    new Date().toISOString().replace("T", " ").slice(0, 19),
  ];

  try {
    await env.DB.prepare(`INSERT OR REPLACE INTO templates (${cols.join(",")}) VALUES (${placeholders})`).bind(...binds).run();
  } catch (err) {
    return json({ error: "DB error: " + String((err as Error).message || err) }, 500);
  }

  await auditAdmin(env.DB, locals.user!.uid, d._wasNew ? "template.create" : "template.update", "template", id, { title: d.title });
  return json({ ok: true, id });
}
