-- Align Seedream 4.5 with BytePlus multi-reference example:
--   prompt + image[] + size + output_format:"png" + watermark:false
-- (no response_format; jpeg output_format is rejected on this model)

UPDATE templates
SET
  input_json = '{"prompt":"{{prompt}}","image":"{{files*}}","size":"2K","output_format":"png","watermark":false,"aspect_ratio":"{{aspect}}"}',
  fields_json = '[{"key":"files","type":"file","label":"Reference images","required":true,"multiple":true,"max":9,"accept":"image/*","labeled":true,"help":"Upload up to 9 reference images. They become image 1, image 2, … in your prompt."},{"key":"prompt","type":"textarea","label":"Prompt","required":true,"mentionFrom":"files","placeholder":"Replace the clothing in image 1 with the outfit from image 2.","help":"Refer to uploads as image 1, image 2, … (or tap @ chips)."}]',
  updated_at = datetime('now')
WHERE id = 'seedream-4-5';
