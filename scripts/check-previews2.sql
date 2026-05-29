SELECT id, title,
  CASE WHEN preview_image IS NOT NULL THEN 'YES' ELSE 'no' END AS img,
  CASE WHEN preview_video IS NOT NULL THEN 'YES' ELSE 'no' END AS vid
FROM templates
WHERE is_hidden = 0
ORDER BY title ASC
LIMIT 20;
