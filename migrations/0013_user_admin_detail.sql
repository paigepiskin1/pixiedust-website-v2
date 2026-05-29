-- Migration 0013: account disable flag + login history (for admin abuse review).

ALTER TABLE users ADD COLUMN disabled_at TEXT;

CREATE TABLE IF NOT EXISTS login_events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  uid        TEXT NOT NULL,
  ip         TEXT,
  country    TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_login_events_user ON login_events(user_id, created_at);
