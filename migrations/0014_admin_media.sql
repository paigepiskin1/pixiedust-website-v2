-- Admin media library: uploaded images/videos with CDN URLs for reuse in templates/heroes.
CREATE TABLE IF NOT EXISTS admin_media (
  id          TEXT PRIMARY KEY,
  url         TEXT NOT NULL,
  kind        TEXT NOT NULL DEFAULT 'image', -- image | video
  filename    TEXT,
  bytes       INTEGER,
  created_by  TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_admin_media_created ON admin_media (created_at DESC);
