export const prerender = false;
import type { APIContext } from "astro";
import { adminActor, auditAdmin } from "../../../../lib/admin";
import { deleteAccount } from "../../../../lib/account-delete";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

/** Permanently delete a user from both Firebase Auth and our D1 database.
 *  The deletion itself is lib/account-delete.ts; this adds the admin rules. */
export async function POST({ request, locals }: APIContext) {
  const env = locals.runtime.env;
  const actor = adminActor(request, locals, env.ADMIN_API_TOKEN);
  if (!actor) return json({ error: "Forbidden" }, 403);

  let body: { uid?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "Invalid body" }, 400);
  }
  const uid = body.uid;
  if (!uid) return json({ error: "uid required" }, 400);
  if (locals.user && uid === locals.user.uid) return json({ error: "You can't delete your own account." }, 400);

  const row = await env.DB.prepare("SELECT id, is_admin FROM users WHERE uid = ?").bind(uid).first<{ id: number; is_admin: number }>();
  if (!row) return json({ error: "User not found" }, 404);
  if (row.is_admin) return json({ error: "Revoke this user's admin role before deleting." }, 400);
  // Tombstone, D1 rows and the Firebase auth record: shared with in-app
  // self-deletion (lib/account-delete.ts).
  const result = await deleteAccount(env as any, uid);
  if (!result.ok) return json({ error: result.error }, result.status);
  const fb = result.firebase;

  await auditAdmin(env.DB, actor, "user.delete", "user", uid, { firebase: fb });

  return json({ ok: true, db: true, firebase: fb });
}
