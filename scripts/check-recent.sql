SELECT id, template_id, status, error, provider_job_id, created_at FROM generations
WHERE template_id IN ('old-emojiify', 'old-face-swap', 'old-f1-racing-trend')
ORDER BY created_at DESC LIMIT 6;
