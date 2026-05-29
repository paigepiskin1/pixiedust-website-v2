export const prerender = false;
import type { APIContext } from "astro";
import { isAdmin, auditAdmin } from "../../../../lib/admin";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

/** Toggle an account's disabled state. Disabled users are treated as logged-out
 * everywhere (middleware) and cannot create a new session. */
export async function POST({ request, locals }: APIContext) {
  if (!isAdmin(locals)) return json({ error: "Forbidden" }, 403);
  const env = locals.runtime.env;

  let body: { uid?: string; disabled?: boolean };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "Invalid body" }, 400);
  }
  if (!body.uid) return json({ error: "uid required" }, 400);
  if (body.uid === locals.user!.uid) return json({ error: "You can't disable your own account." }, 400);

  const disabled = !!body.disabled;
  const res = await env.DB
    .prepare("UPDATE users SET disabled_at = ? WHERE uid = ? AND deleted_at IS NULL")
    .bind(disabled ? new Date().toISOString() : null, body.uid)
    .run();
  if (!res.meta.changes) return json({ error: "User not found" }, 404);

  await auditAdmin(env.DB, locals.user!.uid, disabled ? "user.disable" : "user.enable", "user", body.uid, null);
  return json({ ok: true, disabled });
}
