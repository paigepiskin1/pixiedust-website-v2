export const prerender = false;
import type { APIContext } from "astro";
import { isAdmin, auditAdmin } from "../../../../lib/admin";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

export async function POST({ request, locals }: APIContext) {
  if (!isAdmin(locals)) return json({ error: "Forbidden" }, 403);
  const env = locals.runtime.env;

  let body: { uid?: string; is_admin?: number };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "Invalid body" }, 400);
  }
  if (!body.uid) return json({ error: "uid required" }, 400);
  const flag = body.is_admin ? 1 : 0;

  const res = await env.DB.prepare("UPDATE users SET is_admin = ? WHERE uid = ?").bind(flag, body.uid).run();
  if (!res.meta.changes) return json({ error: "User not found" }, 404);
  await auditAdmin(env.DB, locals.user!.uid, "user.role", "user", body.uid, { is_admin: flag });
  return json({ ok: true, is_admin: flag });
}
