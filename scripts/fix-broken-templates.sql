-- Fix broken {{select|...}} tokens and add multi-file support to old-* templates.
-- All templates below were broken: aspect_ratio was a non-resolving token so the
-- API received the literal string {{select|Aspect Ratio|...|...}} and rejected it.
-- Resolution selects are hardcoded to sensible defaults (2K for seedream, auto for gpt-image-2).
-- File fields that should accept multiple images now have multiple:true, max:4.

-- ── nano-banana (Imagen 3) family ─────────────────────────────────────────────

UPDATE templates SET
  fields_json = '[{"key":"files","type":"file","label":"Reference photos","required":true,"multiple":true,"max":4,"accept":"image/*","help":"Up to 4 reference photos for better likeness"}]',
  input_json  = '{"prompt":"change subject''s hairstyle to emo hairstyle, side bangs, wearing a band t-shirt, flash photo, wide-angle fisheye lens","image_input":"{{files*}}","aspect_ratio":"{{aspect}}","output_format":"png"}'
WHERE id = 'old-emo-makeover';

UPDATE templates SET
  fields_json = '[{"key":"files","type":"file","label":"Reference photos","required":true,"multiple":true,"max":4,"accept":"image/*","help":"Up to 4 reference photos for better likeness"}]',
  input_json  = '{"prompt":"Create photo of me in a dreamy 2k style portrait of me laying on a shiny light blue satin bedding as i hold a large 90s style corded phone and in a thoughtful daydreaming  wearing a baby blue cropped low cut cardigan (if female) (t-shirt if male) with (mini if female) baby blue shorts, baby blue fuzzy slippers and a chain necklace with a heart (tiffany style). the room behind her is girly and daydreamy with 90s style posters. her makeup is simple yet glamorous with brown lipgloss and brown lip liner. The photo should have a grainy 90s style to it with a light source like a lamp in a dimly lit room at night. a bowl of popcorn rests beside her near some 90s style magazines. Ghost face should be behind her staring at her, his body should be dimly lit, and he should be standing in the doorway of a dimly lit hallway. the background behind he should be slightly dark and ominous. Don''t change my facial features or hair color.","image_input":"{{files*}}","aspect_ratio":"{{aspect}}","output_format":"jpg"}'
WHERE id = 'old-ghostface-ai-trend';

UPDATE templates SET
  fields_json = '[{"key":"files","type":"file","label":"Reference photos","required":true,"multiple":true,"max":4,"accept":"image/*","help":"Up to 4 reference photos for better likeness"}]',
  input_json  = '{"prompt":"Wide angle camera perspective. Create photo of me in a dramatic cyberpunk aesthetic standing in the center of a massive neon-lit junkyard at dusk. The camera angle is from above looking down at me with wide angle distortion. I''m looking directly at the camera with an intense, confident expression. My skin should have a cool-toned blue and purple lighting cast on it from the surrounding neon signs.If subject is male: I''m wearing a black t-shirt and black slacks with black shoes, standing confidently with natural masculine styling.If subject is female: I''m wearing a black leather crop top or fitted black tank top with black mini skirt or black shorts, black heels or boots, and a black choker necklace. My makeup features dramatic eyelashes and dark lipstick with cool-toned contouring that complements the neon lighting. My hair is styled sleek and edgy.I''m surrounded by scattered vintage electronics, old TVs, computer monitors, arcade machines, and retro tech debris covering the ground. The background features towering neon signs in hot pink, electric blue, and red. The sky behind should have a pink and purple gradient sunset glow. The atmosphere is moody, cyberpunk, and post-apocalyptic. Don''t change my facial features or hair color.","image_input":"{{files*}}","aspect_ratio":"{{aspect}}","output_format":"jpg"}'
WHERE id = 'old-dystopian-trash-photoshoot';

