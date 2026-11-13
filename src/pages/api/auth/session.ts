export const prerender = false;
import type { APIContext } from "astro";
import { verifyIdToken } from "../../../lib/firebase-verify";
import { toPublicUser } from "../../../lib/users";
import { createSession, SESSION_COOKIE, SESSION_TTL_SECONDS } from "../../../lib/session";
import { completeSignIn, signInAllowed } from "../../../lib/signin";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

/** Website sign-in: exchange a Firebase ID token for a session cookie. The
 *  checks and bookkeeping live in lib/signin.ts, shared with the iPhone app. */
export async function POST({ request, locals, cookies, url }: APIContext) {
  // Rate-limit sign-in attempts before doing any token verification
  const env = locals.runtime.env;
  if (!(await signInAllowed(env.SESSIONS, request))) {
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

    // First-touch acquisition attribution (captured client-side into pd_attr)
    // and an invite code (pd_ref). Both are read once and cleared.
    let attribution: Record<string, string> | null = null;
    const attrRaw = cookies.get("pd_attr")?.value;
    if (attrRaw) {
      try {
        try {
          attribution = JSON.parse(attrRaw);
        } catch {
          attribution = JSON.parse(decodeURIComponent(attrRaw));
        }
      } catch {
        attribution = null; // attribution is best-effort, never blocks sign-in
      }
    }
    const referralCode = cookies.get("pd_ref")?.value || null;

    const ctx = (locals.runtime as any).ctx;
    const result = await completeSignIn(env as any, request, claims, {
      client: "web",
      attribution,
      referralCode,
      waitUntil: ctx?.waitUntil ? (p) => ctx.waitUntil(p) : undefined,
    });
    if (!result.ok) return json(result.body, result.status);

    if (result.isNew) {
      if (attrRaw) cookies.delete("pd_attr", { path: "/" });
      if (referralCode) cookies.delete("pd_ref", { path: "/" });
    }

    const sid = await createSession(env.SESSIONS, claims.uid);
    cookies.set(SESSION_COOKIE, sid, {
      httpOnly: true,
      secure: url.protocol === "https:",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_TTL_SECONDS,
    });
    return json({ user: toPublicUser(result.user) });
  } catch (err) {
    console.error("[session] auth error:", err);
    return json({ error: "Authentication failed" }, 401);
  }
}
