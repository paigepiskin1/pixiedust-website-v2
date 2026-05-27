// One-time user migration: pulls accounts WITH a credit balance from the legacy
// RDS MySQL and emits idempotent upsert SQL for D1, keyed by Firebase uid (so
// identity carries over — returning users sign in and find their balance).
//
// Creds come from env (never hardcode here). Run:
//   DBHOST=... DBUSER=... DBPASS=... DBNAME=... npx tsx scripts/migrate-users.ts
// Then apply:  npx wrangler d1 execute pixiedust --local --file=seed/migrate-users.sql
//        (prod) npx wrangler d1 execute pixiedust --remote --file=seed/migrate-users.sql
import mysql from "mysql2/promise";
import { writeFileSync, mkdirSync } from "node:fs";

const env = process.env;
const sq = (v: unknown) => (v == null || v === "" ? "NULL" : `'${String(v).replace(/'/g, "''")}'`);
const intOr0 = (v: unknown) => String(Math.trunc(Number(v) || 0));
const dt = (v: unknown) => {
  if (!v) return "datetime('now')";
  const d = v instanceof Date ? v : new Date(String(v));
  if (isNaN(d.getTime())) return "datetime('now')";
  return `'${d.toISOString().replace("T", " ").slice(0, 19)}'`;
};

interface OldUser {
  uid: string; email: string | null; name: string | null; username: string | null;
  balance: number; is_admin: number; is_adult: number; profile_picture: string | null;
  email_verified_at: unknown; created_at: unknown; last_login: unknown;
}

const conn = await mysql.createConnection({
  host: env.DBHOST, user: env.DBUSER, password: env.DBPASS, database: env.DBNAME, connectTimeout: 15000,
});
const [rows] = await conn.query(
  `SELECT uid, email, name, username, balance, is_admin, is_adult, profile_picture,
          email_verified_at, created_at, last_login
   FROM users
   WHERE balance > 0 AND deleted_at IS NULL AND uid IS NOT NULL AND uid <> ''
   ORDER BY balance DESC`
);
await conn.end();

const users = rows as unknown as OldUser[];

// Dedupe usernames within the set to avoid UNIQUE collisions.
const seen = new Set<string>();
const values = users.map((u) => {
  let username = u.username && u.username.trim() ? u.username.trim() : null;
  if (username) {
    const key = username.toLowerCase();
    if (seen.has(key)) username = null;
    else seen.add(key);
  }
  return `(${sq(u.uid)}, ${sq(u.email)}, ${sq(u.name)}, ${sq(username)}, ${sq(u.profile_picture)}, ${intOr0(u.balance)}, ${u.is_admin ? 1 : 0}, ${u.is_adult ? 1 : 0}, ${u.email_verified_at ? 1 : 0}, ${dt(u.created_at)}, ${dt(u.last_login)})`;
});

const sql = `-- Migrated ${users.length} users (balance > 0) from legacy DB. Idempotent by uid.
-- Generated ${new Date().toISOString()}. Contains PII — gitignored.
INSERT INTO users (uid, email, name, username, avatar_url, balance, is_admin, is_adult, email_verified, created_at, last_login)
VALUES
${values.join(",\n")}
ON CONFLICT(uid) DO UPDATE SET
  email = excluded.email,
  name = COALESCE(excluded.name, users.name),
  username = COALESCE(excluded.username, users.username),
  avatar_url = COALESCE(excluded.avatar_url, users.avatar_url),
  balance = excluded.balance,
  is_admin = excluded.is_admin,
  is_adult = excluded.is_adult,
  email_verified = excluded.email_verified;
`;

mkdirSync("seed", { recursive: true });
writeFileSync("seed/migrate-users.sql", sql);
console.log(`Wrote seed/migrate-users.sql — ${users.length} users with balance > 0.`);
console.log("Top balances:", users.slice(0, 5).map((u) => `${u.email}:${u.balance}`).join("  "));
