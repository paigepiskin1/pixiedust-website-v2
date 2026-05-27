export const prerender = false;
import type { APIContext } from "astro";
import { isAdmin, auditAdmin } from "../../../../lib/admin";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

export async function POST({ request, locals }: APIContext) {
  if (!isAdmin(locals)) return json({ error: "Forbidden" }, 403);
  const env = locals.runtime.env;
  let body: { id?: string; url?: string; type?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "Invalid body" }, 400);
  }
  if (!body.id || !body.url) return json({ error: "Missing id or url" }, 400);

  const isVideo = body.type === "video" || /\.(mp4|webm|mov)(\?|$)/i.test(body.url);
  const col = isVideo ? "preview_video" : "preview_image";
  const res = await env.DB.prepare(`UPDATE templates SET ${col} = ?, updated_at = datetime('now') WHERE id = ?`)
    .bind(body.url, body.id)
    .run();
  if (!res.meta.changes) return json({ error: "Template not found" }, 404);
  await auditAdmin(env.DB, locals.user!.uid, "template.set_preview", "template", body.id, { col, url: body.url });
  return json({ ok: true, field: col });
}
