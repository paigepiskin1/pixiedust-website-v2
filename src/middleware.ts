import type { MiddlewareHandler } from "astro";
import { readSession, SESSION_COOKIE } from "./lib/session";
import { getUserByUid, toPublicUser } from "./lib/users";

// Migration flag, cached ~30s per isolate so old-domain requests don't read D1
// every time (and new-domain traffic never checks it at all). Activate with the
// MIGRATE_PIXYDUST env var OR: app_settings key `migrate_pixydust` = "1".
let _mig = { on: false, at: 0 };
async function migrateOn(env: any): Promise<boolean> {
  if (env?.MIGRATE_PIXYDUST === "1") return true;
  const now = Date.now();
  if (now - _mig.at < 30000) return _mig.on;
  let on = _mig.on;
  try {
    const row = await env?.DB?.prepare("SELECT value FROM app_settings WHERE key='migrate_pixydust'").first();
    on = row?.value === "1";
  } catch { /* keep last known on transient error */ }
  _mig = { on, at: now };
  return on;
}

// Populates locals.user from the session cookie for SSR routes. Static
// (prerendered) routes run this at build time only and hydrate auth client-side.
export const onRequest: MiddlewareHandler = async (context, next) => {
  // ── Domain migration → pixydust.com ──────────────────────────────────────
  // Permanently forward the old domain (and the www of both) to the new apex,
  // preserving path + query, so e.g. pixiedustapp.com/login → pixydust.com/login.
  // web.pixiedustapp.com and auth.pixiedustapp.com are different hosts that never
  // hit this worker, so they are untouched.
  //
  // GATED (see migrateOn) so this is a no-op until the flag is flipped —
  // otherwise we'd 301 the whole live site to a dead domain. Only old-domain
  // hosts consult the flag; reversible instantly with no code deploy.
  {
    const u = new URL(context.request.url);
    const h = u.hostname;
    if (h === "pixiedustapp.com" || h === "www.pixiedustapp.com" || h === "www.pixydust.com") {
      if (await migrateOn(context.locals.runtime?.env)) {
        return Response.redirect(`https://pixydust.com${u.pathname}${u.search}`, 301);
      }
    }
  }

  // Same-origin Firebase auth: proxy the reserved /__/* paths (auth handler,
  // iframe, init.json) to the project's Firebase Hosting so OAuth redirects
  // complete on OUR origin. Mobile browsers partition third-party storage,
  // which silently breaks redirect sign-in when authDomain is a different
  // origin — serving the handler same-origin is Firebase's documented fix.
  // Returned directly (no next()) so the security headers below (notably
  // X-Frame-Options: DENY, which would kill the auth iframe) don't apply.
  {
    const u = new URL(context.request.url);
    if (u.pathname.startsWith("/__/")) {
      const upstream = "https://pixie-dust-apps.firebaseapp.com" + u.pathname + u.search;
      return fetch(new Request(upstream, context.request));
    }
  }

  context.locals.user = null;
  try {
    const env = context.locals.runtime?.env;
    if (env?.SESSIONS && env?.DB) {
      const sid = context.cookies.get(SESSION_COOKIE)?.value;
      const uid = await readSession(env.SESSIONS, sid);
      if (uid) {
        const u = await getUserByUid(env.DB, uid);
        // Disabled accounts are treated as logged-out everywhere (abuse control).
        if (u && !u.disabled_at) context.locals.user = toPublicUser(u);
      }
    }
  } catch {
    // never block a request on auth resolution
  }
  const response = await next();
  // Staging hosts (sys.*, *.pages.dev, localhost) must never be indexed — only
  // the production apex. Canonical tags already point to the apex; this header
  // is the reliable belt (survives Cloudflare's managed robots.txt).
  const host = context.url.hostname;
  if (host !== "pixydust.com") {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  return response;
};
