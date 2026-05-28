UPDATE templates SET
  fields_json = '[{"key":"prompt","type":"textarea","label":"Describe the result","required":false,"placeholder":"e.g. photorealistic portrait, cinematic lighting"},{"key":"files","type":"file","label":"Reference images","required":true,"multiple":true,"max":4,"accept":"image/*","help":"Up to 4 reference images"}]',
  input_json  = '{"prompt":"{{prompt}}","image_input":"{{files*}}","aspect_ratio":"{{aspect}}","max_images":1,"sequential_image_generation":"disabled"}'
WHERE id = 'old-seed-dream-4';
