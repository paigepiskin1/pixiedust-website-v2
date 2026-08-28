-- Movie Studio — Seedance omni-reference (BytePlus), id `movie-studio`
--
-- Image→video template that lets users upload up to 8 reference images and tag
-- them in the prompt as @Image1, @Image2, … to control identity, scene, and
-- style. Routes through the `byteplus` provider (SyncNode /byteplus/generate →
-- Ark /contents/generations/tasks). The flat `prompt` + `reference_images`
-- shape below is assembled into Ark's multimodal `content` array (one
-- role:reference_image item per upload, in order) by shapeByteplusInput() in
-- src/lib/syncnode.ts, so @ImageN binds to the Nth uploaded reference.
--
-- INSERT OR REPLACE = idempotent + safe to re-run and to apply over an existing
-- row when re-pricing or tweaking copy.
INSERT OR REPLACE INTO templates (
  id, title, kind, type, category, provider, model,
  input_json, fields_json,
  credit_cost, price_per_second, durations_json, quality_json, aspects_json, quantities_json,
  engine, eta, tags_json, tone, accent, meta, subtitle, description,
  is_featured, is_hidden, is_admin_only, sort_order, updated_at
) VALUES (
  'movie-studio',
  'Movie Studio',
  'i2v',
  'video',
  'Reference',
  'byteplus',
  'dreamina-seedance-2-0-260128',
  '{"prompt":"{{prompt}}","reference_images":"{{references*}}","reference_videos":"{{reference_videos*}}","reference_audios":"{{reference_audios*}}","resolution":"720p","ratio":"16:9","duration":5,"generate_audio":true,"watermark":false}',
  '[{"key":"model_version","type":"select","asModel":true,"label":"Model","default":"dreamina-seedance-2-0-260128","options":[{"value":"dreamina-seedance-2-0-260128","label":"Seedance 2.0"},{"value":"dreamina-seedance-2-5-260628","label":"Seedance 2.5"}],"help":"Seedance 2.5 is newer — it must be activated in your BytePlus Ark Console first."},{"key":"references","type":"file","label":"Reference images","required":true,"multiple":true,"max":9,"registerPortrait":true,"accept":"image/png,image/jpeg,image/webp","help":"Upload image references (Seedance 2.0 allows up to 9, Seedance 2.5 up to 30). They become @Image1, @Image2 … in upload order — tag them in your prompt below."},{"key":"reference_videos","type":"file","label":"Reference videos (optional)","multiple":true,"max":10,"accept":"video/mp4,video/quicktime,video/webm","help":"Optional — upload MP4/MOV clips (roughly 2–30s each). They become @Video1, @Video2 … — tag them to borrow motion, camera moves, or a scene."},{"key":"reference_audios","type":"file","label":"Reference audio (optional)","multiple":true,"max":10,"accept":"audio/mpeg,audio/wav","help":"Optional — upload MP3/WAV clips (roughly 2–30s each). They become @Audio1, @Audio2 … for a voice, music, or ambience. Needs at least one image or video too."},{"key":"prompt","type":"textarea","label":"Prompt","required":true,"mentionSources":[{"key":"references","label":"Image","kind":"image"},{"key":"reference_videos","label":"Video","kind":"video"},{"key":"reference_audios","label":"Audio","kind":"audio"}],"placeholder":"@Image1 as the lead, moving with the energy of @Video1, to the mood of @Audio1. Cinematic, slow dolly-in.","help":"Type @ to insert a reference (@Image1, @Video1, @Audio1 …), then say what each controls — identity, scene, motion, or sound. Order matches your uploads."}]',
  50,
  10,
  '[5,10,15,20,25,30]',
  '{"480p":0.6,"720p":1}',
  '["16:9","9:16","1:1","4:3","3:4","adaptive"]',
  '[1,2]',
  'Seedance 2.0',
  '~2–4 min',
  '["Video","Reference","Seedance"]',
  'pink',
  'var(--pd-pink)',
  '{"kicker":"Omni Reference","howItWorks":["Pick a model — Seedance 2.5 allows longer clips (up to 30s) and more references (up to 30)","Upload references — images, plus optional video and audio clips","Tag them in your prompt as @Image1, @Video1, @Audio1 …","Set aspect, duration and resolution, then Generate"],"models":{"dreamina-seedance-2-0-260128":{"maxRefs":9,"durations":[5,10,15]},"dreamina-seedance-2-5-260628":{"maxRefs":30,"durations":[5,10,15,20,25,30]}}}',
  'Multi-reference video with @-tagged prompts',
  'Upload reference images — plus optional video and audio clips — and tag them in your prompt (@Image1, @Video1, @Audio1 …) to control identity, scene, motion, and sound. Powered by BytePlus Seedance.',
  1, 0, 0, 0,
  datetime('now')
);
