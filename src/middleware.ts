import type { MiddlewareHandler } from "astro";
import { readSession, SESSION_COOKIE } from "./lib/session";
import { getUserByUid, toPublicUser } from "./lib/users";
import {
  buildSyncnodeWebhookUrl,
  reconcileUserGenerations,
  syncnodeWebhookKey,
} from "./lib/generations";

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

  // While signed-in users browse, opportunistically finalize any of their open
  // SyncNode jobs (covers the case where they left a studio tab mid-run).
  try {
    const user = context.locals.user;
    const env = context.locals.runtime?.env;
    const accept = context.request.headers.get("accept") || "";
    const isHtmlNav = context.request.method === "GET" && accept.includes("text/html");
    if (user && env?.DB && env?.SYNCNODE_API_KEY && isHtmlNav && !context.url.pathname.startsWith("/api/")) {
      const ctx = (context.locals.runtime as { ctx?: { waitUntil?: (p: Promise<unknown>) => void } }).ctx;
      const work = (async () => {
        const dbUser = await getUserByUid(env.DB, user.uid);
        if (!dbUser) return;
        const minute = Math.floor(Date.now() / 60000);
        const rlKey = `gen_reconcile_mw:${dbUser.id}:${minute}`;
        if (env.SESSIONS && (await env.SESSIONS.get(rlKey))) return;
        if (env.SESSIONS) await env.SESSIONS.put(rlKey, "1", { expirationTtl: 70 });
        const key = await syncnodeWebhookKey(env.SYNCNODE_API_KEY);
        const webhookUrl = buildSyncnodeWebhookUrl(context.url.origin, key);
        await reconcileUserGenerations(env, dbUser.id, { webhookUrl, limit: 6 });
      })().catch(() => {});
      if (ctx?.waitUntil) ctx.waitUntil(work);
    }
  } catch {
    // never block navigation on reconcile
  }

  const response = await next();
  // Staging hosts (sys.*, *.pages.dev, localhost) must never be indexed — only
  // the production apex. Canonical tags already point to the apex; this header
  // is the reliable belt (survives Cloudflare's managed robots.txt).
  const host = context.url.hostname;
  if (host !== "pixiedustapp.com" && host !== "www.pixiedustapp.com") {
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
