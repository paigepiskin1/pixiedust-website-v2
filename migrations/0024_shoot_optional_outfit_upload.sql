-- Optional outfit upload on all photoshoot templates is applied via
-- scripts/patch-shoot-optional-outfit.mjs (and ensured at runtime by
-- ensureOptionalOutfitUpload in src/lib/templates.ts).
-- This migration is a no-op marker for deploy ordering.
SELECT 1;
