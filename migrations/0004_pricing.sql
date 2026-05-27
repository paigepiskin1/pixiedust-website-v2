-- Per-second pricing for video templates. When price_per_second > 0, cost is
-- credits/second * duration (instead of the flat credit_cost). durations_json
-- lists the selectable durations (seconds) shown as a workspace control.
ALTER TABLE templates ADD COLUMN price_per_second INTEGER;
ALTER TABLE templates ADD COLUMN durations_json TEXT;
