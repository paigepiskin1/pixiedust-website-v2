export const prerender = false;
import type { APIContext } from "astro";
import { isAdmin, auditAdmin } from "../../../../lib/admin";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

export async function POST({ request, locals }: APIContext) {
  if (!isAdmin(locals)) return json({ error: "Forbidden" }, 403);
  const env = locals.runtime.env;
  let id: string | undefined;
  try {
    ({ id } = (await request.json()) as { id?: string });
  } catch {
    return json({ error: "Invalid body" }, 400);
  }
  if (!id) return json({ error: "Missing id" }, 400);
  const res = await env.DB.prepare("DELETE FROM generations WHERE id = ?").bind(id).run();
  if (!res.meta.changes) return json({ error: "Not found" }, 404);
  await auditAdmin(env.DB, locals.user!.uid, "generation.delete", "generation", id);
  return json({ ok: true });
}
