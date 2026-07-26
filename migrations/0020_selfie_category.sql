-- Add "Selfie" to the shoot category palette and tag NYC .5 selfie shoots.
-- Catalog palette lives in app_settings JSON; runtime also merges new defaults
-- from src/lib/catalog.ts via getCategories() so Selfie appears even if this
-- migration's JSON update was applied separately.
UPDATE templates
SET category = 'Selfie', updated_at = datetime('now')
WHERE id IN ('nyc-dot5-stairwell', 'nyc-dot5-subway', 'nyc-dot5-cafe');