UPDATE templates SET
  fields_json = '[{"key":"files","type":"file","label":"Reference photos","required":true,"multiple":true,"max":4,"accept":"image/*","help":"Up to 4 reference photos for better likeness"}]',
  input_json  = '{"prompt":"Wide angle camera perspective. Create photo of me in a dramatic cyberpunk aesthetic standing in the center of a massive neon-lit junkyard at dusk. I''m wearing my outfit with black knee platform goth newrocks boots, and a black choker necklace with spikes. long hair. The background features towering neon signs in hot pink, electric blue, and red. The sky behind should have a pink and purple gradient sunset glow. The atmosphere is moody, cyberpunk, and post-apocalyptic. Don''t change my facial features or hair color.","image_input":"{{files*}}","aspect_ratio":"{{aspect}}","output_format":"jpg"}'
WHERE id = 'old-wasteland-vibes';

UPDATE templates SET
  fields_json = '[{"key":"files","type":"file","label":"Reference photos","required":true,"multiple":true,"max":4,"accept":"image/*","help":"Up to 4 reference photos for better likeness"}]',
  input_json  = '{"prompt":"Realistic live sports broadcast screenshot, Korean baseball stadium crowd cam, candid audience reaction shot. A beautiful woman sitting in stadium seats during a live KBO game, long voluminous loose hair, soft glam makeup, neutral expression, eyes focused toward the field. Broadcast telephoto lens compression (120-200mm), shallow depth of field, realistic arena lighting, slight digital noise. Don''t change my facial features or hair color.","image_input":"{{files*}}","aspect_ratio":"{{aspect}}","output_format":"jpg"}'
WHERE id = 'old-korean-baseball-trend';

UPDATE templates SET
  fields_json = '[{"key":"files","type":"file","label":"Reference photos","required":true,"multiple":true,"max":4,"accept":"image/*","help":"Up to 4 reference photos for better likeness"}]',
  input_json  = '{"prompt":"Ultra-realistic live Korean basketball broadcast screenshot, candid courtside audience reaction shot. A stylish young woman sits courtside casually watching the game. Long dark hair with soft natural movement, subtle glam makeup, neutral expression, eyes focused toward the court. Wearing a black leather jacket layered over a dark top. Authentic Korean sports broadcast realism with telephoto sports lens compression (120-200mm), shallow depth of field. Don''t change my facial features or hair color.","image_input":"{{files*}}","aspect_ratio":"{{aspect}}","output_format":"jpg"}'
WHERE id = 'old-courtside-basketball';

UPDATE templates SET
  fields_json = '[{"key":"files","type":"file","label":"Reference photos","required":true,"multiple":true,"max":4,"accept":"image/*","help":"Up to 4 reference photos for better likeness"}]',
  input_json  = '{"prompt":"Ultra-realistic KBL basketball broadcast candid, 200mm telephoto sports lens compression. An unintentional live-TV crowd-cam reaction shot featuring a stylish person sitting courtside. Documentary realism aesthetic with natural skin texture, faint sensor noise, rolling LED flicker, subtle compression artifacts, and authentic Korean sports broadcast styling. Don''t change my facial features.","image_input":"{{files*}}","aspect_ratio":"{{aspect}}","output_format":"jpg"}'
WHERE id = 'old-courtside-basketball-76';

-- ── nano-banana-pro (Imagen 3 Pro) family ──────────────────────────────────────

UPDATE templates SET
  fields_json = '[{"key":"files","type":"file","label":"Reference photos","required":true,"multiple":true,"max":4,"accept":"image/*","help":"Up to 4 reference photos for better likeness"}]',
  input_json  = '{"prompt":"Camera angle from above looking down, semi Birds Eye shot zoomed out showing the full scene. Inspired by Pulp fiction iconic movie scene. Generate a dreamy 90s style portrait of me laying on a light red bed with a subtle striping texture, photographed in a sultry pulp-inspired setting. If subject is female: My feet are elevated in glossy black patent leather heels. I have a sharp black bob haircut with micro bangs, thin eyebrows, long dramatic eyelashes, and glossy red lipstick. If subject is male: I''m wearing a fitted black t-shirt and black slacks. The camera perspective uses a fisheye lens. The lighting is dim, moody, and cinematic. Don''t change my facial features or hair color.","image_input":"{{files*}}","aspect_ratio":"{{aspect}}","output_format":"jpg"}'
