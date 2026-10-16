-- Undo hold-oct17-batch.sql: put the held batch back on its original schedule.
--
-- Matches drafts whose kept publish date falls in the batch's window. Items
-- whose date is still ahead return to "scheduled"; any whose date has passed
-- by the time this runs go live immediately.
UPDATE blog_posts
SET status = 'published', updated_at = datetime('now')
WHERE status = 'draft'
  AND published_at BETWEEN '2026-10-17 01:39:00' AND '2026-10-17 02:29:00';
