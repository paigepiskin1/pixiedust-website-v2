export const prerender = false;
import type { APIContext } from "astro";
import { verifyIdToken } from "../../../lib/firebase-verify";
import { upsertUser, toPublicUser, getUserByUid } from "../../../lib/users";
import { createSession, SESSION_COOKIE, SESSION_TTL_SECONDS } from "../../../lib/session";
import { sendWelcomeEmail } from "../../../lib/mailgun";
import { redeemReferral } from "../../../lib/referrals";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

/** 10 sign-in attempts per minute per IP. Uses the same SESSIONS KV as the session store. */
async function checkSignInRateLimit(kv: import("@cloudflare/workers-types").KVNamespace, request: Request): Promise<boolean> {
  const ip =
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For")?.split(",")[0].trim() ||
    "unknown";
  const minute = Math.floor(Date.now() / 60000);
  const key = `signin_rl:${ip}:${minute}`;
  const current = Number(await kv.get(key)) || 0;
  if (current >= 10) return false;
  await kv.put(key, String(current + 1), { expirationTtl: 70 });
  return true;
}

export async function POST({ request, locals, cookies, url }: APIContext) {
  // Rate-limit sign-in attempts before doing any token verification
  const env = locals.runtime.env;
  if (!(await checkSignInRateLimit(env.SESSIONS, request))) {
    return json({ error: "Too many sign-in attempts. Try again in a minute." }, 429);
  }

  let idToken: string | undefined;
  try {
    ({ idToken } = (await request.json()) as { idToken?: string });
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }
  if (!idToken) return json({ error: "Missing idToken" }, 400);

  try {
    const claims = await verifyIdToken(idToken);
    const { user, isNew } = await upsertUser(env.DB, claims);

    // New user who arrived via an invite link → grant referral credits once.
    let finalUser = user;
    if (isNew) {
      const ref = cookies.get("pd_ref")?.value;
      if (ref) {
        const granted = await redeemReferral(env.DB, user, ref).catch(() => 0);
        cookies.delete("pd_ref", { path: "/" });
        if (granted) finalUser = (await getUserByUid(env.DB, user.uid)) ?? user;
      }
    }

    // Fire welcome email once per user (non-blocking — doesn't delay sign-in)
    sendWelcomeEmail(env, env.DB, finalUser).catch(() => {});
    const sid = await createSession(env.SESSIONS, claims.uid);
    cookies.set(SESSION_COOKIE, sid, {
      httpOnly: true,
      secure: url.protocol === "https:",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_TTL_SECONDS,
    });
    return json({ user: toPublicUser(finalUser) });
  } catch (err) {
    console.error("[session] auth error:", err);
    return json({ error: "Authentication failed" }, 401);
  }
}
