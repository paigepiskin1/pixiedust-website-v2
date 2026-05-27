-- Multi-step generation: runtime chain state (step index, per-step job ids +
-- outputs, captured user inputs). NULL for single-step generations.
ALTER TABLE generations ADD COLUMN chain_json TEXT;
