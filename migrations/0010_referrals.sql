-- Migration 0010: invite / referral system.
-- Each user gets a stable invite_code. They can successfully invite up to 5
-- people; each invited user who joins (creates an account) gets +10 credits.
-- One reward per invited user (UNIQUE invitee_uid).

ALTER TABLE users ADD COLUMN invite_code TEXT;
ALTER TABLE users ADD COLUMN referred_by TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_invite_code ON users(invite_code);

CREATE TABLE IF NOT EXISTS referrals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  inviter_uid    TEXT NOT NULL,
  invitee_uid    TEXT NOT NULL,
  invitee_email  TEXT,
  reward_credits INTEGER NOT NULL DEFAULT 10,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(invitee_uid)
);
CREATE INDEX IF NOT EXISTS idx_referrals_inviter ON referrals(inviter_uid);
