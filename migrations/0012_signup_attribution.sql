-- Migration 0012: acquisition attribution on user signup.
-- signup_source        — best-guess channel (utm_source, else referrer host,
--                         else ad-click platform). Easy to GROUP BY.
-- signup_attribution   — full first-touch JSON: all utm_*, gclid/fbclid/ttclid,
--                         referrer, landing path.

ALTER TABLE users ADD COLUMN signup_source TEXT;
ALTER TABLE users ADD COLUMN signup_attribution TEXT;
