import type { MiddlewareHandler } from "astro";
import { readSession, SESSION_COOKIE } from "./lib/session";
import { getUserByUid, toPublicUser } from "./lib/users";

// Populates locals.user from the session cookie for SSR routes. Static
// (prerendered) routes run this at build time only and hydrate auth client-side.
export const onRequest: MiddlewareHandler = async (context, next) => {
  context.locals.user = null;
  try {
    const env = context.locals.runtime?.env;
    if (env?.SESSIONS && env?.DB) {
      const sid = context.cookies.get(SESSION_COOKIE)?.value;
      const uid = await readSession(env.SESSIONS, sid);
      if (uid) {
        const u = await getUserByUid(env.DB, uid);
        if (u) context.locals.user = toPublicUser(u);
      }
    }
  } catch {
    // never block a request on auth resolution
  }
  return next();
};
