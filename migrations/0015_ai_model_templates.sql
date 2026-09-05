-- Migration 0015: "AI Models" catalog templates.
-- Backs the new sidebar "AI Models" section (see src/lib/nav.ts) with real
-- /studio/<id> pages. Grouped as Image + Video in the nav.
--
-- Provider/model slugs are the closest currently-available routes for each
-- named model; confirm/adjust the exact SyncNode-enabled slug per model as
-- newer versions ship (title is the marketing name shown to users).
-- kind = 'ai-model' keeps these off the /video, /presets, /shoots catalog
-- grids (they're reached directly from the nav); they still surface in search.

-- ── IMAGE ──────────────────────────────────────────────────────────────────

INSERT OR REPLACE INTO templates
  (id, title, kind, type, category, provider, model, input_json, fields_json,
   credit_cost, quality_json, aspects_json, quantities_json, engine, eta,
   tags_json, tone, accent, meta, subtitle, description,
   is_featured, is_hidden, is_adult, sort_order, price_per_second, durations_json, is_admin_only)
VALUES
  ('model-seedream-5-pro', 'Seedream 5.0 Pro', 'ai-model', 'image', 'Image',
   'replicate', 'bytedance/seedream-4',
   '{"prompt":"{{prompt*}}","image_input":"{{files*}}","aspect_ratio":"{{aspect}}"}',
   '[{"key":"prompt","type":"textarea","label":"Prompt","placeholder":"Describe the image…","required":true},{"key":"files","type":"file","label":"Reference image(s) — optional","multiple":true,"max":6,"accept":"image/*"}]',
   10, NULL, '["1:1","4:5","3:4","4:3","16:9","9:16","3:2","2:3"]', '[1,2,4]',
   'Seedream 5.0 Pro', '~20s',
   '["Image","Text-to-image"]', 'lilac', 'var(--pd-lilac)', 'Image model',
   'High-fidelity text-to-image', 'Generate crisp, photoreal images from a prompt, with optional reference images for style and composition.',
   0, 0, 0, 10, NULL, NULL, 0),

  ('model-nano-banana-2-pro', 'Nano Banana 2.0 Pro', 'ai-model', 'image', 'Image',
   'replicate', 'google/nano-banana-pro',
   '{"prompt":"{{prompt*}}","image_input":"{{files*}}","aspect_ratio":"{{aspect}}","output_format":"jpg"}',
   '[{"key":"prompt","type":"textarea","label":"Prompt","placeholder":"Describe the edit or image…","required":true},{"key":"files","type":"file","label":"Reference image(s) — optional","multiple":true,"max":6,"accept":"image/*"}]',
   10, NULL, '["1:1","4:5","3:4","4:3","16:9","9:16","3:2","2:3"]', '[1,2,4]',
   'Nano Banana 2.0 Pro', '~20s',
   '["Image","Edit"]', 'amber', 'var(--pd-amber)', 'Image model',
   'Prompt-driven image editing', 'Edit and blend reference photos or generate from scratch with natural-language prompts.',
   0, 0, 0, 11, NULL, NULL, 0),

  ('model-gpt-image-2', 'GPT Image 2', 'ai-model', 'image', 'Image',
   'replicate', 'openai/gpt-image-2',
   '{"prompt":"{{prompt*}}","input_images":"{{files*}}","aspect_ratio":"{{aspect}}","quality":"high","output_format":"jpg"}',
   '[{"key":"prompt","type":"textarea","label":"Prompt","placeholder":"Describe the image…","required":true},{"key":"files","type":"file","label":"Reference image(s) — optional","multiple":true,"max":4,"accept":"image/*"}]',
   12, NULL, '["1:1","3:2","2:3"]', '[1,2,4]',
   'GPT Image 2', '~30s',
   '["Image","Text-to-image"]', 'mint', 'var(--pd-mint)', 'Image model',
   'Instruction-following image gen', 'OpenAI image generation with strong prompt adherence and clean text rendering.',
   0, 0, 0, 12, NULL, NULL, 0),

  ('model-seedance-2', 'Seedance 2', 'ai-model', 'video', 'Image',
   'replicate', 'bytedance/seedance-1-pro',
   '{"prompt":"{{prompt*}}","image":"{{file}}","duration":"{{duration}}","aspect_ratio":"{{aspect}}","resolution":"1080p"}',
   '[{"key":"prompt","type":"textarea","label":"Prompt","placeholder":"Describe the shot…","required":true},{"key":"file","type":"file","label":"First frame — optional","accept":"image/*"}]',
   1, NULL, '["16:9","9:16","1:1","4:3","3:4"]', NULL,
   'Seedance 2', '~1m',
   '["Video","Image-to-video"]', 'teal', 'var(--pd-teal)', 'Video model',
   'Cinematic motion from a prompt', 'Turn a prompt or a still frame into short cinematic video clips.',
   0, 0, 0, 13, 30, '[5,10]', 0);

-- ── VIDEO ──────────────────────────────────────────────────────────────────

INSERT OR REPLACE INTO templates
  (id, title, kind, type, category, provider, model, input_json, fields_json,
   credit_cost, quality_json, aspects_json, quantities_json, engine, eta,
   tags_json, tone, accent, meta, subtitle, description,
   is_featured, is_hidden, is_adult, sort_order, price_per_second, durations_json, is_admin_only)
VALUES
  ('model-seedance-2-0', 'Seedance 2.0', 'ai-model', 'video', 'Video',
   'replicate', 'bytedance/seedance-1-pro',
   '{"prompt":"{{prompt*}}","image":"{{file}}","duration":"{{duration}}","aspect_ratio":"{{aspect}}","resolution":"1080p"}',
   '[{"key":"prompt","type":"textarea","label":"Prompt","placeholder":"Describe the shot…","required":true},{"key":"file","type":"file","label":"First frame — optional","accept":"image/*"}]',
   1, NULL, '["16:9","9:16","1:1","4:3","3:4"]', NULL,
   'Seedance 2.0', '~1m',
   '["Video","Image-to-video"]', 'pink', 'var(--pd-pink)', 'Video model',
   'Cinematic AI video', 'Generate smooth, cinematic clips from a prompt with an optional first frame.',
   0, 0, 0, 20, 30, '[5,10]', 0),

  ('model-seedance-2-5', 'Seedance 2.5', 'ai-model', 'video', 'Video',
   'replicate', 'bytedance/seedance-1-pro',
   '{"prompt":"{{prompt*}}","image":"{{file}}","duration":"{{duration}}","aspect_ratio":"{{aspect}}","resolution":"1080p"}',
   '[{"key":"prompt","type":"textarea","label":"Prompt","placeholder":"Describe the shot…","required":true},{"key":"file","type":"file","label":"First frame — optional","accept":"image/*"}]',
   1, NULL, '["16:9","9:16","1:1","4:3","3:4"]', NULL,
   'Seedance 2.5', '~2m',
   '["Video","Long-form"]', 'pink', 'var(--pd-pink)', 'Video model',
   'Longer cinematic clips up to 30s', 'The 2.5 engine adds longer durations (up to 30 seconds) and steadier motion.',
   0, 0, 0, 21, 30, '[5,10,15,20,25,30]', 0),

  ('model-kling-3', 'Kling 3.0', 'ai-model', 'video', 'Video',
   'replicate', 'kwaivgi/kling-v2.1',
   '{"prompt":"{{prompt*}}","start_image":"{{file}}","duration":"{{duration}}","aspect_ratio":"{{aspect}}"}',
   '[{"key":"prompt","type":"textarea","label":"Prompt","placeholder":"Describe the shot…","required":true},{"key":"file","type":"file","label":"Start frame — optional","accept":"image/*"}]',
   1, NULL, '["16:9","9:16","1:1"]', NULL,
   'Kling 3.0', '~2m',
   '["Video","Image-to-video"]', 'lilac', 'var(--pd-lilac)', 'Video model',
   'Fluid, physical motion', 'Kling generates highly dynamic, physically believable video from a prompt or start frame.',
   0, 0, 0, 22, 35, '[5,10]', 0),

  ('model-veo-3', 'Google Veo 3', 'ai-model', 'video', 'Video',
   'replicate', 'google/veo-3',
   '{"prompt":"{{prompt*}}","image":"{{file}}","aspect_ratio":"{{aspect}}"}',
   '[{"key":"prompt","type":"textarea","label":"Prompt","placeholder":"Describe the shot (audio can be described too)…","required":true},{"key":"file","type":"file","label":"First frame — optional","accept":"image/*"}]',
   120, NULL, '["16:9","9:16"]', NULL,
   'Google Veo 3', '~2m',
   '["Video","With audio"]', 'teal', 'var(--pd-teal)', 'Video model',
   'Native audio + video', 'Veo 3 produces high-quality 8-second clips with synchronized generated audio.',
   0, 0, 0, 23, NULL, NULL, 0),

  ('model-minimax-h3-max', 'Minimax H3 Max', 'ai-model', 'video', 'Video',
   'replicate', 'minimax/hailuo-2',
   '{"prompt":"{{prompt*}}","first_frame_image":"{{file}}","duration":"{{duration}}","resolution":"1080p"}',
   '[{"key":"prompt","type":"textarea","label":"Prompt","placeholder":"Describe the shot…","required":true},{"key":"file","type":"file","label":"First frame — optional","accept":"image/*"}]',
   1, NULL, '["16:9","9:16","1:1"]', NULL,
   'Minimax H3 Max', '~2m',
   '["Video","High detail"]', 'amber', 'var(--pd-amber)', 'Video model',
   'Maximum-detail motion', 'The Max tier of Minimax H3 for the sharpest detail and most stable motion.',
   0, 0, 0, 24, 40, '[6,10]', 0),

  ('model-wan-3-prime', 'Wan 3.0 Prime', 'ai-model', 'video', 'Video',
   'replicate', 'wan-video/wan-2.5-t2v',
   '{"prompt":"{{prompt*}}","image":"{{file}}","duration":"{{duration}}","aspect_ratio":"{{aspect}}","resolution":"1080p"}',
   '[{"key":"prompt","type":"textarea","label":"Prompt","placeholder":"Describe the shot…","required":true},{"key":"file","type":"file","label":"First frame — optional","accept":"image/*"}]',
   1, NULL, '["16:9","9:16","1:1"]', NULL,
   'Wan 3.0 Prime', '~2m',
   '["Video","Premium"]', 'mint', 'var(--pd-mint)', 'Video model',
   'Premium Wan generation', 'The Prime tier of Wan 3.0 for higher resolution and richer detail.',
   0, 0, 0, 25, 35, '[5,10]', 0),

  ('model-minimax-h3', 'Minimax H3', 'ai-model', 'video', 'Video',
   'replicate', 'minimax/hailuo-2',
   '{"prompt":"{{prompt*}}","first_frame_image":"{{file}}","duration":"{{duration}}","resolution":"768p"}',
   '[{"key":"prompt","type":"textarea","label":"Prompt","placeholder":"Describe the shot…","required":true},{"key":"file","type":"file","label":"First frame — optional","accept":"image/*"}]',
   1, NULL, '["16:9","9:16","1:1"]', NULL,
   'Minimax H3', '~90s',
   '["Video","Image-to-video"]', 'amber', 'var(--pd-amber)', 'Video model',
   'Expressive AI video', 'Minimax H3 turns prompts and stills into expressive, well-timed motion.',
   0, 0, 0, 26, 30, '[6,10]', 0),

  ('model-wan-3', 'Wan 3.0', 'ai-model', 'video', 'Video',
   'replicate', 'wan-video/wan-2.5-t2v',
   '{"prompt":"{{prompt*}}","image":"{{file}}","duration":"{{duration}}","aspect_ratio":"{{aspect}}","resolution":"720p"}',
   '[{"key":"prompt","type":"textarea","label":"Prompt","placeholder":"Describe the shot…","required":true},{"key":"file","type":"file","label":"First frame — optional","accept":"image/*"}]',
   1, NULL, '["16:9","9:16","1:1"]', NULL,
   'Wan 3.0', '~90s',
   '["Video","Text-to-video"]', 'mint', 'var(--pd-mint)', 'Video model',
   'Open, versatile video', 'Wan 3.0 generates versatile video from a prompt, with an optional first frame.',
   0, 0, 0, 27, 30, '[5,10]', 0);
