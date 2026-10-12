-- Items and Item Sections.
--
-- One content type (items, stored in blog_posts) filed into top-level
-- sections, each with its own URL root: /blog/<item>, /made-with-pixydust/<item>,
-- /ar-effects/<item> … Blog is an ordinary section, not a special case.
-- Sections may have sub-categories, created by the admin, which organise items
-- within a section without changing their URL.
--
-- Sections and sub-categories share the `collections` table: a row with no
-- parent_id is a section, a row with one is a sub-category of that section.
--
-- Run once. Every UPDATE is guarded so a re-run is a no-op.

-- NULL = top-level section; otherwise the id of the section this sub-category
-- belongs to.
ALTER TABLE collections ADD COLUMN parent_id TEXT;

-- The section an item is filed under. `category` keeps its existing role as the
-- optional sub-category within that section.
ALTER TABLE blog_posts ADD COLUMN section TEXT;

CREATE INDEX IF NOT EXISTS idx_blog_section ON blog_posts(section, status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_collections_parent ON collections(parent_id, sort_order);

-- Blog becomes a section like the others.
INSERT INTO collections (id, slug, title, blurb, index_template, item_template, noun, icon, sort_order, status, in_footer, url_mode, parent_id)
VALUES ('blog', 'blog', 'Blog', 'Guides, feature news and creative walkthroughs.', 'default', 'default', 'articles', 'book', -1, 'published', 1, 'section', NULL)
ON CONFLICT(id) DO NOTHING;

-- The six editorial categories become Blog's sub-categories. Their slug is
-- namespaced under the section id because `slug` is unique across the whole
-- table: a Blog sub-category called "press" must not collide with the Press
-- section. The URL key is the last segment.
UPDATE collections SET parent_id = 'blog', slug = 'blog/' || id
WHERE id IN ('brand', 'beauty', 'ai-creation', 'filmmaking', 'social', 'privacy') AND parent_id IS NULL;

-- File every item under its section. Items whose category was a section move
-- to that section with no sub-category; everything else is Blog.
UPDATE blog_posts SET section = CASE
    WHEN category IN (SELECT id FROM collections WHERE parent_id IS NULL AND id != 'blog') THEN category
    ELSE 'blog'
  END
WHERE section IS NULL;

UPDATE blog_posts SET category = NULL
WHERE category IN (SELECT id FROM collections WHERE parent_id IS NULL);

-- Every section defaults to the Blog look; the template is changeable per
-- section in Item Sections.
UPDATE collections SET index_template = 'default', item_template = 'default' WHERE parent_id IS NULL;
