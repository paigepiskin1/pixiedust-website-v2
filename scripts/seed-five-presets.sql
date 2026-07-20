-- Five consumer presets: Polaroid, Kodak Gold, VHS, Cinestill Night, Contax Soft.
-- Idempotent upserts (safe to re-run).

INSERT INTO templates (
  id, title, kind, type, category, provider, model,
  input_json, fields_json, credit_cost, quality_json, aspects_json, quantities_json,
  eta, tags_json, tone, accent, subtitle, description, preview_image,
  is_featured, is_hidden, is_admin_only, is_adult, sort_order, updated_at
) VALUES
(
  'polaroid-instant',
  'Polaroid Instant',
  'preset', 'image', 'Cameras', 'replicate', 'google/nano-banana-pro',
  '{"prompt":"reprocess this photo to look like a Polaroid Instant print — faded pastel colors, soft on-camera flash, creamy highlights, slight warm vignette, instant-film color cast. Do not change the faces, people, or pose.","image_input":"{{files*}}","aspect_ratio":"{{aspect}}","output_format":"jpg"}',
  '[{"key":"files","type":"file","label":"Reference photos","required":true,"multiple":true,"max":4,"accept":"image/*","help":"Up to 4 reference photos for better likeness"}]',
  5, '{"std":1,"pro":1.5,"cinema":2.5}', '["original","1:1","4:5","16:9","9:16"]', '[1,2,4]',
  '~15s', '["film","camera","polaroid","instant"]', 'amber', 'var(--pd-amber)',
  'Faded pastels · soft flash',
  'Instant-film vibe — creamy flash, pastel fade, and that classic Polaroid color cast.',
  'https://pixiecdn.b-cdn.net/media/templates/thumbnails/preset-polaroid-instant.jpg',
  1, 0, 0, 0, 6, datetime('now')
),
(
  'kodak-gold',
  'Kodak Gold',
  'preset', 'image', 'Film', 'replicate', 'google/nano-banana-pro',
  '{"prompt":"reprocess this photo as Kodak Gold 200 film — warm honey tones, sunny contrast, fine grain, slightly lifted shadows, nostalgic 90s vacation look. Do not change the faces, people, or pose.","image_input":"{{files*}}","aspect_ratio":"{{aspect}}","output_format":"jpg"}',
  '[{"key":"files","type":"file","label":"Reference photos","required":true,"multiple":true,"max":4,"accept":"image/*","help":"Up to 4 reference photos for better likeness"}]',
  5, '{"std":1,"pro":1.5,"cinema":2.5}', '["original","1:1","4:5","16:9","9:16"]', '[1,2,4]',
  '~15s', '["film","kodak","warm","90s"]', 'dusk', 'var(--pd-amber)',
  'Sunny · honey grain',
  'Warm Kodak Gold 200 grade — honey sunlight, fine grain, and 90s vacation nostalgia.',
  'https://pixiecdn.b-cdn.net/media/templates/thumbnails/preset-kodak-gold.jpg',
  1, 0, 0, 0, 7, datetime('now')
),
(
  'vhs-camcorder',
  'VHS Camcorder',
  'preset', 'image', 'Cameras', 'replicate', 'google/nano-banana-pro',
  '{"prompt":"reprocess this photo as a late-90s VHS camcorder frame — soft tracking lines, color bleed, muted contrast, interlaced softness, home-video nostalgia. Do not change the faces, people, or pose.","image_input":"{{files*}}","aspect_ratio":"{{aspect}}","output_format":"jpg"}',
  '[{"key":"files","type":"file","label":"Reference photos","required":true,"multiple":true,"max":4,"accept":"image/*","help":"Up to 4 reference photos for better likeness"}]',
  5, '{"std":1,"pro":1.5,"cinema":2.5}', '["original","1:1","4:5","16:9","9:16"]', '[1,2,4]',
  '~15s', '["vhs","camcorder","retro","lofi"]', 'teal', 'var(--pd-mint)',
  'Tracking lines · color bleed',
  'Late-90s home-video energy — soft tracking, color bleed, and camcorder softness.',
  'https://pixiecdn.b-cdn.net/media/templates/thumbnails/preset-vhs-camcorder.jpg',
  1, 0, 0, 0, 8, datetime('now')
),
(
  'cinestill-night',
  'Cinestill Night',
  'preset', 'image', 'Film', 'replicate', 'google/nano-banana-pro',
  '{"prompt":"reprocess this photo as Cinestill 800T night film — tungsten warmth, glowing highlights, soft red halation around bright lights, cinematic grain. Do not change the faces, people, or pose.","image_input":"{{files*}}","aspect_ratio":"{{aspect}}","output_format":"jpg"}',
  '[{"key":"files","type":"file","label":"Reference photos","required":true,"multiple":true,"max":4,"accept":"image/*","help":"Up to 4 reference photos for better likeness"}]',
  5, '{"std":1,"pro":1.5,"cinema":2.5}', '["original","1:1","4:5","16:9","9:16"]', '[1,2,4]',
  '~15s', '["film","cinestill","night","cinematic"]', 'pink', 'var(--pd-pink)',
  'Tungsten · red halation',
  'Cinestill 800T night look — glowing lights, tungsten warmth, and cinematic halation.',
  'https://pixiecdn.b-cdn.net/media/templates/thumbnails/preset-cinestill-night.jpg',
  1, 0, 0, 0, 9, datetime('now')
),
(
  'contax-soft',
  'Contax Soft',
  'preset', 'image', 'Cameras', 'replicate', 'google/nano-banana-pro',
  '{"prompt":"reprocess this photo as a Contax T2 point-and-shoot — soft flash, creamy skin, gentle blur, subtle green-teal shadows, early-2000s film romance. Do not change the faces, people, or pose.","image_input":"{{files*}}","aspect_ratio":"{{aspect}}","output_format":"jpg"}',
  '[{"key":"files","type":"file","label":"Reference photos","required":true,"multiple":true,"max":4,"accept":"image/*","help":"Up to 4 reference photos for better likeness"}]',
  5, '{"std":1,"pro":1.5,"cinema":2.5}', '["original","1:1","4:5","16:9","9:16"]', '[1,2,4]',
  '~15s', '["film","contax","soft","flash"]', 'mint', 'var(--pd-mint)',
  'Creamy flash · teal shadows',
  'Contax T2 romance — soft flash, creamy skin, and subtle green-teal film shadows.',
  'https://pixiecdn.b-cdn.net/media/templates/thumbnails/preset-contax-soft.jpg',
  1, 0, 0, 0, 10, datetime('now')
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
  preview_image=excluded.preview_image,
  is_featured=excluded.is_featured,
  is_hidden=excluded.is_hidden,
  is_admin_only=excluded.is_admin_only,
  sort_order=excluded.sort_order,
  updated_at=datetime('now');
