import type { MiddlewareHandler } from "astro";
import { readSession, SESSION_COOKIE } from "./lib/session";
import { getUserByUid, toPublicUser } from "./lib/users";

// Populates locals.user from the session cookie for SSR routes. Static
// (prerendered) routes run this at build time only and hydrate auth client-side.
export const onRequest: MiddlewareHandler = async (context, next) => {
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
  // Production apexes are indexable; everything else (staging, previews, local)
  // is noindexed. pixydust.com is the new primary; the old pixiedustapp.com hosts
  // stay indexable during the transition.
  const host = context.url.hostname;
  const PROD_APEX = new Set(["pixydust.com", "www.pixydust.com", "pixiedustapp.com", "www.pixiedustapp.com"]);
  if (!PROD_APEX.has(host)) {
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
