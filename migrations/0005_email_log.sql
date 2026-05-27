-- Outbound email log. Every send (welcome, feedback, future transactional mail)
-- records a row here so admins can see what went out and whether it succeeded.
CREATE TABLE IF NOT EXISTS email_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  to_email    TEXT NOT NULL,
  from_email  TEXT,
  subject     TEXT,
  template    TEXT,                          -- logical name: welcome | feedback | ...
  status      TEXT NOT NULL DEFAULT 'queued', -- queued | sent | error
  provider_id TEXT,                          -- Mailgun message id
  error       TEXT,
  user_uid    TEXT,                          -- actor / related user, if any
  meta_json   TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT
);
CREATE INDEX IF NOT EXISTS idx_email_log_created ON email_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_log_status ON email_log (status);
