-- Reuse snapshot for a generation: lets the gallery reload a creation's inputs
-- (prompt + reference images + model + aspect/duration/quality) into the studio.
-- Stored separately from input_json (which is the resolved provider payload and
-- keeps `asset://` ids that can go stale); reuse_json keeps the durable CDN
-- display URLs so references can be shown and re-registered on reuse.
ALTER TABLE generations ADD COLUMN reuse_json TEXT;
