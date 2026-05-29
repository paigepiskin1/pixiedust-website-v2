// Invite / referral logic. A user has a stable `invite_code`; they can invite
// up to MAX_INVITES people who each get REWARD credits when they join.
import type { D1Database } from "@cloudflare/workers-types";

export const MAX_INVITES = 5;
export const REWARD_CREDITS = 10;

function genCode(): string {
  // 8 url-safe lowercase hex chars — collision-checked against the unique index.
  return crypto.randomUUID().replace(/-/g, "").slice(0, 8);
}

/** Return the user's invite code, generating + persisting one on first use. */
export async function getOrCreateInviteCode(db: D1Database, uid: string): Promise<string> {
  const row = await db.prepare("SELECT invite_code FROM users WHERE uid = ?").bind(uid).first<{ invite_code: string | null }>();
  if (row?.invite_code) return row.invite_code;

  for (let i = 0; i < 6; i++) {
    const code = genCode();
    try {
      await db.prepare("UPDATE users SET invite_code = ? WHERE uid = ? AND invite_code IS NULL").bind(code, uid).run();
    } catch {
      continue; // unique collision — try another
    }
    const check = await db.prepare("SELECT invite_code FROM users WHERE uid = ?").bind(uid).first<{ invite_code: string | null }>();
    if (check?.invite_code) return check.invite_code;
  }
  throw new Error("Could not allocate invite code");
}

export interface InviteStats {
  code: string;
  used: number;
  remaining: number;
  max: number;
  reward: number;
}

export async function getInviteStats(db: D1Database, uid: string): Promise<InviteStats> {
  const code = await getOrCreateInviteCode(db, uid);
  const row = await db.prepare("SELECT COUNT(*) AS count FROM referrals WHERE inviter_uid = ?").bind(uid).first<{ count: number }>();
  const used = row?.count ?? 0;
  return { code, used, remaining: Math.max(0, MAX_INVITES - used), max: MAX_INVITES, reward: REWARD_CREDITS };
}

/**
 * Redeem an invite code for a newly-joined user. Grants REWARD_CREDITS to the
 * invitee and records the referral. No-ops (returns 0) on: missing/invalid code,
 * self-referral, already-referred invitee, or inviter at their invite cap.
 * Returns the number of credits granted.
 */
export async function redeemReferral(
  db: D1Database,
  invitee: { uid: string; email: string | null },
  code: string | undefined | null
): Promise<number> {
  if (!code) return 0;
  const inviter = await db
    .prepare("SELECT uid FROM users WHERE invite_code = ? AND deleted_at IS NULL")
    .bind(code)
    .first<{ uid: string }>();
  if (!inviter || inviter.uid === invitee.uid) return 0;

  const already = await db.prepare("SELECT 1 FROM referrals WHERE invitee_uid = ?").bind(invitee.uid).first();
  if (already) return 0;

  const cap = await db.prepare("SELECT COUNT(*) AS count FROM referrals WHERE inviter_uid = ?").bind(inviter.uid).first<{ count: number }>();
  if ((cap?.count ?? 0) >= MAX_INVITES) return 0;

  try {
    await db.batch([
      db
        .prepare("INSERT INTO referrals (inviter_uid, invitee_uid, invitee_email, reward_credits) VALUES (?, ?, ?, ?)")
        .bind(inviter.uid, invitee.uid, invitee.email ?? null, REWARD_CREDITS),
      db.prepare("UPDATE users SET balance = balance + ?, referred_by = ? WHERE uid = ?").bind(REWARD_CREDITS, inviter.uid, invitee.uid),
    ]);
  } catch {
    return 0; // UNIQUE(invitee_uid) race — already redeemed
  }
  return REWARD_CREDITS;
}
