export const prerender = false;
import type { APIContext } from "astro";
import { verifyIdToken } from "../../../lib/firebase-verify";
import { upsertUser, toPublicUser } from "../../../lib/users";
import { createSession, SESSION_COOKIE, SESSION_TTL_SECONDS } from "../../../lib/session";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

export async function POST({ request, locals, cookies, url }: APIContext) {
  let idToken: string | undefined;
  try {
    ({ idToken } = (await request.json()) as { idToken?: string });
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }
  if (!idToken) return json({ error: "Missing idToken" }, 400);

  try {
    const claims = await verifyIdToken(idToken);
    const env = locals.runtime.env;
    const user = await upsertUser(env.DB, claims);
    const sid = await createSession(env.SESSIONS, claims.uid);
    cookies.set(SESSION_COOKIE, sid, {
      httpOnly: true,
      secure: url.protocol === "https:",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_TTL_SECONDS,
    });
    return json({ user: toPublicUser(user) });
  } catch (err) {
    console.error("[session] auth error:", err);
    return json({ error: "Authentication failed" }, 401);
  }
}
