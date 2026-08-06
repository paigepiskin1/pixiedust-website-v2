-- Seedance 2.0 multimodal video template (BytePlus ModelArk via SyncNode /byteplus/generate).
-- Duplicate of byteplus-seedance-i2v with optional multi-reference (up to 9 image/video/audio).
-- content[] is rebuilt at generate time when meta.multimodal is true.
-- Idempotent upsert.

INSERT OR REPLACE INTO templates (
  id, title, kind, type, category, provider, model,
  input_json, fields_json, steps_json,
  credit_cost, quality_json, aspects_json, quantities_json, durations_json,
  engine, eta, tags_json, tone, accent, meta,
  subtitle, description, preview_image, preview_video,
  is_featured, is_hidden, is_admin_only, sort_order, updated_at
) VALUES (
  'byteplus-seedance-multimodal',
  'Seedance 2.0 — Multimodal Video (BytePlus)',
  'i2v',
  'video',
  'Image to video',
  'byteplus',
  'dreamina-seedance-2-0-260128',
  '{"content":[{"type":"text","text":"{{prompt}}"}],"ratio":"16:9","duration":5,"resolution":"720p","generate_audio":true,"watermark":false}',
  '[{"key":"files","type":"file","label":"Reference files","required":false,"multiple":true,"max":9,"accept":"image/*,video/*,audio/*","labeled":true,"help":"Optional — up to 9 refs (images, video, or audio). Each gets a label — click to rename, then @tag it in the prompt."},{"key":"prompt","type":"textarea","label":"Prompt","required":true,"mentionFrom":"files","placeholder":"e.g. Use @Image1 as the person. Match the camera move from @Video1. Keep the vibe of @Audio1.","help":"Type @ to mention a reference, or tap the chips under your uploads. Works with prompt alone (text-to-video) or with refs."}]',
  NULL,
  20,
  NULL,
  '["16:9","9:16","1:1"]',
  NULL,
  '[5,10]',
  NULL,
  '~1-3 min',
  '["video","multimodal","seedance","image-to-video","reference"]',
  'dusk',
  NULL,
  '{"assetLibrary":true,"multimodal":true,"kicker":"Multimodal video · Seedance 2.0","howItWorks":["Optionally upload up to 9 image, video, or audio references","@tag each file in your prompt (or describe a scene with text only)","Pick aspect ratio and duration, then generate"],"hideSwitch":false}',
  'Text + up to 9 image, video, or audio refs → video.',
  'Seedance 2.0 multimodal — generate video from a prompt with optional image, video, and audio references (up to 9). Real-person photos work via the BytePlus asset library.',
  NULL,
  'https://pixiecdn.b-cdn.net/gen_d80b0323-9f76-44ee-bb08-a6aed948e196_1784230538114.mp4',
  0,
  0,
  0,
  0,
  datetime('now')
);
