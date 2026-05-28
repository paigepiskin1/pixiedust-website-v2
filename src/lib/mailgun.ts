// Mailgun email + outbound log. Every send records a row in `email_log` so
// admins can see what went out and whether it succeeded. Uses the Mailgun
// HTTP API (Basic auth: "api:<sending-key>") — no SDK, works on Workers.
import type { D1Database } from "@cloudflare/workers-types";
import { getSetting } from "./app-settings";
import { DEFAULT_WELCOME_SUBJECT, DEFAULT_WELCOME_HTML, renderWelcomeEmail } from "./welcome-email-default";
import type { DbUser } from "./users";

export interface MailgunEnv {
  MAILGUN_API_KEY: string;
  MAILGUN_DOMAIN: string;
  MAILGUN_FROM: string;
  MAILGUN_FEEDBACK_TO?: string;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  /** Logical name for the log (welcome | feedback | …). */
  template?: string;
  from?: string;
  replyTo?: string;
  userUid?: string | null;
  meta?: unknown;
}

export interface SendEmailResult {
  ok: boolean;
  id?: number; // email_log row id
  providerId?: string;
  error?: string;
}

const API_BASE = "https://api.mailgun.net/v3";

/** Send an email via Mailgun and record the attempt + outcome in email_log. */
export async function sendEmail(env: MailgunEnv, db: D1Database, input: SendEmailInput): Promise<SendEmailResult> {
  const from = input.from || env.MAILGUN_FROM;
  // 1. Log the attempt up front (status=queued) so nothing is ever silent.
  const ins = await db
    .prepare(
      "INSERT INTO email_log (to_email, from_email, subject, template, status, user_uid, meta_json) " +
        "VALUES (?, ?, ?, ?, 'queued', ?, ?)"
    )
    .bind(input.to, from, input.subject, input.template ?? null, input.userUid ?? null, input.meta ? JSON.stringify(input.meta) : null)
    .run();
  const id = Number(ins.meta?.last_row_id) || undefined;

  const fail = async (error: string): Promise<SendEmailResult> => {
    await db.prepare("UPDATE email_log SET status='error', error=?, updated_at=datetime('now') WHERE id=?").bind(error.slice(0, 500), id).run();
    return { ok: false, id, error };
  };

  if (!env.MAILGUN_API_KEY || !env.MAILGUN_DOMAIN) {
    return fail("Mailgun not configured (missing API key or domain).");
  }

  // 2. Send.
  try {
    const form = new URLSearchParams();
    form.set("from", from);
    form.set("to", input.to);
    form.set("subject", input.subject);
    if (input.text) form.set("text", input.text);
    if (input.html) form.set("html", input.html);
    if (input.replyTo) form.set("h:Reply-To", input.replyTo);

    const res = await fetch(`${API_BASE}/${env.MAILGUN_DOMAIN}/messages`, {
      method: "POST",
      headers: {
        Authorization: "Basic " + btoa(`api:${env.MAILGUN_API_KEY}`),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, any>;
    if (!res.ok) return fail(data.message || `Mailgun error (${res.status})`);

    const providerId = String(data.id || "").replace(/^<|>$/g, "");
    await db.prepare("UPDATE email_log SET status='sent', provider_id=?, updated_at=datetime('now') WHERE id=?").bind(providerId || null, id).run();
    return { ok: true, id, providerId };
  } catch (err) {
    return fail(String((err as Error).message || err));
  }
}

export interface EmailLogRow {
  id: number;
  to_email: string;
  from_email: string | null;
  subject: string | null;
  template: string | null;
  status: string;
  provider_id: string | null;
  error: string | null;
  user_uid: string | null;
  created_at: string;
}

export async function listEmailLog(db: D1Database, limit = 100): Promise<EmailLogRow[]> {
  const { results } = await db
    .prepare("SELECT id, to_email, from_email, subject, template, status, provider_id, error, user_uid, created_at FROM email_log ORDER BY id DESC LIMIT ?")
    .bind(Math.max(1, Math.floor(limit)))
    .all<EmailLogRow>();
  return results || [];
}

export interface EmailLogStats {
  total: number;
  sent: number;
  error: number;
  queued: number;
}

export async function emailLogStats(db: D1Database): Promise<EmailLogStats> {
  const row = await db
    .prepare(
      "SELECT COUNT(*) AS total, " +
        "SUM(CASE WHEN status='sent' THEN 1 ELSE 0 END) AS sent, " +
        "SUM(CASE WHEN status='error' THEN 1 ELSE 0 END) AS error, " +
        "SUM(CASE WHEN status='queued' THEN 1 ELSE 0 END) AS queued FROM email_log"
    )
    .first<{ total: number; sent: number; error: number; queued: number }>();
  return {
    total: row?.total ?? 0,
    sent: row?.sent ?? 0,
    error: row?.error ?? 0,
    queued: row?.queued ?? 0,
  };
}

/**
 * Send a welcome email to a newly-registered user, then mark welcome_sent_at
 * on the users row so we never double-send. No-ops if already sent or no email.
 */
export async function sendWelcomeEmail(
  env: MailgunEnv,
  db: D1Database,
  user: DbUser
): Promise<void> {
  if (!user.email || user.welcome_sent_at) return;

  // Load subject + HTML from admin-editable settings; fall back to defaults.
  const [subjectSetting, htmlSetting] = await Promise.all([
    getSetting(db, "welcome_email_subject"),
    getSetting(db, "welcome_email_html"),
  ]);
  const subject = subjectSetting || DEFAULT_WELCOME_SUBJECT;
  const rawHtml = (!htmlSetting || htmlSetting === "<!-- DEFAULT -->") ? DEFAULT_WELCOME_HTML : htmlSetting;
  const html = renderWelcomeEmail(rawHtml, {
    name: user.name,
    email: user.email,
    credits: user.balance,
  });

  // Mark sent first to prevent duplicate sends on retried requests.
  await db
    .prepare("UPDATE users SET welcome_sent_at = datetime('now') WHERE uid = ?")
    .bind(user.uid)
    .run();

  // Fire and forget — don't block the sign-in response on email delivery.
  sendEmail(env, db, {
    to: user.email,
    subject,
    html,
    template: "welcome",
    userUid: user.uid,
  }).catch((err) => console.error("[welcome-email] send error:", err));
}
