export const prerender = false;
import type { APIContext } from "astro";
import { adminActor, auditAdmin } from "../../../../lib/admin";
import { deleteFirebaseUser } from "../../../../lib/firebase-admin";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

/** Permanently delete a user from BOTH Firebase Auth and our D1 database.
 * - D1: hard-delete the user row + all of their related rows.
 * - KV: write a tombstone so the uid can never re-create a session (defence in
 *   depth — they're blocked even if the Firebase delete was skipped).
 * - Firebase: hard-delete the auth account (requires FIREBASE_SERVICE_ACCOUNT).
 */
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
  const userId = row.id;

  // 1. Block re-creation immediately (session.ts checks this tombstone).
  await env.SESSIONS.put(`deleted_uid:${uid}`, "1").catch(() => {});

  // 2. Hard-delete D1: child rows first, then the user.
  const stmts = [
    env.DB.prepare("DELETE FROM generations WHERE user_id = ?").bind(userId),
    env.DB.prepare("DELETE FROM credit_ledger WHERE user_id = ?").bind(userId),
    env.DB.prepare("DELETE FROM subscriptions WHERE user_id = ?").bind(userId),
    env.DB.prepare("DELETE FROM login_events WHERE user_id = ?").bind(userId),
    env.DB.prepare("DELETE FROM referrals WHERE inviter_uid = ? OR invitee_uid = ?").bind(uid, uid),
    env.DB.prepare("DELETE FROM email_log WHERE user_uid = ?").bind(uid),
    env.DB.prepare("DELETE FROM users WHERE id = ?").bind(userId),
  ];
  try {
    await env.DB.batch(stmts);
  } catch (err) {
    return json({ error: "Database delete failed", detail: String((err as Error)?.message || err) }, 500);
  }

  // 3. Hard-delete from Firebase Auth (best-effort; needs service account).
  const fb = await deleteFirebaseUser(env, uid);

  await auditAdmin(env.DB, actor, "user.delete", "user", uid, { firebase: fb });

  return json({ ok: true, db: true, firebase: fb });
}
