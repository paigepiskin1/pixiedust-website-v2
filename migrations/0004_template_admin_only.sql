-- Add is_admin_only flag to templates (visible only to admins in studio/catalog)
ALTER TABLE templates ADD COLUMN is_admin_only INTEGER NOT NULL DEFAULT 0;
