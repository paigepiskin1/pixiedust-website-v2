#!/usr/bin/env bash
# Prepares the LOCAL Cloudflare D1 database used by `astro dev` (miniflare
# platformProxy). Idempotent: safe to run repeatedly. Creates the local .wrangler
# state under .wrangler/state/v3/d1, applies all numbered migrations, and fills
# the gaps that live outside the numbered migration set (the app_settings table
# and users.welcome_sent_at column, which the app reads at runtime).
set -euo pipefail

DB_NAME="pixiedust"
WRANGLER="npx --yes wrangler"

echo "[setup-local-db] applying numbered migrations to local D1 ($DB_NAME)"
$WRANGLER d1 migrations apply "$DB_NAME" --local

echo "[setup-local-db] ensuring app_settings table exists"
$WRANGLER d1 execute "$DB_NAME" --local --command \
  "CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at DATETIME DEFAULT (datetime('now'))); \
   INSERT OR IGNORE INTO app_settings (key, value) VALUES ('welcome_email_subject', 'Welcome to PixieDust'); \
   INSERT OR IGNORE INTO app_settings (key, value) VALUES ('welcome_email_html', '<!-- DEFAULT -->');"

echo "[setup-local-db] ensuring users.welcome_sent_at column exists"
if ! $WRANGLER d1 execute "$DB_NAME" --local --command "SELECT welcome_sent_at FROM users LIMIT 0;" >/dev/null 2>&1; then
  $WRANGLER d1 execute "$DB_NAME" --local --command \
    "ALTER TABLE users ADD COLUMN welcome_sent_at DATETIME NULL DEFAULT NULL;"
fi

# Local-only dev secret so the admin Template API (docs/TEMPLATE_API.md) and admin
# tooling work in dev. NOT a production secret; real secrets go in Pages env vars.
if [ ! -f .dev.vars ]; then
  echo "[setup-local-db] creating .dev.vars with a local ADMIN_API_TOKEN"
  cat > .dev.vars <<'EOF'
# Local-only dev vars (gitignored). NOT production secrets.
# Enables the admin Template API + admin tooling locally.
ADMIN_API_TOKEN=local-dev-admin-token
EOF
fi

echo "[setup-local-db] done"
