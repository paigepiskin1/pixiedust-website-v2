// What happens when someone signs in, whichever client they use: the website
// (cookie session, /api/auth/session) or the PixyDust iPhone app (Bearer
// Firebase ID token, /api/app/v1/session). One implementation, so the checks
// (deleted and disabled accounts, email verification, rate limit) can't drift
// apart between the two.
import type { D1Database, KVNamespace } from "@cloudflare/workers-types";
import type { FirebaseClaims } from "./firebase-verify";
import { upsertUser, getUserByUid, type DbUser } from "./users";
import { sendWelcomeEmail } from "./mailgun";
import { redeemReferral } from "./referrals";

/** signup_source for accounts created in the iPhone app ("AR users"). */
export const APP_SIGNUP_SOURCE = "pixydust_ar_app";

export type Client = "web" | "ios";

export interface SignInEnv {
  DB: D1Database;
  SESSIONS: KVNamespace;
  [k: string]: unknown;
}

export interface SignInOptions {
  client: Client;
  /** First-touch attribution captured by the website (utm_*, referrer …). */
  attribution?: Record<string, string> | null;
  /** Invite code, from the website's pd_ref cookie or the app's request. */
  referralCode?: string | null;
  /** iPhone app version, e.g. "1.4.0 (212)". */
  appVersion?: string | null;
  /** Lets the welcome email finish after the response is sent. */
  waitUntil?: (p: Promise<unknown>) => void;
}

export type SignInResult =
  | { ok: true; user: DbUser; isNew: boolean }
  | { ok: false; status: number; body: Record<string, unknown> };

const clientIp = (request: Request) =>
  request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For")?.split(",")[0].trim() || null;

/** 10 sign-in attempts per minute per IP, in the SESSIONS KV. */
export async function signInAllowed(kv: KVNamespace, request: Request): Promise<boolean> {
  const minute = Math.floor(Date.now() / 60000);
  const key = `signin_rl:${clientIp(request) || "unknown"}:${minute}`;
  const current = Number(await kv.get(key)) || 0;
  if (current >= 10) return false;
  await kv.put(key, String(current + 1), { expirationTtl: 70 });
  return true;
}

/** Source label from website attribution: utm_source, else the referrer's
 *  host, else the ad network implied by a click id. */
function sourceFrom(attr: Record<string, string>): string | null {
  let source: string | null = attr.utm_source || null;
  if (!source && attr.referrer) {
    try {
      source = new URL(attr.referrer).hostname.replace(/^www\./, "");
    } catch {
      /* ignore */
    }
  }
  if (!source && attr.gclid) source = "google_ads";
  if (!source && attr.fbclid) source = "facebook";
  if (!source && attr.ttclid) source = "tiktok";
  return source;
}

/**
 * Turn verified Firebase claims into a signed-in PixyDust user: create the
 * account on first sign-in, record where it came from, log the sign-in.
 * Creating the session (cookie or not) is the caller's job.
 */
export async function completeSignIn(env: SignInEnv, request: Request, claims: FirebaseClaims, opts: SignInOptions): Promise<SignInResult> {
  // Deleted accounts can never come back, even if the Firebase auth record
  // still exists. Account deletion writes this tombstone.
  if (await env.SESSIONS.get(`deleted_uid:${claims.uid}`)) {
    return { ok: false, status: 403, body: { error: "This account has been deleted.", code: "account_deleted" } };
  }

  // New password accounts need a verified email: Firebase's own verification,
  // or ours (the branded link sets verified:<uid>). Google and Apple sign-ins
  // are already verified. Existing accounts are grandfathered.
  if (claims.signInProvider === "password" && !claims.emailVerified) {
    const existing = await getUserByUid(env.DB, claims.uid);
    if (!existing && !(await env.SESSIONS.get(`verified:${claims.uid}`))) {
      return {
        ok: false,
        status: 403,
        body: { error: "Please verify your email. We just sent you a link: click it, then sign in.", needVerify: true, code: "email_not_verified" },
      };
    }
  }

  const { user, isNew } = await upsertUser(env.DB, claims);
  if (user.disabled_at) return { ok: false, status: 403, body: { error: "This account has been disabled.", code: "account_disabled" } };

  // Sign-in history for the admin (IP, country, device, client).
  const ua = request.headers.get("User-Agent")?.slice(0, 400) || null;
  await env.DB
    .prepare("INSERT INTO login_events (user_id, uid, ip, country, user_agent, client) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(user.id, user.uid, clientIp(request), request.headers.get("CF-IPCountry") || null, ua, opts.client)
    .run()
    .catch(() => {});

  // Where the account came from. Only on creation: a web account that later
  // signs in on the app keeps its original source.
  if (isNew) {
    const attr = opts.attribution ?? null;
    const source = opts.client === "ios" ? APP_SIGNUP_SOURCE : attr ? sourceFrom(attr) : null;
    await env.DB
      .prepare("UPDATE users SET signup_platform = ?, signup_source = COALESCE(?, signup_source), signup_attribution = COALESCE(?, signup_attribution) WHERE uid = ?")
      .bind(opts.client, source, attr ? JSON.stringify(attr).slice(0, 1000) : null, user.uid)
      .run()
      .catch(() => {}); // attribution never blocks sign-in
  }

  // App use, for any account.
  if (opts.client === "ios") {
    await env.DB
      .prepare("UPDATE users SET app_first_seen_at = COALESCE(app_first_seen_at, datetime('now')), app_last_seen_at = datetime('now'), app_version = COALESCE(?, app_version) WHERE uid = ?")
      .bind(opts.appVersion?.slice(0, 40) || null, user.uid)
      .run()
      .catch(() => {});
  }

  if (isNew && opts.referralCode) await redeemReferral(env.DB, user, opts.referralCode).catch(() => 0);

  const finalUser = (await getUserByUid(env.DB, user.uid)) ?? user;

  // Welcome email once per user. Under waitUntil, or the Worker is torn down
  // when the response returns and the Mailgun request never finishes.
  const welcome = sendWelcomeEmail(env as any, env.DB, finalUser).catch(() => {});
  opts.waitUntil?.(welcome);

  return { ok: true, user: finalUser, isNew };
}
