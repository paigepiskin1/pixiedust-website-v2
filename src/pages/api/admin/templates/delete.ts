export const prerender = false;
import type { APIContext } from "astro";
import { adminActor, auditAdmin } from "../../../../lib/admin";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

export async function POST({ request, locals }: APIContext) {
  const env = locals.runtime.env;
  const actor = adminActor(request, locals, env.ADMIN_API_TOKEN);
  if (!actor) return json({ error: "Forbidden" }, 403);
  let id: string | undefined;
  try {
    ({ id } = (await request.json()) as { id?: string });
  } catch {
    return json({ error: "Invalid body" }, 400);
  }
  if (!id) return json({ error: "Missing id" }, 400);
  const res = await env.DB.prepare("DELETE FROM templates WHERE id = ?").bind(id).run();
  if (!res.meta.changes) return json({ error: "Not found" }, 404);
  await auditAdmin(env.DB, actor, "template.delete", "template", id);
  return json({ ok: true });
}
