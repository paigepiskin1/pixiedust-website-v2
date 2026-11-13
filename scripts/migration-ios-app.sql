-- PixyDust iPhone app (the AR app) sign-in.
--
-- The app signs in with the same Firebase project as the website and talks to
-- this backend with the Firebase ID token as a Bearer token. These columns
-- record which users came from the app, and when they last used it.
--
-- Additive only: nullable columns and an index. Run once; the ALTERs are not
-- idempotent (D1 has no ADD COLUMN IF NOT EXISTS).

-- Where the account was created: 'web' or 'ios'. NULL for accounts created
-- before this was tracked (all of them were web).
ALTER TABLE users ADD COLUMN signup_platform TEXT;

-- Use of the iPhone app, for any account, including web accounts that later
-- signed in on the app.
ALTER TABLE users ADD COLUMN app_first_seen_at TEXT;
ALTER TABLE users ADD COLUMN app_last_seen_at TEXT;
ALTER TABLE users ADD COLUMN app_version TEXT;

-- Which client a sign-in came from: 'web' or 'ios'.
ALTER TABLE login_events ADD COLUMN client TEXT;

CREATE INDEX IF NOT EXISTS idx_users_signup_source ON users(signup_source);
CREATE INDEX IF NOT EXISTS idx_users_app_seen ON users(app_last_seen_at);
