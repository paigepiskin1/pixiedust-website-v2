export const prerender = false;
import type { APIContext } from "astro";
import { sendEmail } from "../../lib/mailgun";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function POST({ request, locals }: APIContext) {
  const env = locals.runtime.env;
  let body: { email?: string; message?: string; name?: string; topic?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "Invalid body" }, 400);
  }

  const email = (body.email || "").trim();
  const message = (body.message || "").trim();
  const name = (body.name || "").trim().slice(0, 120);
  const topic = (body.topic || "General").trim().slice(0, 60);

  if (!EMAIL_RE.test(email)) return json({ error: "Enter a valid email." }, 400);
  if (message.length < 5) return json({ error: "Please add a bit more detail." }, 400);
  if (message.length > 5000) return json({ error: "Message is too long." }, 400);

  const to = env.MAILGUN_FEEDBACK_TO || env.MAILGUN_FROM;
  const who = name ? `${name} <${email}>` : email;
  const result = await sendEmail(env, env.DB, {
    to,
    subject: `[Feedback · ${topic}] from ${who}`,
    text: `From: ${who}\nTopic: ${topic}\nUser: ${locals.user?.uid ?? "anonymous"}\n\n${message}`,
    template: "feedback",
    replyTo: email,
    userUid: locals.user?.uid ?? null,
    meta: { topic, name },
  });

  if (!result.ok) return json({ error: "Could not send right now. Please try again later." }, 502);
  return json({ ok: true });
}
