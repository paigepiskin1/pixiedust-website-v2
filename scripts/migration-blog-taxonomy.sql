-- Blog taxonomy: primary category, and a manual override for related articles.
--
-- Additive and idempotent in effect: SQLite has no ADD COLUMN IF NOT EXISTS, so
-- re-running reports "duplicate column name" and changes nothing. Safe either way.

ALTER TABLE blog_posts ADD COLUMN category TEXT;

-- Ordered list of blog_posts.id chosen by an editor, e.g. "[17,4,7]". Stable
-- ids, not slugs: renaming a post or changing its permalink must not break the
-- recommendation pointing at it.
ALTER TABLE blog_posts ADD COLUMN related_json TEXT NOT NULL DEFAULT '[]';

-- Relevance ranking filters on category before anything else.
CREATE INDEX IF NOT EXISTS idx_blog_category ON blog_posts(category);
