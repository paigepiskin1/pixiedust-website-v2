export const prerender = false;
import type { APIContext } from "astro";
import { bearerClaims, bearerJwt } from "../../../../lib/bearer";
import { getUserByUid } from "../../../../lib/users";
import { deleteAccount } from "../../../../lib/account-delete";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}

/** How recently the user must have signed in to delete their account. A
 *  stolen or long-lived token alone can't delete anyone. */
const RECENT_SIGN_IN_SECONDS = 5 * 60;

/**
 * Delete the signed-in user's account (App Store guideline 5.1.1(v)).
 *
 *   DELETE /api/app/v1/account
 *   Authorization: Bearer <Firebase ID token from a sign-in in the last 5 minutes>
 *
 * Permanent: the account, credits and generations are removed, the Firebase
 * login is deleted, and the uid can never sign in again.
 */
export async function DELETE({ request, locals }: APIContext) {
  const env = locals.runtime.env;
  if (!bearerJwt(request)) return json({ error: "Send the Firebase ID token as Authorization: Bearer <token>.", code: "missing_token" }, 401);
  const claims = await bearerClaims(request);
  if (!claims) return json({ error: "Invalid or expired token.", code: "invalid_token" }, 401);

  const now = Math.floor(Date.now() / 1000);
  if (!claims.authTime || now - claims.authTime > RECENT_SIGN_IN_SECONDS) {
    return json({ error: "For your security, sign in again, then delete your account.", code: "reauth_required" }, 401);
  }

  const user = await getUserByUid(env.DB, claims.uid);
  if (!user) return json({ error: "No PixyDust account to delete.", code: "not_registered" }, 404);
  if (user.is_admin) return json({ error: "Admin accounts can't be deleted from the app.", code: "admin_account" }, 403);

  // A paid web subscription keeps billing through Stripe until it is
  // cancelled, so it has to be cancelled first rather than orphaned.
  const sub = await env.DB
    .prepare("SELECT status FROM subscriptions WHERE user_id = ? AND status IN ('active', 'trialing', 'past_due')")
    .bind(user.id)
    .first<{ status: string }>();
  if (sub) {
    return json({ error: "Cancel your PixyDust subscription at pixydust.com/credits first, then delete your account.", code: "active_subscription" }, 409);
  }

  const result = await deleteAccount(env as any, claims.uid);
  if (!result.ok) return json({ error: result.error, code: result.code ?? "server_error" }, result.status);
  return json({ ok: true, deleted: true });
}
