-- Migration: welcome email infrastructure
-- 1. Track whether welcome email was sent per user
ALTER TABLE users ADD COLUMN welcome_sent_at DATETIME NULL DEFAULT NULL;

-- 2. Key-value store for admin-editable app settings (email templates, etc.)
CREATE TABLE IF NOT EXISTS app_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at DATETIME DEFAULT (datetime('now'))
);

-- 3. Seed the default welcome email subject and HTML
INSERT OR IGNORE INTO app_settings (key, value) VALUES ('welcome_email_subject', 'Welcome to PixieDust ✨ — Your AI creative studio is ready');
INSERT OR IGNORE INTO app_settings (key, value) VALUES ('welcome_email_html', '<!-- DEFAULT -->');
