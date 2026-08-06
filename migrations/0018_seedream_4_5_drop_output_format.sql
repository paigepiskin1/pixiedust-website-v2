-- Seedream 4.5 (seedream-4-5-251128) rejects `output_format` on BytePlus ModelArk.
-- Seedream 5.0 Pro still accepts it; only strip from 4.5.

UPDATE templates
SET input_json = '{"prompt":"{{prompt}}","image":"{{files*}}","size":"2K","aspect_ratio":"{{aspect}}","response_format":"url","watermark":false}',
    updated_at = datetime('now')
WHERE id = 'seedream-4-5';
