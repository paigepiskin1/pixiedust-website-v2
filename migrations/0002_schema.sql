-- Phase 5: full data model. JSON columns are stored as TEXT (SQLite/D1).

-- ─── Templates ────────────────────────────────────────────────
-- Drives every user generation. input_json holds the provider payload with
-- {{key}} placeholders; fields_json defines the user inputs that fill them.
-- Multi-step studios (ad/avatar/fashion) use steps_json (each step has fields).
CREATE TABLE IF NOT EXISTS templates (
  id             TEXT PRIMARY KEY,                 -- slug, e.g. "preset-kodak-portra"
  title          TEXT NOT NULL,
  kind           TEXT NOT NULL,                    -- preset|shoot|cinema|i2v|fashion-video|game-video|motion|beauty|fashion|avatar|ad|motion-upload
  type           TEXT NOT NULL DEFAULT 'image',    -- image|video
  category       TEXT,                             -- catalog filter bucket (e.g. Film, Era)
  provider       TEXT NOT NULL DEFAULT 'replicate',-- replicate|fal|alibaba|openai
  model          TEXT NOT NULL,
  input_json     TEXT NOT NULL DEFAULT '{}',       -- provider params with {{key}} placeholders
  fields_json    TEXT NOT NULL DEFAULT '[]',       -- single-step field defs
  steps_json     TEXT,                             -- multi-step builder (null = single-step)
  credit_cost    INTEGER NOT NULL DEFAULT 1,
  quality_json   TEXT,                             -- {"std":1,"pro":1.5,"cinema":2.5}
  aspects_json   TEXT,                             -- ["1:1","16:9","9:16"]
  quantities_json TEXT,                            -- [1,2,4]
  engine         TEXT,                             -- display label, e.g. "Flux Schnell"
  eta            TEXT,                             -- display, e.g. "~15s"
  tags_json      TEXT NOT NULL DEFAULT '[]',
  tone           TEXT NOT NULL DEFAULT 'lilac',    -- media placeholder tone
  accent         TEXT,                             -- accent css var, e.g. var(--pd-amber)
  meta           TEXT,                             -- card meta, e.g. "0:08" / "24 shots"
  subtitle       TEXT,
  description    TEXT,
  preview_image  TEXT,                             -- Bunny URL
  preview_video  TEXT,
  is_featured    INTEGER NOT NULL DEFAULT 0,
  is_hidden      INTEGER NOT NULL DEFAULT 0,
  is_adult       INTEGER NOT NULL DEFAULT 0,
  sort_order     INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_templates_kind ON templates (kind, is_hidden);
CREATE INDEX IF NOT EXISTS idx_templates_featured ON templates (is_featured, is_hidden);

-- ─── Generations ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS generations (
  id              TEXT PRIMARY KEY,                -- uuid
  user_id         INTEGER NOT NULL,
  template_id     TEXT,                            -- nullable if template later deleted
  kind            TEXT,
  type            TEXT NOT NULL DEFAULT 'image',
  provider        TEXT NOT NULL,
  model           TEXT NOT NULL,
  input_json      TEXT NOT NULL DEFAULT '{}',      -- resolved payload sent to provider
  status          TEXT NOT NULL DEFAULT 'pending', -- pending|processing|completed|failed
  provider_job_id TEXT,                            -- SyncNode job_id
  output_url      TEXT,                            -- Bunny CDN url
  thumbnail_url   TEXT,
  error           TEXT,
  credits_charged INTEGER NOT NULL DEFAULT 0,
  credits_refunded INTEGER NOT NULL DEFAULT 0,
  quality         TEXT,
  quantity        INTEGER NOT NULL DEFAULT 1,
  is_public       INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_generations_user ON generations (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_generations_status ON generations (status);
CREATE INDEX IF NOT EXISTS idx_generations_job ON generations (provider_job_id);

-- ─── Credit ledger (audit of every credit movement) ───────────
CREATE TABLE IF NOT EXISTS credit_ledger (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL,
  delta         INTEGER NOT NULL,                  -- + credit, - debit
  balance_after INTEGER NOT NULL,
  reason        TEXT NOT NULL,                     -- signup_grant|purchase|generation_debit|generation_refund|admin_adjust|subscription_grant
  ref_type      TEXT,                              -- generation|purchase|subscription|admin
  ref_id        TEXT,
  note          TEXT,                              -- e.g. admin reason
  actor         TEXT,                              -- system | <admin uid>
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_ledger_user ON credit_ledger (user_id, created_at);

-- ─── Monetization config ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscription_tiers (
  id                  TEXT PRIMARY KEY,            -- free|plus|studio
  name                TEXT NOT NULL,
  price_cents         INTEGER NOT NULL DEFAULT 0,  -- monthly
  annual_price_cents  INTEGER,
  monthly_credits     INTEGER NOT NULL DEFAULT 0,  -- bundled allotment
  pack_discount_pct   INTEGER NOT NULL DEFAULT 0,  -- discount on extra packs
  rate_limit_per_min  INTEGER NOT NULL DEFAULT 3,
  concurrency         INTEGER NOT NULL DEFAULT 3,
  stripe_price_id        TEXT,
  stripe_price_id_annual TEXT,
  features_json       TEXT NOT NULL DEFAULT '[]',
  sort_order          INTEGER NOT NULL DEFAULT 0,
  is_active           INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS credit_packs (
  id                    TEXT PRIMARY KEY,          -- starter|creator|pro
  name                  TEXT NOT NULL,
  credits               INTEGER NOT NULL,
  price_cents           INTEGER NOT NULL,          -- standard (non-subscriber) price
  subscriber_price_cents INTEGER,                  -- discounted (subscriber) price
  stripe_price_id       TEXT,
  badge                 TEXT,                       -- e.g. "Best value"
  sort_order            INTEGER NOT NULL DEFAULT 0,
  is_active             INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS subscriptions (
  user_id              INTEGER PRIMARY KEY,
  tier_id              TEXT NOT NULL,
  status               TEXT NOT NULL DEFAULT 'active',
  stripe_customer_id   TEXT,
  stripe_subscription_id TEXT,
  current_period_end   TEXT,
  created_at           TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at           TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (tier_id) REFERENCES subscription_tiers(id)
);

-- ─── Admin audit (non-credit admin actions) ───────────────────
CREATE TABLE IF NOT EXISTS admin_audit (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_uid   TEXT NOT NULL,
  action      TEXT NOT NULL,                       -- template.create|template.update|template.delete|user.balance_adjust|refund
  target_type TEXT,
  target_id   TEXT,
  detail_json TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit (created_at);
