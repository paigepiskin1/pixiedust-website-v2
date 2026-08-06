-- Seedream 4.5 photoshoot template (BytePlus ModelArk via SyncNode /byteplus/image).
-- Display name: ByteDance Seedream 4.5. Multi-reference (up to 9 image/video/audio),
-- 2K/4K size, optional ratios, no watermark, 4 credits.
-- Idempotent upsert.

INSERT OR REPLACE INTO templates (
  id, title, kind, type, category, provider, model,
  input_json, fields_json, steps_json,
  credit_cost, quality_json, aspects_json, quantities_json,
  engine, eta, tags_json, tone, accent, meta,
  subtitle, description, preview_image, preview_video,
  is_featured, is_hidden, is_admin_only, sort_order, updated_at
) VALUES (
  'seedream-4-5',
  'Seedream 4.5',
  'shoot',
  'image',
  'Photoshoots',
  'byteplus',
  'seedream-4-5-251128',
  '{"prompt":"{{prompt}}","image":"{{files*}}","size":"2K","aspect_ratio":"{{aspect}}","response_format":"url","watermark":false}',
  '[{"key":"files","type":"file","label":"Reference files","required":true,"multiple":true,"max":9,"accept":"image/*,video/*,audio/*","labeled":true,"help":"Up to 9 references (images, video, or audio). Each gets a label — click to rename, then @tag it in the prompt."},{"key":"prompt","type":"textarea","label":"Prompt","required":true,"mentionFrom":"files","placeholder":"e.g. Use @Image1 as the person. Use @Image2 as the pajama outfit. Keep face and pose from @Image1.","help":"Type @ to mention a reference, or tap the chips under your uploads."}]',
  NULL,
  4,
  '{"2K":1,"4K":1}',
  '["match","1:1","16:9","9:16","4:3","3:4","3:2","2:3","21:9"]',
  '[1]',
  'Seedream 4.5',
  '~1–2 min',
  '["seedream","photoshoot","edit","multi-reference","byteplus"]',
  'teal',
  NULL,
  '{"kicker":"Photoshoot · Seedream 4.5","howItWorks":["Upload up to 9 image, video, or audio references","@tag each file in your prompt","Pick 2K or 4K and an optional ratio","Generate with ByteDance Seedream 4.5"]}',
  'Multi-reference image edit',
  'ByteDance Seedream 4.5 — reliable image editing and multi-reference fusion at 2K or 4K. Upload up to 9 image, video, or audio references.',
  NULL,
  NULL,
  0,
  0,
  0,
  1,
  datetime('now')
);
