// Permanently delete an account: an admin removing a user, or a user deleting
// their own account from the iPhone app (App Store guideline 5.1.1(v)).
//
// - KV: a tombstone first, so the uid can never sign in again, even if a later
//   step fails or the Firebase auth record survives.
// - D1: hard-delete the user row and every row tied to it.
// - Firebase: hard-delete the auth account (needs FIREBASE_SERVICE_ACCOUNT;
//   best-effort, the tombstone already blocks it).
import type { D1Database, KVNamespace } from "@cloudflare/workers-types";
import { deleteFirebaseUser } from "./firebase-admin";

export interface DeleteEnv {
  DB: D1Database;
  SESSIONS: KVNamespace;
  [k: string]: unknown;
}

export type DeleteResult =
  | { ok: true; firebase: unknown }
  | { ok: false; status: number; error: string; code?: string };

export async function deleteAccount(env: DeleteEnv, uid: string): Promise<DeleteResult> {
  const row = await env.DB.prepare("SELECT id FROM users WHERE uid = ?").bind(uid).first<{ id: number }>();
  if (!row) return { ok: false, status: 404, error: "User not found", code: "not_found" };
  const userId = row.id;

  await env.SESSIONS.put(`deleted_uid:${uid}`, "1").catch(() => {});

  try {
    await env.DB.batch([
      env.DB.prepare("DELETE FROM generations WHERE user_id = ?").bind(userId),
      env.DB.prepare("DELETE FROM credit_ledger WHERE user_id = ?").bind(userId),
      env.DB.prepare("DELETE FROM credit_lots WHERE user_id = ?").bind(userId),
      env.DB.prepare("DELETE FROM subscriptions WHERE user_id = ?").bind(userId),
      env.DB.prepare("DELETE FROM login_events WHERE user_id = ?").bind(userId),
      env.DB.prepare("DELETE FROM referrals WHERE inviter_uid = ? OR invitee_uid = ?").bind(uid, uid),
      env.DB.prepare("DELETE FROM email_log WHERE user_uid = ?").bind(uid),
      env.DB.prepare("DELETE FROM users WHERE id = ?").bind(userId),
    ]);
  } catch (err) {
    return { ok: false, status: 500, error: `Database delete failed: ${(err as Error)?.message || err}` };
  }

  const firebase = await deleteFirebaseUser(env as any, uid);
  return { ok: true, firebase };
}
