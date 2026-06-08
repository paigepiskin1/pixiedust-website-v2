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

    // Deleted accounts can never come back, even if the Firebase auth record
    // still exists (e.g. service-account delete was skipped). Admin delete
    // writes this tombstone.
    if (await env.SESSIONS.get(`deleted_uid:${claims.uid}`)) {
      return json({ error: "This account has been deleted." }, 403);
    }

    // Require a verified email for NEW password sign-ups. OAuth providers
    // (Google/Apple) are already verified, so they're exempt. Existing accounts
    // are grandfathered (we only block before a D1 row exists) so nobody
    // currently using the app is locked out.
    if (claims.signInProvider === "password" && !claims.emailVerified) {
      const existing = await getUserByUid(env.DB, claims.uid);
      if (!existing) {
        // New password account: require OUR email verification (a click on the
        // branded Mailgun link sets verified:<uid> in KV). Existing accounts
        // (a D1 row already exists) are grandfathered and never blocked.
        const verified = await env.SESSIONS.get(`verified:${claims.uid}`);
        if (!verified) {
          return json({ error: "Please verify your email — we just sent you a link. Click it, then sign in.", needVerify: true }, 403);
        }
      }
    }

    const { user, isNew } = await upsertUser(env.DB, claims);

    // Disabled accounts cannot sign in.
    if (user.disabled_at) return json({ error: "This account has been disabled." }, 403);

    // Record the login for the admin login-history view (IP + device).
    const ip =
      request.headers.get("CF-Connecting-IP") ||
      request.headers.get("X-Forwarded-For")?.split(",")[0].trim() ||
      null;
    const country = request.headers.get("CF-IPCountry") || null;
    const ua = request.headers.get("User-Agent")?.slice(0, 400) || null;
    await env.DB
      .prepare("INSERT INTO login_events (user_id, uid, ip, country, user_agent) VALUES (?, ?, ?, ?, ?)")
      .bind(user.id, user.uid, ip, country, ua)
      .run()
      .catch(() => {});

    // New user who arrived via an invite link → grant referral credits once.
    let finalUser = user;
    if (isNew) {
      // First-touch acquisition attribution (captured client-side into pd_attr).
      const attrRaw = cookies.get("pd_attr")?.value;
      if (attrRaw) {
        try {
          let attr: Record<string, string>;
          try { attr = JSON.parse(attrRaw); } catch { attr = JSON.parse(decodeURIComponent(attrRaw)); }
          let source: string | null = attr.utm_source || null;
          if (!source && attr.referrer) {
            try { source = new URL(attr.referrer).hostname.replace(/^www\./, ""); } catch { /* ignore */ }
          }
          if (!source && attr.gclid) source = "google_ads";
          if (!source && attr.fbclid) source = "facebook";
          if (!source && attr.ttclid) source = "tiktok";
          await env.DB
            .prepare("UPDATE users SET signup_source = ?, signup_attribution = ? WHERE uid = ?")
            .bind(source, JSON.stringify(attr).slice(0, 1000), user.uid)
            .run();
        } catch { /* attribution is best-effort, never block sign-in */ }
        cookies.delete("pd_attr", { path: "/" });
      }

      const ref = cookies.get("pd_ref")?.value;
      if (ref) {
        const granted = await redeemReferral(env.DB, user, ref).catch(() => 0);
        cookies.delete("pd_ref", { path: "/" });
        if (granted) finalUser = (await getUserByUid(env.DB, user.uid)) ?? user;
      }
    }

    // Fire welcome email once per user (non-blocking — doesn't delay sign-in).
    // MUST run under waitUntil: otherwise the Worker is torn down when this
    // response returns and the Mailgun fetch never completes (welcome emails
    // were getting stuck at status='queued' and never delivered).
    const ctx = (locals.runtime as any).ctx;
    const welcomeP = sendWelcomeEmail(env, env.DB, finalUser).catch(() => {});
    if (ctx?.waitUntil) ctx.waitUntil(welcomeP);
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
