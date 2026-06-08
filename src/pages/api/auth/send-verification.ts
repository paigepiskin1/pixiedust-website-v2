export const prerender = false;
import type { APIContext } from "astro";
import { verifyIdToken } from "../../../lib/firebase-verify";
import { sendEmail } from "../../../lib/mailgun";
import { VERIFY_EMAIL_SUBJECT, renderVerifyEmail } from "../../../lib/verify-email-default";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function token(): string {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

// Send our own branded verification email (Mailgun) for new password signups.
// OAuth providers are pre-verified, so this is a no-op for them.
export async function POST({ request, locals, url }: APIContext) {
  const env = locals.runtime.env;
  let idToken: string | undefined;
  try {
    ({ idToken } = (await request.json()) as { idToken?: string });
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }
  if (!idToken) return json({ error: "Missing idToken" }, 400);

  let claims;
  try {
    claims = await verifyIdToken(idToken);
  } catch {
    return json({ error: "Invalid token" }, 401);
  }

  try {
    // Only password accounts need our verification; OAuth + already-verified are done.
    if (claims.signInProvider !== "password" || claims.emailVerified) return json({ ok: true, skipped: true });
    if (!claims.email) return json({ error: "No email on account" }, 400);

    // Rate-limit: at most one verification email per 60s per uid (KV min TTL).
    const rlKey = `verifysend:${claims.uid}`;
    if (await env.SESSIONS.get(rlKey)) return json({ ok: true, throttled: true });
    await env.SESSIONS.put(rlKey, "1", { expirationTtl: 60 });

    // Mint a single-use token (24h) mapping to this uid/email.
    const t = token();
    await env.SESSIONS.put(`verify:${t}`, JSON.stringify({ uid: claims.uid, email: claims.email }), { expirationTtl: 86400 });

    const origin = url.origin || "https://pixiedustapp.com";
    const link = `${origin}/auth/verify?token=${t}`;

    const res = await sendEmail(env, env.DB, {
      to: claims.email,
      subject: VERIFY_EMAIL_SUBJECT,
      html: renderVerifyEmail(link, claims.email),
      template: "verify",
      userUid: claims.uid,
    });

    if (!res.ok) return json({ error: "Could not send verification email" }, 502);
    return json({ ok: true });
  } catch (err) {
    console.error("[send-verification]", err);
    return json({ error: "Could not send verification email" }, 500);
  }
}
