-- Migration 0009: fix broken/incomplete template inputs found in production.
-- Issues fixed:
--   * old-fisheye-lens: file field had no accept + single only; aspect_ratio was
--     a raw unparsed {{select|...}} macro (never resolved → bad value sent).
--   * old-nano-banana-ii: was a broken upscaler stub (no prompt, wrong params on
--     the nano-banana model). Converted to a proper nano-banana image edit.
--   * old-krea-image-edit: file field had no accept; aspect was hardcoded 1:1.
--   * old-free-prompt-flux-9-16-adult: aspect_ratio was a raw {{select*|...}} macro;
--     unlabeled fields. Macro → {{aspect}} + real aspects; fields relabeled.

-- ── old-fisheye-lens (google/nano-banana) ──────────────────────────────────────
UPDATE templates SET
  fields_json = '[{"key":"files","type":"file","label":"Your photo(s)","multiple":true,"max":4,"accept":"image/*","required":true}]',
  input_json  = '{"prompt":"change photo to fisheye lens, gopro style, wide angle distorted lens shot from below","image_input":"{{files*}}","aspect_ratio":"{{aspect}}","output_format":"jpg"}'
WHERE id = 'old-fisheye-lens';

-- ── old-nano-banana-ii → real nano-banana image edit ───────────────────────────
UPDATE templates SET
  fields_json = '[{"key":"prompt","type":"textarea","label":"Prompt","placeholder":"Describe the edit…","required":true},{"key":"files","type":"file","label":"Your photo(s)","multiple":true,"max":4,"accept":"image/*","required":true}]',
  input_json  = '{"prompt":"{{prompt*}}","image_input":"{{files*}}","aspect_ratio":"{{aspect}}","output_format":"jpg"}'
WHERE id = 'old-nano-banana-ii';

-- ── old-krea-image-edit (flux-krea-dev) ────────────────────────────────────────
UPDATE templates SET
  fields_json  = '[{"key":"file","type":"file","label":"Your photo","accept":"image/*","required":true},{"key":"prompt","type":"textarea","label":"Prompt","placeholder":"Describe the edit…","required":true}]',
  input_json   = '{"image":"{{file}}","prompt":"{{prompt*}}","go_fast":true,"guidance":3,"megapixels":"1","num_outputs":1,"aspect_ratio":"{{aspect}}","output_format":"webp","output_quality":95,"prompt_strength":0.8,"num_inference_steps":28}',
  aspects_json = '["1:1","4:5","16:9","9:16","3:4","4:3"]'
WHERE id = 'old-krea-image-edit';

-- ── old-free-prompt-flux-9-16-adult (flux-dev-lora) ────────────────────────────
UPDATE templates SET
  fields_json  = '[{"key":"model","type":"text","label":"Trigger / subject","placeholder":"e.g. a portrait of","required":true},{"key":"prompt","type":"textarea","label":"Prompt","placeholder":"Describe the scene…","required":true},{"key":"model_output","type":"text","label":"LoRA weights URL (optional)"},{"key":"textarea","type":"text","label":"Negative prompt (optional)"}]',
  input_json   = '{"prompt":"{{model*}} , a woman,  {{prompt*}}","go_fast":true,"guidance":3,"lora_scale":1,"megapixels":"1","num_outputs":1,"aspect_ratio":"{{aspect}}","lora_weights":"{{model_output}}","output_format":"webp","output_quality":100,"negative_prompt":"{{textarea}}","prompt_strength":0.8,"safety_tolerance":2,"num_inference_steps":28,"disable_safety_checker":true}',
  aspects_json = '["1:1","4:3","3:2","16:9","9:16","21:9","3:4","2:3"]'
WHERE id = 'old-free-prompt-flux-9-16-adult';