WHERE id = 'old-90-s-pulp-vibe';

UPDATE templates SET
  fields_json = '[{"key":"prompt","type":"textarea","label":"Additional details","required":true,"placeholder":"e.g. wearing a red dress, outdoor setting"},{"key":"files","type":"file","label":"Reference photos","required":true,"multiple":true,"max":4,"accept":"image/*","help":"Up to 4 reference photos for better likeness"}]',
  input_json  = '{"prompt":"{{prompt*}}","resolution":"2K","image_input":"{{files*}}","aspect_ratio":"{{aspect}}","output_format":"jpg"}'
WHERE id = 'old-nano-banana-multi-pro';

-- ── seedream-4.5 ───────────────────────────────────────────────────────────────

UPDATE templates SET
  fields_json = '[{"key":"prompt","type":"textarea","label":"Describe the result","required":true,"placeholder":"e.g. photorealistic portrait, cinematic lighting"},{"key":"files","type":"file","label":"Reference images","required":true,"multiple":true,"max":4,"accept":"image/*","help":"Up to 4 reference images"}]',
  input_json  = '{"prompt":"{{prompt*}}","max_images":1,"image_input":"{{files*}}","aspect_ratio":"{{aspect}}","sequential_image_generation":"disabled"}'
WHERE id = 'old-seed-dream-4-5';

-- ── gpt-image-2 family ─────────────────────────────────────────────────────────

UPDATE templates SET
  fields_json = '[{"key":"files","type":"file","label":"Reference photos","required":true,"multiple":true,"max":4,"accept":"image/*","help":"Up to 4 reference photos for better likeness"}]',
  input_json  = '{"prompt":"Ultra-realistic broadcast-style Formula 1 paddock reaction shot during a Monaco race weekend. An adult woman with a fictional identity sits inside a red racing team garage wearing oversized red pit crew radio headphones with an attached boom mic. She has long voluminous blonde hair with natural movement, realistic skin texture, soft glam makeup, glossy neutral lips, and a slightly tired, emotionally detached expression. Candid crowd-cam framing, natural garage lighting, shallow depth of field, documentary realism, high-detail live sports broadcast aesthetic.","quality":"auto","background":"auto","moderation":"auto","aspect_ratio":"{{aspect}}","input_images":"{{files*}}","output_format":"webp","number_of_images":1,"output_compression":90}'
WHERE id = 'old-f1-racing-trend';

UPDATE templates SET
  fields_json = '[{"key":"files","type":"file","label":"Reference photos","required":true,"multiple":true,"max":4,"accept":"image/*","help":"Up to 4 reference photos for better likeness"}]',
  input_json  = '{"prompt":"Ultra-realistic live basketball broadcast screenshot, candid courtside audience reaction shot during a packed KBL playoff game. A stylish young woman sits courtside casually watching the game, unintentionally captured by the arena broadcast camera during a timeout. Long dark hair with soft natural movement, subtle glam makeup, neutral expression, eyes focused toward the court instead of the camera. Authentic Korean sports broadcast realism, telephoto sports lens compression (120-200mm), shallow depth of field, realistic indoor arena lighting.","quality":"auto","background":"auto","moderation":"auto","aspect_ratio":"{{aspect}}","input_images":"{{files*}}","output_format":"webp","number_of_images":1,"output_compression":90}'
WHERE id = 'old-basketball-courtside-trend';

-- ── face-swap: was broken (same file used for both inputs) ─────────────────────

UPDATE templates SET
  fields_json = '[{"key":"target_image","type":"file","label":"Target scene","required":true,"accept":"image/*","help":"The image you want a face placed into"},{"key":"character_image","type":"file","label":"Face source","required":true,"accept":"image/*","help":"Photo with the face to swap in"}]',
  input_json  = '{"cleanup":false,"target_image":"{{target_image*}}","character_image":"{{character_image*}}"}'
WHERE id = 'old-face-swap';
