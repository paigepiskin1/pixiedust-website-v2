-- Help Centre content, moved out of src/lib/help.ts into D1 so it can be
-- edited in the admin instead of requiring a deploy.
--
-- Additive and idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS help_categories (
  id         TEXT    PRIMARY KEY,            -- URL segment: /support/<id>
  title      TEXT    NOT NULL,
  icon       TEXT    NOT NULL DEFAULT 'book',-- key into components/help/HelpIcon
  blurb      TEXT    NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  status     TEXT    NOT NULL DEFAULT 'published',  -- draft | published
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS help_articles (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id TEXT    NOT NULL,
  slug        TEXT    NOT NULL,              -- URL: /support/<category>/<slug>
  title       TEXT    NOT NULL,
  summary     TEXT    NOT NULL DEFAULT '',
  -- HelpNode[] as JSON: strings, {h}, {list}, {steps}, {note}. Kept structured
  -- rather than flattened to HTML so the article layout keeps styling each node
  -- type consistently, and so an editor cannot paste arbitrary markup.
  body_json   TEXT    NOT NULL DEFAULT '[]',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  status      TEXT    NOT NULL DEFAULT 'published',
  popular     INTEGER NOT NULL DEFAULT 0,    -- surfaced on the /support landing
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- A slug only has to be unique within its category, which is what the URL
-- shape implies and what lets two categories both have "billing-faq".
CREATE UNIQUE INDEX IF NOT EXISTS idx_help_article_path ON help_articles(category_id, slug);
-- Category pages and the landing list both read (category, status, order).
CREATE INDEX IF NOT EXISTS idx_help_article_cat ON help_articles(category_id, status, sort_order);
