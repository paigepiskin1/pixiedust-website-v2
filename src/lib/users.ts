// Server-side user persistence (D1). Used by the auth endpoints + middleware.
import type { D1Database } from "@cloudflare/workers-types";
import type { FirebaseClaims } from "./firebase-verify";

export interface DbUser {
  id: number;
  uid: string;
  email: string | null;
  name: string | null;
  username: string | null;
  avatar_url: string | null;
  balance: number;
  is_admin: number;
  is_adult: number;
  email_verified: number;
  created_at: string;
  last_login: string | null;
  deleted_at: string | null;
}

/** Shape exposed to the client (no internal-only fields leak meaningfully). */
export interface PublicUser {
  uid: string;
  email: string | null;
  name: string | null;
  username: string | null;
  avatarUrl: string | null;
  credits: number;
  isAdmin: boolean;
  isAdult: boolean;
}

export function toPublicUser(u: DbUser): PublicUser {
  return {
    uid: u.uid,
    email: u.email,
    name: u.name,
    username: u.username,
    avatarUrl: u.avatar_url,
    credits: u.balance,
    isAdmin: u.is_admin === 1,
    isAdult: u.is_adult === 1,
  };
}

export async function getUserByUid(db: D1Database, uid: string): Promise<DbUser | null> {
  return await db
    .prepare("SELECT * FROM users WHERE uid = ? AND deleted_at IS NULL")
    .bind(uid)
    .first<DbUser>();
}

/** Create the user on first sign-in, or refresh profile fields on return. */
export async function upsertUser(db: D1Database, claims: FirebaseClaims): Promise<DbUser> {
  await db
    .prepare(
      `INSERT INTO users (uid, email, name, avatar_url, email_verified, last_login)
       VALUES (?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(uid) DO UPDATE SET
         email = excluded.email,
         name = COALESCE(excluded.name, users.name),
         avatar_url = COALESCE(excluded.avatar_url, users.avatar_url),
         email_verified = excluded.email_verified,
         last_login = datetime('now')`
    )
    .bind(claims.uid, claims.email ?? null, claims.name ?? null, claims.picture ?? null, claims.emailVerified ? 1 : 0)
    .run();

  const user = await getUserByUid(db, claims.uid);
  if (!user) throw new Error("User upsert failed");
  return user;
}
