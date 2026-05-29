SELECT
  COUNT(*) AS total,
  SUM(CASE WHEN preview_image IS NOT NULL THEN 1 ELSE 0 END) AS has_image,
  SUM(CASE WHEN preview_video IS NOT NULL THEN 1 ELSE 0 END) AS has_video,
  SUM(CASE WHEN preview_image IS NULL AND preview_video IS NULL THEN 1 ELSE 0 END) AS missing
FROM templates WHERE is_hidden = 0;
