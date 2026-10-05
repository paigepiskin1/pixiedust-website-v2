-- Blog (/blog) — posts authored in the admin, rendered publicly and indexed.
--
-- Additive and idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS blog_posts (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  slug          TEXT    NOT NULL UNIQUE,        -- URL: /blog/<slug>
  title         TEXT    NOT NULL,
  excerpt       TEXT,                           -- meta description + card copy
  content_html  TEXT    NOT NULL DEFAULT '',    -- editor output
  thumbnail_url TEXT,                           -- card image + og:image; falls
                                                -- back to the first <img> in the body
  thumbnail_alt TEXT,
  author        TEXT,                           -- byline; defaults to PixyDust
  tags_json     TEXT    NOT NULL DEFAULT '[]',
  status        TEXT    NOT NULL DEFAULT 'draft',  -- draft | published
  published_at  TEXT,                           -- set on first publish; drives ordering
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- The public index and sitemap both read (status, published_at DESC).
CREATE INDEX IF NOT EXISTS idx_blog_status_pub ON blog_posts(status, published_at DESC);
-- Slug lookup drives every /blog/<slug> request.
CREATE INDEX IF NOT EXISTS idx_blog_slug       ON blog_posts(slug);
