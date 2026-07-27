-- With Friends: 10 duo photoshoot templates (You + Friend square uploads).

INSERT INTO templates (
  id, title, kind, type, category, provider, model,
  input_json, fields_json, credit_cost, quality_json, aspects_json, quantities_json,
  eta, tags_json, tone, accent, subtitle, description, preview_image, meta,
  is_featured, is_hidden, is_admin_only, is_adult, sort_order, updated_at
) VALUES
(
  'friends-concert-selfie',
  'Concert Besties',
  'shoot', 'image', 'With Friends', 'replicate', 'openai/gpt-image-2',
  '{"prompt":"Generate a cute candid selfie of me and my friend at a packed outdoor concert at night. Use the first reference photo as me (main character) and the second reference photo as my friend. Keep both facial identities sharp and distinct — do not blend faces or swap who is who. Ultra-wide front-camera selfie, arms extended, both of us squeezed into frame smiling, colorful stage lights and bokeh behind us, crowd silhouettes, slight motion blur on lights, natural skin texture, authentic phone selfie energy, no text overlays.","quality":"auto","background":"auto","moderation":"low","aspect_ratio":"{{aspect}}","input_images":["{{person}}","{{friend}}"],"output_format":"webp","number_of_images":1,"output_compression":90}',
  '[{"key":"person","type":"file","label":"You","required":true,"accept":"image/*","ui":"square","help":"Main character — one clear face photo"},{"key":"friend","type":"file","label":"Friend","required":true,"accept":"image/*","ui":"square","help":"Friend — one clear face photo"}]',
  5, NULL, '["match","1:1","2:3","3:2"]', '[1,2,4]',
  '~2 min', '["friends","concert","selfie","night","duo"]', 'lilac', 'var(--pd-lilac)',
  'With Friends · concert selfie',
  'Cute duo selfie at a live concert — stage lights, crowd energy, both faces sharp.',
  NULL,
  '{"kicker":"Photoshoot · Concert Besties","howItWorks":["Upload one photo of you and one of your friend","We place both of you in the scene together","Pick a ratio and generate"]}',
  1, 0, 0, 0, 40, datetime('now')
),
(
  'friends-baseball-game',
  'Baseball Game Duo',
  'shoot', 'image', 'With Friends', 'replicate', 'openai/gpt-image-2',
  '{"prompt":"Generate a candid digital-camera photo of me and my friend at a baseball game. Use the first reference photo as me (main character) and the second reference photo as my friend. Keep both facial identities sharp and distinct — do not blend faces or swap who is who. Shot from a few steps away (not a close selfie) — both standing in the stadium seats, sunny afternoon, field and crowd soft in the background, slightly grainy early-2000s digicam look, on-camera flash optional, natural skin texture, authentic snapshot, no text overlays.","quality":"auto","background":"auto","moderation":"low","aspect_ratio":"{{aspect}}","input_images":["{{person}}","{{friend}}"],"output_format":"webp","number_of_images":1,"output_compression":90}',
  '[{"key":"person","type":"file","label":"You","required":true,"accept":"image/*","ui":"square","help":"Main character — one clear face photo"},{"key":"friend","type":"file","label":"Friend","required":true,"accept":"image/*","ui":"square","help":"Friend — one clear face photo"}]',
  5, NULL, '["match","1:1","2:3","3:2"]', '[1,2,4]',
  '~2 min', '["friends","baseball","stadium","digicam","duo"]', 'amber', 'var(--pd-amber)',
  'With Friends · stadium digicam',
  'Two friends at a baseball game — digicam snapshot from a short distance in the stands.',
  NULL,
  '{"kicker":"Photoshoot · Baseball Game Duo","howItWorks":["Upload one photo of you and one of your friend","We place both of you in the scene together","Pick a ratio and generate"]}',
  1, 0, 0, 0, 41, datetime('now')
),
(
  'friends-car-passenger-wide',
  'Car Passenger Wide',
  'shoot', 'image', 'With Friends', 'replicate', 'openai/gpt-image-2',
  '{"prompt":"Generate an ultra-wide front-camera selfie of me riding passenger while my friend drives. Use the first reference photo as me (main character) and the second reference photo as my friend. Keep both facial identities sharp and distinct — do not blend faces or swap who is who. Me in the passenger seat holding the phone, friend behind the wheel looking over, dashboard and windshield visible, sunny day road light, slight wide-angle distortion, candid car-ride energy, sharp facial likeness for both, natural skin texture, no text overlays.","quality":"auto","background":"auto","moderation":"low","aspect_ratio":"{{aspect}}","input_images":["{{person}}","{{friend}}"],"output_format":"webp","number_of_images":1,"output_compression":90}',
  '[{"key":"person","type":"file","label":"You","required":true,"accept":"image/*","ui":"square","help":"Main character — one clear face photo"},{"key":"friend","type":"file","label":"Friend","required":true,"accept":"image/*","ui":"square","help":"Friend — one clear face photo"}]',
  5, NULL, '["match","1:1","2:3","3:2"]', '[1,2,4]',
  '~2 min', '["friends","car","passenger","wide","selfie","duo"]', 'mint', 'var(--pd-mint)',
  'With Friends · wide car selfie',
  'Wide-angle passenger selfie — friend driving, me in passenger seat.',
  NULL,
  '{"kicker":"Photoshoot · Car Passenger Wide","howItWorks":["Upload one photo of you and one of your friend","We place both of you in the scene together","Pick a ratio and generate"]}',
  1, 0, 0, 0, 42, datetime('now')
),
(
  'friends-car-overhead',
  'Car Overhead Duo',
  'shoot', 'image', 'With Friends', 'replicate', 'openai/gpt-image-2',
  '{"prompt":"Generate an overhead high-angle car selfie of me and my friend in the front seats. Use the first reference photo as me (main character) and the second reference photo as my friend. Keep both facial identities sharp and distinct — do not blend faces or swap who is who. Phone held above us looking straight down, both faces looking up at the camera, steering wheel and lap area visible, soft daylight through the windshield, playful candid duo shot, sharp facial likeness for both, natural skin texture, no text overlays.","quality":"auto","background":"auto","moderation":"low","aspect_ratio":"{{aspect}}","input_images":["{{person}}","{{friend}}"],"output_format":"webp","number_of_images":1,"output_compression":90}',
  '[{"key":"person","type":"file","label":"You","required":true,"accept":"image/*","ui":"square","help":"Main character — one clear face photo"},{"key":"friend","type":"file","label":"Friend","required":true,"accept":"image/*","ui":"square","help":"Friend — one clear face photo"}]',
  5, NULL, '["match","1:1","2:3","3:2"]', '[1,2,4]',
  '~2 min', '["friends","car","overhead","selfie","duo"]', 'teal', 'var(--pd-teal)',
  'With Friends · overhead car selfie',
  'Phone held overhead looking down at both of us in the front seats.',
  NULL,
  '{"kicker":"Photoshoot · Car Overhead Duo","howItWorks":["Upload one photo of you and one of your friend","We place both of you in the scene together","Pick a ratio and generate"]}',
  1, 0, 0, 0, 43, datetime('now')
),
(
  'friends-cafe-coffee',
  'Café Coffee Duo',
  'shoot', 'image', 'With Friends', 'replicate', 'openai/gpt-image-2',
  '{"prompt":"Generate a cute café selfie of me and my friend getting coffee together. Use the first reference photo as me (main character) and the second reference photo as my friend. Keep both facial identities sharp and distinct — do not blend faces or swap who is who. Sitting side by side at a small café table, iced coffees or lattes in frame, warm interior light, soft bokeh, cozy weekend energy, sharp facial likeness for both, natural skin texture, authentic phone selfie, no text overlays.","quality":"auto","background":"auto","moderation":"low","aspect_ratio":"{{aspect}}","input_images":["{{person}}","{{friend}}"],"output_format":"webp","number_of_images":1,"output_compression":90}',
  '[{"key":"person","type":"file","label":"You","required":true,"accept":"image/*","ui":"square","help":"Main character — one clear face photo"},{"key":"friend","type":"file","label":"Friend","required":true,"accept":"image/*","ui":"square","help":"Friend — one clear face photo"}]',
  5, NULL, '["match","1:1","2:3","3:2"]', '[1,2,4]',
  '~2 min', '["friends","cafe","coffee","selfie","duo"]', 'amber', 'var(--pd-amber)',
  'With Friends · café selfie',
  'Cute café selfie with coffee cups — cozy table vibes.',
  NULL,
  '{"kicker":"Photoshoot · Café Coffee Duo","howItWorks":["Upload one photo of you and one of your friend","We place both of you in the scene together","Pick a ratio and generate"]}',
  1, 0, 0, 0, 44, datetime('now')
),
(
  'friends-pilates-cafe',
  'Pilates Café Duo',
  'shoot', 'image', 'With Friends', 'replicate', 'openai/gpt-image-2',
  '{"prompt":"Generate a trendy café photo of me and my friend right after pilates. Use the first reference photo as me (main character) and the second reference photo as my friend. Keep both facial identities sharp and distinct — do not blend faces or swap who is who. Both wearing cute matching-energy pink athleisure — pink tank tops or wrap tops with coordinating pink or blush leggings, sitting at a bright café with drinks, soft natural window light, polished influencer look, sharp facial likeness for both, natural skin texture, no text overlays.","quality":"auto","background":"auto","moderation":"low","aspect_ratio":"{{aspect}}","input_images":["{{person}}","{{friend}}"],"output_format":"webp","number_of_images":1,"output_compression":90}',
  '[{"key":"person","type":"file","label":"You","required":true,"accept":"image/*","ui":"square","help":"Main character — one clear face photo"},{"key":"friend","type":"file","label":"Friend","required":true,"accept":"image/*","ui":"square","help":"Friend — one clear face photo"}]',
  5, NULL, '["match","1:1","2:3","3:2"]', '[1,2,4]',
  '~2 min', '["friends","pilates","cafe","pink","athleisure","duo"]', 'pink', 'var(--pd-pink)',
  'With Friends · pink athleisure',
  'Post-pilates café photo in matching cute pink tanks, wrap tops, and leggings.',
  NULL,
  '{"kicker":"Photoshoot · Pilates Café Duo","howItWorks":["Upload one photo of you and one of your friend","We place both of you in the scene together","Pick a ratio and generate"]}',
  1, 0, 0, 0, 45, datetime('now')
),
(
  'friends-digicam-street',
  'Street Digicam Duo',
  'shoot', 'image', 'With Friends', 'replicate', 'openai/gpt-image-2',
  '{"prompt":"Generate a candid early-2000s digital-camera photo of me and my friend standing together on a city sidewalk. Use the first reference photo as me (main character) and the second reference photo as my friend. Keep both facial identities sharp and distinct — do not blend faces or swap who is who. Photographed from a short distance (full upper-body / standing), not a close selfie — both posing casually side by side, daytime street, slight digicam grain and color cast, natural skin texture, authentic snapshot energy, no text overlays.","quality":"auto","background":"auto","moderation":"low","aspect_ratio":"{{aspect}}","input_images":["{{person}}","{{friend}}"],"output_format":"webp","number_of_images":1,"output_compression":90}',
  '[{"key":"person","type":"file","label":"You","required":true,"accept":"image/*","ui":"square","help":"Main character — one clear face photo"},{"key":"friend","type":"file","label":"Friend","required":true,"accept":"image/*","ui":"square","help":"Friend — one clear face photo"}]',
  5, NULL, '["match","1:1","2:3","3:2"]', '[1,2,4]',
  '~2 min', '["friends","digicam","street","standing","duo"]', 'noir', 'var(--pd-ink)',
  'With Friends · standing distance',
  'Digital-camera photo of two friends standing together on a city street from a short distance.',
  NULL,
  '{"kicker":"Photoshoot · Street Digicam Duo","howItWorks":["Upload one photo of you and one of your friend","We place both of you in the scene together","Pick a ratio and generate"]}',
  1, 0, 0, 0, 46, datetime('now')
),
(
  'friends-night-out-flash',
  'Night Out Flash',
  'shoot', 'image', 'With Friends', 'replicate', 'openai/gpt-image-2',
  '{"prompt":"Generate a night-out digital-camera flash photo of me and my friend. Use the first reference photo as me (main character) and the second reference photo as my friend. Keep both facial identities sharp and distinct — do not blend faces or swap who is who. Standing together on a city sidewalk at night, dressed up, harsh on-camera flash, dark background with street lights, slight grain, candid party energy, sharp facial likeness for both, natural skin texture, no text overlays.","quality":"auto","background":"auto","moderation":"low","aspect_ratio":"{{aspect}}","input_images":["{{person}}","{{friend}}"],"output_format":"webp","number_of_images":1,"output_compression":90}',
  '[{"key":"person","type":"file","label":"You","required":true,"accept":"image/*","ui":"square","help":"Main character — one clear face photo"},{"key":"friend","type":"file","label":"Friend","required":true,"accept":"image/*","ui":"square","help":"Friend — one clear face photo"}]',
  5, NULL, '["match","1:1","2:3","3:2"]', '[1,2,4]',
  '~2 min', '["friends","night","flash","digicam","duo"]', 'dusk', 'var(--pd-lilac)',
  'With Friends · digicam flash',
  'Night-out digicam flash photo of two friends dressed up on the sidewalk.',
  NULL,
  '{"kicker":"Photoshoot · Night Out Flash","howItWorks":["Upload one photo of you and one of your friend","We place both of you in the scene together","Pick a ratio and generate"]}',
  1, 0, 0, 0, 47, datetime('now')
),
(
  'friends-mirror-bathroom',
  'Bathroom Mirror Duo',
  'shoot', 'image', 'With Friends', 'replicate', 'openai/gpt-image-2',
  '{"prompt":"Generate a classic bathroom mirror selfie of me and my friend. Use the first reference photo as me (main character) and the second reference photo as my friend. Keep both facial identities sharp and distinct — do not blend faces or swap who is who. Standing in front of a bathroom mirror holding the phone, tiled walls, soft flash, cute matching energy, both faces clearly visible in the reflection, candid duo vibe, sharp facial likeness for both, natural skin texture, no text overlays.","quality":"auto","background":"auto","moderation":"low","aspect_ratio":"{{aspect}}","input_images":["{{person}}","{{friend}}"],"output_format":"webp","number_of_images":1,"output_compression":90}',
  '[{"key":"person","type":"file","label":"You","required":true,"accept":"image/*","ui":"square","help":"Main character — one clear face photo"},{"key":"friend","type":"file","label":"Friend","required":true,"accept":"image/*","ui":"square","help":"Friend — one clear face photo"}]',
  5, NULL, '["match","1:1","2:3","3:2"]', '[1,2,4]',
  '~2 min', '["friends","mirror","bathroom","selfie","duo"]', 'pink', 'var(--pd-pink)',
  'With Friends · mirror selfie',
  'Classic bathroom mirror selfie with a friend — tiled walls, flash.',
  NULL,
  '{"kicker":"Photoshoot · Bathroom Mirror Duo","howItWorks":["Upload one photo of you and one of your friend","We place both of you in the scene together","Pick a ratio and generate"]}',
  1, 0, 0, 0, 48, datetime('now')
),
(
  'friends-mall-digicam',
  'Mall Digicam Duo',
  'shoot', 'image', 'With Friends', 'replicate', 'openai/gpt-image-2',
  '{"prompt":"Generate a candid digital-camera photo of me and my friend standing together at a bright shopping mall. Use the first reference photo as me (main character) and the second reference photo as my friend. Keep both facial identities sharp and distinct — do not blend faces or swap who is who. Shot from a few steps away (standing distance, not a tight selfie), both posing casually near storefronts or an escalator, fluorescent mall lighting, slight digicam compression and grain, authentic Y2K snapshot energy, sharp facial likeness for both, natural skin texture, no text overlays.","quality":"auto","background":"auto","moderation":"low","aspect_ratio":"{{aspect}}","input_images":["{{person}}","{{friend}}"],"output_format":"webp","number_of_images":1,"output_compression":90}',
  '[{"key":"person","type":"file","label":"You","required":true,"accept":"image/*","ui":"square","help":"Main character — one clear face photo"},{"key":"friend","type":"file","label":"Friend","required":true,"accept":"image/*","ui":"square","help":"Friend — one clear face photo"}]',
  5, NULL, '["match","1:1","2:3","3:2"]', '[1,2,4]',
  '~2 min', '["friends","mall","digicam","standing","duo"]', 'lilac', 'var(--pd-lilac)',
  'With Friends · standing mall snap',
  'Standing-distance digicam photo of two friends at the mall.',
  NULL,
  '{"kicker":"Photoshoot · Mall Digicam Duo","howItWorks":["Upload one photo of you and one of your friend","We place both of you in the scene together","Pick a ratio and generate"]}',
  1, 0, 0, 0, 49, datetime('now')
)
ON CONFLICT(id) DO UPDATE SET
  title=excluded.title,
  kind=excluded.kind,
  type=excluded.type,
  category=excluded.category,
  provider=excluded.provider,
  model=excluded.model,
  input_json=excluded.input_json,
  fields_json=excluded.fields_json,
  credit_cost=excluded.credit_cost,
  quality_json=excluded.quality_json,
  aspects_json=excluded.aspects_json,
  quantities_json=excluded.quantities_json,
  eta=excluded.eta,
  tags_json=excluded.tags_json,
  tone=excluded.tone,
  accent=excluded.accent,
  subtitle=excluded.subtitle,
  description=excluded.description,
  preview_image=COALESCE(templates.preview_image, excluded.preview_image),
  meta=excluded.meta,
  is_featured=excluded.is_featured,
  is_hidden=excluded.is_hidden,
  is_admin_only=excluded.is_admin_only,
  is_adult=excluded.is_adult,
  sort_order=excluded.sort_order,
  updated_at=excluded.updated_at;

