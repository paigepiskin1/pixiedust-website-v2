export const prerender = false;
import type { APIContext } from "astro";
import { adminActor, auditAdmin } from "../../../lib/admin";
import { saveTemplate } from "../../../lib/template-write";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

// List templates (for Claude Code / admin tooling).
export async function GET({ request, locals }: APIContext) {
  const env = locals.runtime.env;
  if (!adminActor(request, locals, env.ADMIN_API_TOKEN)) return json({ error: "Forbidden" }, 403);
  const { results } = await env.DB.prepare(
    "SELECT id, title, kind, type, credit_cost, is_featured, is_hidden, (preview_image IS NOT NULL OR preview_video IS NOT NULL) AS has_example FROM templates ORDER BY sort_order, title"
  ).all();
  return json({ templates: results ?? [] });
}

export async function POST({ request, locals }: APIContext) {
  const env = locals.runtime.env;
  const actor = adminActor(request, locals, env.ADMIN_API_TOKEN);
  if (!actor) return json({ error: "Forbidden" }, 403);

  let d: Record<string, any>;
  try {
    d = (await request.json()) as Record<string, any>;
  } catch {
    return json({ error: "Invalid body" }, 400);
  }

  const wasNew = !!d._wasNew;
  const res = await saveTemplate(env.DB, d);
  if (!res.ok) return json({ error: res.error }, res.status ?? 400);

  await auditAdmin(env.DB, actor, wasNew ? "template.create" : "template.update", "template", res.id ?? null, { title: d.title });
  return json({ ok: true, id: res.id });
}
