/**
 * Pushes the current DEFAULT_WELCOME_HTML (with Bunny CDN logo) to the remote
 * D1 app_settings table so the live welcome email uses the branded template.
 * Run: node scripts/update-welcome-email-db.mjs
 */
import fs from "fs";

// Secrets come from env only (loaded from .dev.vars). Run via:
//   node scripts/dev.mjs node scripts/update-welcome-email-db.mjs
const DB_ID   = process.env.CF_D1_DATABASE_ID || "105e2276-0d51-430a-8c6f-b4f7ee699aaf";
const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID || "15149dc8d99998b6c96a67c2cf52ad7c";
const TOKEN   = process.env.CLOUDFLARE_API_TOKEN;
if (!TOKEN) {
  console.error("Missing CLOUDFLARE_API_TOKEN in env.\nRun via: node scripts/dev.mjs node scripts/update-welcome-email-db.mjs");
  process.exit(1);
}

// Extract DEFAULT_WELCOME_HTML from the TS source
const src = fs.readFileSync("src/lib/welcome-email-default.ts", "utf8");
const htmlMatch = src.match(/export const DEFAULT_WELCOME_HTML = `([\s\S]*?)`;/);
const subjMatch = src.match(/export const DEFAULT_WELCOME_SUBJECT = "(.+?)";/);
if (!htmlMatch) throw new Error("Could not extract DEFAULT_WELCOME_HTML from TS source");
if (!subjMatch) throw new Error("Could not extract DEFAULT_WELCOME_SUBJECT from TS source");

const html    = htmlMatch[1];
const subject = subjMatch[1];

console.log(`Subject: ${subject}`);
console.log(`HTML:    ${html.length} chars | has logo: ${html.includes("logo-white-880.png")}`);

async function d1(sql) {
  const r = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/d1/database/${DB_ID}/query`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ sql }),
    }
  );
  const d = await r.json();
  if (!d.success) throw new Error(`D1 error: ${JSON.stringify(d.errors)}`);
  return d.result?.[0]?.results ?? [];
}

// Escape for SQL string literal
const escSql = (s) => s.replace(/'/g, "''");

await d1(`
  INSERT INTO app_settings (key, value, updated_at)
  VALUES ('welcome_email_subject', '${escSql(subject)}', datetime('now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
`);
console.log("✓ welcome_email_subject updated");

await d1(`
  INSERT INTO app_settings (key, value, updated_at)
  VALUES ('welcome_email_html', '${escSql(html)}', datetime('now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
`);
console.log("✓ welcome_email_html updated");
console.log("\nDone — remote DB now has the branded welcome email with logo.");
