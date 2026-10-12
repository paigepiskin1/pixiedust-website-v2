-- Seed rows for Item Sections, and the url_mode column, which production
-- received as ad-hoc statements. Committed so a fresh database can be rebuilt.
--
-- Order on an empty database:
--   migration-blog.sql
--   migration-blog-taxonomy.sql
--   migration-collections.sql
--   migration-sections-seed.sql      <- this file
--   migration-item-sections.sql
--
-- Production already has all of this: the ALTER reports "duplicate column
-- name" there and changes nothing, and every INSERT is ON CONFLICT DO NOTHING.

ALTER TABLE collections ADD COLUMN url_mode TEXT NOT NULL DEFAULT 'section';

INSERT INTO collections (id, slug, title, blurb, index_template, item_template, noun, icon, sort_order, status, in_footer, url_mode) VALUES
 ('made-with',    'made-with-pixydust', 'Made with PixyDust', 'Creator projects, photos and videos made with the platform.', 'default', 'default', 'projects',     'rocket', 0, 'published', 1, 'section'),
 ('ar-effects',   'ar-effects',         'AR Effects Archive', 'The augmented-reality effects behind PixyDust, with demos and documented uses.', 'default', 'default', 'effects', 'model', 1, 'published', 1, 'section'),
 ('tutorials',    'tutorials',          'Tutorials',          'Step-by-step instructions for specific tools and techniques.', 'default', 'default', 'tutorials',   'book',   2, 'published', 1, 'section'),
 ('workflows',    'workflow-guides',    'Workflow Guides',    'Projects showing how to combine tools end to end.', 'default', 'default', 'guides', 'tools', 3, 'published', 1, 'section'),
 ('case-studies', 'case-studies',       'Case Studies',       'Brand campaigns and detailed project stories.', 'default', 'default', 'case studies', 'card', 4, 'published', 1, 'section'),
 ('press',        'press',              'Press & Media',      'Coverage, interviews, appearances and announcements.', 'default', 'default', 'articles', 'gift', 5, 'published', 1, 'section'),
 -- Blog's editorial categories. migration-item-sections.sql re-parents these
 -- under the Blog section.
 ('brand',        'category/brand',       'Brand & Company',            'Brand history, company news and the story behind PixyDust.', 'default', 'default', 'posts', 'book', 10, 'published', 0, 'blog'),
 ('beauty',       'category/beauty',      'Beauty & Styling',           'Hair, makeup and digital beauty.',  'default', 'default', 'posts', 'book', 11, 'published', 0, 'blog'),
 ('ai-creation',  'category/ai-creation', 'AI Creation',                'Image, video and photoshoot generation.', 'default', 'default', 'posts', 'book', 12, 'published', 0, 'blog'),
 ('filmmaking',   'category/filmmaking',  'Filmmaking',                 'Story, previs and production.',    'default', 'default', 'posts', 'book', 13, 'published', 0, 'blog'),
 ('social',       'category/social',      'Social Content',             'Short-form and branded content.',  'default', 'default', 'posts', 'book', 14, 'published', 0, 'blog'),
 ('privacy',      'category/privacy',     'Privacy & Responsible Use',  'How your media is handled.',       'default', 'default', 'posts', 'book', 15, 'published', 0, 'blog')
ON CONFLICT(id) DO NOTHING;
