-- Phase 4: users. The full schema (templates, generations, credit ledger,
-- subscriptions, etc.) is added in Phase 5.
CREATE TABLE IF NOT EXISTS users (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  uid            TEXT NOT NULL UNIQUE,            -- Firebase UID
  email          TEXT,
  name           TEXT,
  username       TEXT UNIQUE,
  avatar_url     TEXT,
  balance        INTEGER NOT NULL DEFAULT 5,      -- credits (Free tier signup grant)
  is_admin       INTEGER NOT NULL DEFAULT 0,
  is_adult       INTEGER NOT NULL DEFAULT 0,
  email_verified INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  last_login     TEXT,
  deleted_at     TEXT
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
