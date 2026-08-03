-- Categorize all photoshoot templates into Selfie / Street / Movies /
-- Broadcast Trends / Lifestyle / Fantasy. Palette extras are merged at
-- runtime via getCategories() + SHOOT_CATS defaults.

UPDATE templates SET category = 'Selfie', updated_at = datetime('now')
WHERE id IN (
  'nyc-dot5-stairwell',
  'nyc-dot5-subway',
  'nyc-dot5-cafe',
  'subway-platform-copy-2',
  'subway-platform-copy-2-copy',
  'cool-girl-selfie'
);

UPDATE templates SET category = 'Street', updated_at = datetime('now')
WHERE id IN (
  'nyc-dot5-bodega',
  'nyc-dot5-walk',
  'subway-platform',
  'subway-platform-copy',
  'subway-platform-copy-2-copy-2'
);

UPDATE templates SET category = 'Movies', updated_at = datetime('now')
WHERE id IN (
  'old-ghostface-ai-trend',
  'old-90-s-pulp-vibe'
);

UPDATE templates SET category = 'Broadcast Trends', updated_at = datetime('now')
WHERE id IN (
  'old-korean-baseball-trend',
  'old-f1-racing-trend',
  'old-basketball-courtside-trend'
);

UPDATE templates SET category = 'Fantasy', updated_at = datetime('now')
WHERE id IN (
  'old-dystopian-trash-photoshoot',
  'old-wasteland-vibes'
);

UPDATE templates SET category = 'Lifestyle', updated_at = datetime('now')
WHERE id IN (
  'old-emo-makeover',
  'old-f1-racing-trend-copy',
  'change-hair-color-grid',
  'change-hair-color-grid-copy'
);
