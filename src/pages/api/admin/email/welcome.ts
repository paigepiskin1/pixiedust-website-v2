export const prerender = false;
import type { APIContext } from "astro";
import { adminActor, auditAdmin } from "../../../../lib/admin";
import { getSetting, setSetting } from "../../../../lib/app-settings";
import { DEFAULT_WELCOME_SUBJECT, DEFAULT_WELCOME_HTML, renderWelcomeEmail } from "../../../../lib/welcome-email-default";
import { sendEmail } from "../../../../lib/mailgun";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

/** GET — return current subject + html (for editor initial load) */
export async function GET({ locals }: APIContext) {
  const actor = adminActor(locals as any, locals, locals.runtime.env.ADMIN_API_TOKEN);
  if (!actor) return json({ error: "Forbidden" }, 403);

  const db = locals.runtime.env.DB;
  const [subject, html] = await Promise.all([
    getSetting(db, "welcome_email_subject"),
    getSetting(db, "welcome_email_html"),
  ]);
  return json({
    subject: subject || DEFAULT_WELCOME_SUBJECT,
    html: (!html || html === "<!-- DEFAULT -->") ? DEFAULT_WELCOME_HTML : html,
  });
}

/** POST — save subject + html, optionally send a test email */
export async function POST({ request, locals }: APIContext) {
  const env = locals.runtime.env;
  const actor = adminActor(request, locals, env.ADMIN_API_TOKEN);
  if (!actor) return json({ error: "Forbidden" }, 403);

  let body: { subject?: string; html?: string; sendTestTo?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const db = env.DB;

  // Save if provided
  if (body.subject !== undefined) await setSetting(db, "welcome_email_subject", body.subject.trim() || DEFAULT_WELCOME_SUBJECT);
  if (body.html !== undefined) await setSetting(db, "welcome_email_html", body.html || "<!-- DEFAULT -->");

  await auditAdmin(db, actor, "update_welcome_email", "app_settings", "welcome_email", {
    hasSendTest: !!body.sendTestTo,
  });

  // Optionally send a preview to an address
  if (body.sendTestTo) {
    const subject = body.subject || (await getSetting(db, "welcome_email_subject")) || DEFAULT_WELCOME_SUBJECT;
    const rawHtml = body.html || (await getSetting(db, "welcome_email_html")) || DEFAULT_WELCOME_HTML;
    const html = renderWelcomeEmail(rawHtml, { name: "Test User", email: body.sendTestTo, credits: 1000 });
    await sendEmail(
      { MAILGUN_API_KEY: env.MAILGUN_API_KEY, MAILGUN_DOMAIN: env.MAILGUN_DOMAIN, MAILGUN_FROM: env.MAILGUN_FROM },
      db,
      { to: body.sendTestTo, subject: `[TEST] ${subject}`, html, template: "welcome_test" }
    );
  }

  return json({ ok: true });
}
