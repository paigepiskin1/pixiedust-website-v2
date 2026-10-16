-- Hold back the scheduled batch so it does not go live tonight.
--
-- Affects only items that are published with a date still in the future —
-- the 51 set for 2026-10-17 01:39–02:29 UTC (Oct 16, 8:39–9:29 PM Central).
-- Already-live items are not touched.
--
-- Sets them to draft and KEEPS their publish dates, so the batch can be put
-- back exactly with restore-oct17-batch.sql.
UPDATE blog_posts
SET status = 'draft', updated_at = datetime('now')
WHERE status = 'published' AND published_at > datetime('now');
