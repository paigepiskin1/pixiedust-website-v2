-- AI Writer: grounded article generation for Items (Admin → AI Writer).
--
-- Additive only. New tables, plus three nullable columns on blog_posts, so the
-- public pages keep working before and after this runs. Run once; the CREATEs
-- are idempotent, the ALTERs are not (D1 has no ADD COLUMN IF NOT EXISTS).

-- Search-result title and description, separate from the on-page title and
-- excerpt. NULL falls back to the title / excerpt, which is what every item
-- written before this did.
ALTER TABLE blog_posts ADD COLUMN seo_title TEXT;
ALTER TABLE blog_posts ADD COLUMN meta_description TEXT;
-- The writer job a draft came from. Admin metadata only; never rendered.
ALTER TABLE blog_posts ADD COLUMN ai_job_id TEXT;

-- The approved fact sheet. The writer may state product facts only from rows
-- with status 'approved'. 'needs_review' rows are shown to the writer as
-- "do not state" so a known conflict can't slip in through general knowledge.
CREATE TABLE IF NOT EXISTS ai_facts (
  id TEXT PRIMARY KEY,                       -- stable, e.g. 'tool.shoots'
  topic TEXT NOT NULL,                       -- brand | surfaces | tools | pricing | policy
  statement TEXT NOT NULL,
  source TEXT,                               -- where it was verified
  status TEXT NOT NULL DEFAULT 'approved',   -- approved | needs_review | retired
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_by TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Topic queue. Only an approved topic can be sent to the writer.
CREATE TABLE IF NOT EXISTS ai_topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic TEXT NOT NULL,
  brief_json TEXT NOT NULL,                  -- the same fields as a direct brief
  status TEXT NOT NULL DEFAULT 'proposed',   -- proposed | approved | rejected | used
  job_id TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One generation job per brief. Stages run one request at a time, driven by
-- the admin page; a lease (lock_stage / lock_until) stops two tabs running the
-- same stage. Results stay on the job until an admin saves them as a draft.
CREATE TABLE IF NOT EXISTS ai_jobs (
  id TEXT PRIMARY KEY,
  topic_id INTEGER,
  brief_json TEXT NOT NULL,
  brief_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',     -- queued | running | stalled | review | saved | cancelled
  stages_json TEXT NOT NULL,
  lock_stage TEXT,
  lock_until TEXT,
  research_json TEXT,
  draft_json TEXT,
  audit_json TEXT,
  links_json TEXT,
  image_json TEXT,
  overlap_json TEXT,
  edits_json TEXT,                           -- the admin's field edits in review
  item_id INTEGER,
  applied_at TEXT,
  cost_estimate_usd REAL NOT NULL DEFAULT 0,
  cost_actual_usd REAL NOT NULL DEFAULT 0,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
-- Duplicate protection: one live job per brief. A failed or cancelled job
-- frees its brief for another try.
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_jobs_brief_active
  ON ai_jobs(brief_hash) WHERE status NOT IN ('failed', 'cancelled');
CREATE INDEX IF NOT EXISTS idx_ai_jobs_created ON ai_jobs(created_at DESC);

-- Every provider call, for spend limits and the usage report.
CREATE TABLE IF NOT EXISTS ai_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id TEXT,
  stage TEXT NOT NULL,
  provider TEXT NOT NULL,                    -- openrouter | replicate | fal | moderation
  model TEXT,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  reasoning_tokens INTEGER,
  cost_usd REAL NOT NULL DEFAULT 0,          -- provider cost as reported (or estimated)
  gateway_usd REAL NOT NULL DEFAULT 0,       -- SyncNode per-call fee
  ok INTEGER NOT NULL DEFAULT 1,
  error TEXT,
  ms INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ai_usage_month ON ai_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_usage_job ON ai_usage(job_id);

-- Version history: each AI draft, each save into an item, and the item as it
-- stood before a save replaced it.
CREATE TABLE IF NOT EXISTS ai_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id TEXT NOT NULL,
  item_id INTEGER,
  kind TEXT NOT NULL,                        -- write | revise | saved | item-before-save
  snapshot_json TEXT NOT NULL,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ai_versions_job ON ai_versions(job_id, id);

-- Job log: what ran, what failed, who pressed what.
CREATE TABLE IF NOT EXISTS ai_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id TEXT NOT NULL,
  stage TEXT,
  level TEXT NOT NULL DEFAULT 'info',        -- info | warn | error
  message TEXT NOT NULL,
  actor TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ai_events_job ON ai_events(job_id, id);
