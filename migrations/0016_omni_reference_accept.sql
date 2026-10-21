-- Broaden Omni / Seedance 2.0 reference file fields so users can upload
-- images, videos, AND audio (not just images).
UPDATE templates
SET fields_json = REPLACE(
      REPLACE(fields_json, '"accept":"image/*"', '"accept":"image/*,video/*,audio/*"'),
      '"accept": "image/*"',
      '"accept":"image/*,video/*,audio/*"'
    ),
    updated_at = datetime('now')
WHERE lower(id) LIKE '%omni%'
   OR lower(title) LIKE '%omni%'
   OR lower(model) LIKE '%omni%'
   OR lower(model) LIKE '%seedance-2%'
   OR lower(model) LIKE '%seedance/2%'
   OR lower(input_json) LIKE '%audio_url%'
   OR lower(input_json) LIKE '%video_url%'
   OR lower(input_json) LIKE '%input_audios%'
   OR lower(input_json) LIKE '%input_videos%'
   OR lower(fields_json) LIKE '%omni%';
