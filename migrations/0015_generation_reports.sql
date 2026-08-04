-- User-submitted generation issue tickets (stuck processing, bad result, etc.).
CREATE TABLE IF NOT EXISTS generation_reports (
  id              TEXT PRIMARY KEY,
  generation_id   TEXT NOT NULL,
  user_id         INTEGER NOT NULL,
  reason          TEXT NOT NULL,
  note            TEXT,
  status          TEXT NOT NULL DEFAULT 'open', -- open | resolved
  admin_note      TEXT,
  resolved_by     TEXT,
  resolved_at     TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  -- No FK on generation_id so tickets survive if the user deletes the gen.
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_generation_reports_status_created
  ON generation_reports (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_generation_reports_gen
  ON generation_reports (generation_id);

CREATE INDEX IF NOT EXISTS idx_generation_reports_user
  ON generation_reports (user_id, created_at DESC);
