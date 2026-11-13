export const prerender = false;
import type { APIContext } from "astro";
import { verifyIdToken } from "../../../../lib/firebase-verify";
import { bearerJwt } from "../../../../lib/bearer";
import { toPublicUser } from "../../../../lib/users";
import { getUserPlan } from "../../../../lib/limits";
import { completeSignIn, signInAllowed } from "../../../../lib/signin";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}

/**
 * iPhone app sign-in and registration.
 *
 *   POST /api/app/v1/session
 *   Authorization: Bearer <Firebase ID token>
 *   { "appVersion": "1.0.0 (12)", "referralCode": "optional" }
 *
 * Call after every Firebase sign-in. The first call creates the PixyDust
 * account and marks it as an app signup (signup_source "pixydust_ar_app",
 * signup_platform "ios"); later calls record app use. No cookie is set: the
 * app sends the Firebase ID token as a Bearer token on every API call.
 */
export async function POST({ request, locals }: APIContext) {
  const env = locals.runtime.env;
  if (!(await signInAllowed(env.SESSIONS, request))) {
    return json({ error: "Too many sign-in attempts. Try again in a minute.", code: "rate_limited" }, 429);
  }

  const token = bearerJwt(request);
  if (!token) return json({ error: "Send the Firebase ID token as Authorization: Bearer <token>.", code: "missing_token" }, 401);

  let body: { appVersion?: unknown; referralCode?: unknown } = {};
  try {
    const text = await request.text();
    body = text.trim() ? JSON.parse(text) : {};
  } catch {
    return json({ error: "Invalid JSON body", code: "bad_request" }, 400);
  }

  let claims;
  try {
    claims = await verifyIdToken(token);
  } catch {
    return json({ error: "Invalid or expired token. Refresh the Firebase ID token and try again.", code: "invalid_token" }, 401);
  }

  try {
    const ctx = (locals.runtime as any).ctx;
    const result = await completeSignIn(env as any, request, claims, {
      client: "ios",
      appVersion: typeof body.appVersion === "string" ? body.appVersion : null,
      referralCode: typeof body.referralCode === "string" && /^[A-Za-z0-9_-]{3,64}$/.test(body.referralCode) ? body.referralCode : null,
      waitUntil: ctx?.waitUntil ? (p) => ctx.waitUntil(p) : undefined,
    });
    if (!result.ok) return json(result.body, result.status);
    const plan = await getUserPlan(env.DB, result.user.id);
    return json({ user: toPublicUser(result.user), plan, isNew: result.isNew });
  } catch (err) {
    console.error("[app session] error:", err);
    return json({ error: "Sign-in failed", code: "server_error" }, 500);
  }
}
