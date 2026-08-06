-- Seedream 5.0 Pro photoshoot template (BytePlus ModelArk via SyncNode /byteplus/image).
-- Image edit + multi-reference (up to 10), 1K/2K size, optional ratios, no watermark, 5 credits.
-- Idempotent upsert — live D1 may already have this row from a prior insert.

INSERT OR REPLACE INTO templates (
  id, title, kind, type, category, provider, model,
  input_json, fields_json, steps_json,
  credit_cost, quality_json, aspects_json, quantities_json,
  engine, eta, tags_json, tone, accent, meta,
  subtitle, description, preview_image, preview_video,
  is_featured, is_hidden, is_admin_only, sort_order, updated_at
) VALUES (
  'seedream-5-pro',
  'Seedream 5.0 Pro',
  'shoot',
  'image',
  'Photoshoots',
  'byteplus',
  'dola-seedream-5-0-pro-260628',
  '{"prompt":"{{prompt}}","image":"{{files*}}","size":"2K","aspect_ratio":"{{aspect}}","response_format":"url","watermark":false,"output_format":"jpeg"}',
  '[{"key":"files","type":"file","label":"Reference images","required":true,"multiple":true,"max":10,"accept":"image/*","labeled":true,"help":"1–10 references — each gets an Image label. Click a label to rename, then @tag it in the prompt."},{"key":"prompt","type":"textarea","label":"Prompt","required":true,"mentionFrom":"files","placeholder":"e.g. Use @Image1 as the person. Use @Image2 as the pajama outfit. Keep face and pose from @Image1.","help":"Type @ to mention a reference, or tap the chips under your uploads."}]',
  NULL,
  5,
  '{"2K":1,"1K":1}',
  '["match","1:1","16:9","9:16","4:3","3:4","3:2","2:3","21:9"]',
  '[1]',
  'Seedream 5.0 Pro',
  '~1–2 min',
  '["seedream","photoshoot","edit","multi-reference","byteplus"]',
  'lilac',
  NULL,
  '{"kicker":"Photoshoot · Seedream 5.0 Pro","howItWorks":["Upload 1–10 reference photos","@tag each image in your prompt","Pick 1K or 2K and an optional ratio","Generate with BytePlus Seedream 5.0 Pro"]}',
  'Multi-reference image edit',
  'BytePlus Seedream 5.0 Pro — precision image editing and multi-reference fusion at 1K or 2K. Upload up to 10 references.',
  NULL,
  NULL,
  0,
  0,
  0,
  0,
  datetime('now')
);
