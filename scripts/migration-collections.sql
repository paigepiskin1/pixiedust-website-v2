-- Content collections: the footer sections that are not the blog —
-- Made with PixyDust, AR Effects Archive, Tutorials, Workflow Guides,
-- Case Studies, Press & Media — plus any added later.
--
-- One generic pair of tables rather than six bespoke ones. The sections differ
-- in what they hold, not in how they behave: each is an index page listing
-- items, each item is its own page. Hardcoding six would mean six rewrites the
-- first time a template or a category page changes, which is explicitly
-- expected here.
--
-- Additive and idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS collections (
  id             TEXT    PRIMARY KEY,          -- 'ar-effects'
  slug           TEXT    NOT NULL UNIQUE,      -- URL base: /ar-effects
  title          TEXT    NOT NULL,
  blurb          TEXT    NOT NULL DEFAULT '',
  -- Which layout the index and item pages use. Swappable per collection
  -- without touching rows, which is the point of keeping it as data.
  index_template TEXT    NOT NULL DEFAULT 'grid',      -- grid | list | gallery
  item_template  TEXT    NOT NULL DEFAULT 'article',   -- article | gallery | steps | link
  -- Noun used in the UI: "3 effects", "12 tutorials".
  noun           TEXT    NOT NULL DEFAULT 'items',
  icon           TEXT    NOT NULL DEFAULT 'book',
  sort_order     INTEGER NOT NULL DEFAULT 0,
  status         TEXT    NOT NULL DEFAULT 'published', -- draft | published
  -- Shown in the site footer. A collection can exist and be linked from
  -- elsewhere without taking a footer slot.
  in_footer      INTEGER NOT NULL DEFAULT 1,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS collection_items (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  collection_id  TEXT    NOT NULL,
  slug           TEXT    NOT NULL,             -- /ar-effects/<slug>
  title          TEXT    NOT NULL,
  summary        TEXT,                         -- card copy + meta description
  content_html   TEXT    NOT NULL DEFAULT '',  -- same editor as the blog
  hero_url       TEXT,                         -- card image + og:image
  hero_alt       TEXT,
  -- Press items can point at the publisher instead of having their own page;
  -- when set, the card links out and no detail page is rendered.
  external_url   TEXT,
  -- Template-specific fields without a migration per template: brand, model,
  -- platform, year, credits, gallery urls. Flexible by design.
  meta_json      TEXT    NOT NULL DEFAULT '{}',
  tags_json      TEXT    NOT NULL DEFAULT '[]',
  status         TEXT    NOT NULL DEFAULT 'draft',
  -- Same scheduling model as the blog: a future date keeps the item hidden
  -- until the clock passes it, with no job to run.
  published_at   TEXT,
  featured       INTEGER NOT NULL DEFAULT 0,
  sort_order     INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Slugs are unique within a collection, matching the URL shape, so two
-- collections can each have a "getting-started".
CREATE UNIQUE INDEX IF NOT EXISTS idx_citem_path ON collection_items(collection_id, slug);
-- Index pages read (collection, status, published_at).
CREATE INDEX IF NOT EXISTS idx_citem_live ON collection_items(collection_id, status, published_at DESC);