-- Preview covers generated from provided model refs
UPDATE templates SET preview_image = 'https://pixiecdn.b-cdn.net/gen_d80b0323-9f76-44ee-bb08-a6aed948e196_1785179238245.png', updated_at = datetime('now') WHERE id = 'friends-concert-selfie';
UPDATE templates SET preview_image = 'https://pixiecdn.b-cdn.net/gen_d80b0323-9f76-44ee-bb08-a6aed948e196_1785177668532.png', updated_at = datetime('now') WHERE id = 'friends-baseball-game';
UPDATE templates SET preview_image = 'https://pixiecdn.b-cdn.net/gen_d80b0323-9f76-44ee-bb08-a6aed948e196_1785178645469.png', updated_at = datetime('now') WHERE id = 'friends-car-passenger-wide';
UPDATE templates SET preview_image = 'https://pixiecdn.b-cdn.net/gen_d80b0323-9f76-44ee-bb08-a6aed948e196_1785178783114.png', updated_at = datetime('now') WHERE id = 'friends-car-overhead';
UPDATE templates SET preview_image = 'https://pixiecdn.b-cdn.net/gen_d80b0323-9f76-44ee-bb08-a6aed948e196_1785177958715.png', updated_at = datetime('now') WHERE id = 'friends-cafe-coffee';
UPDATE templates SET preview_image = 'https://pixiecdn.b-cdn.net/gen_d80b0323-9f76-44ee-bb08-a6aed948e196_1785178842295.png', updated_at = datetime('now') WHERE id = 'friends-pilates-cafe';
UPDATE templates SET preview_image = 'https://pixiecdn.b-cdn.net/gen_d80b0323-9f76-44ee-bb08-a6aed948e196_1785178896420.png', updated_at = datetime('now') WHERE id = 'friends-digicam-street';
UPDATE templates SET preview_image = 'https://pixiecdn.b-cdn.net/gen_d80b0323-9f76-44ee-bb08-a6aed948e196_1785178153689.png', updated_at = datetime('now') WHERE id = 'friends-night-out-flash';
UPDATE templates SET preview_image = 'https://pixiecdn.b-cdn.net/gen_d80b0323-9f76-44ee-bb08-a6aed948e196_1785178994022.png', updated_at = datetime('now') WHERE id = 'friends-mirror-bathroom';
UPDATE templates SET preview_image = 'https://pixiecdn.b-cdn.net/gen_d80b0323-9f76-44ee-bb08-a6aed948e196_1785179116193.png', updated_at = datetime('now') WHERE id = 'friends-mall-digicam';
