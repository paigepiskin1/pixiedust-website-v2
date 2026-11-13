export const prerender = false;
import type { APIContext } from "astro";
import { bearerClaims, bearerJwt } from "../../../../lib/bearer";
import { toPublicUser, getUserByUid } from "../../../../lib/users";
import { getUserPlan } from "../../../../lib/limits";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}

/**
 * The signed-in app user: profile, credit balance and plan.
 *
 *   GET /api/app/v1/me
 *   Authorization: Bearer <Firebase ID token>
 *
 * 401 invalid_token: refresh the Firebase ID token. 404 not_registered: call
 * POST /api/app/v1/session first. 403 account_disabled.
 */
export async function GET({ request, locals }: APIContext) {
  const env = locals.runtime.env;
  if (!bearerJwt(request)) return json({ error: "Send the Firebase ID token as Authorization: Bearer <token>.", code: "missing_token" }, 401);
  const claims = await bearerClaims(request);
  if (!claims) return json({ error: "Invalid or expired token.", code: "invalid_token" }, 401);
  if (await env.SESSIONS.get(`deleted_uid:${claims.uid}`)) return json({ error: "This account has been deleted.", code: "account_deleted" }, 403);
  const user = await getUserByUid(env.DB, claims.uid);
  if (!user) return json({ error: "No PixyDust account yet. Call POST /api/app/v1/session first.", code: "not_registered" }, 404);
  if (user.disabled_at) return json({ error: "This account has been disabled.", code: "account_disabled" }, 403);
  const plan = await getUserPlan(env.DB, user.id);
  return json({ user: toPublicUser(user), plan });
}
