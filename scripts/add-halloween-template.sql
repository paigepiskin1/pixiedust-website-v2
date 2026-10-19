-- Adds the "Halloween" photoshoot template (Seedream 4.5, 2 face refs + 2 body refs).
-- Starts ADMIN-ONLY (is_admin_only = 1) so it can be tested before going public;
-- flip to 0 in the admin editor once it looks right.
--
-- The four upload fields are separate so they always reach the model in a fixed
-- order: image_input[0..3] = face1, face2, body1, body2 — which is what the prompt's
-- "image 1/2" (face) and "image 3/4" (body) refer to.
--
-- Apply: npx wrangler d1 execute <DB_NAME> --remote --file=scripts/add-halloween-template.sql

INSERT OR REPLACE INTO templates
  (id, title, kind, type, category, provider, model, input_json, fields_json,
   credit_cost, quality_json, aspects_json, quantities_json, engine, eta,
   tags_json, tone, accent, meta, subtitle, description,
   is_featured, is_hidden, is_adult, sort_order, price_per_second, durations_json, is_admin_only)
VALUES
  ('halloween', 'Halloween', 'shoot', 'image', 'Fantasy',
   'replicate', 'bytedance/seedream-4.5',
   '{"prompt":"In front of a convenience store. Low res. Flash photo taken with iPhone. Foggy. Halloween photoshoot, low res iPhone. Her skin color is devil red and she has tiny red devil horns, and long hair. Wearing a black mini patent leather dress. Black lip gloss, with long black nails. Use image 1 as the face reference and image 2 as face reference 2. Use image 3 and image 4 as the body type reference.","image_input":["{{face1*}}","{{face2*}}","{{body1*}}","{{body2*}}"],"max_images":1,"aspect_ratio":"{{aspect}}","sequential_image_generation":"disabled"}',
   '[{"key":"face1","type":"file","label":"Face reference 1","required":true,"accept":"image/*","help":"A clear, front-facing photo of the face"},{"key":"face2","type":"file","label":"Face reference 2","required":true,"accept":"image/*","help":"A second face photo (different angle helps)"},{"key":"body1","type":"file","label":"Body reference image 3","required":true,"accept":"image/*","help":"Full or half body photo for body type"},{"key":"body2","type":"file","label":"Body reference image 4","required":true,"accept":"image/*","help":"A second body photo for body type"}]',
   4, NULL, '["3:4","4:5","9:16","1:1"]', '[1,2,4]',
   'Seedream 4.5', '~20s',
   '["Photoshoot","Halloween","Seasonal"]', 'noir', 'var(--pd-teal)', 'Photoshoot',
   'Red devil flash shoot', 'Low-res iPhone flash photo outside a foggy convenience store — red devil skin, tiny horns, black patent mini dress. Upload 2 face refs and 2 body refs.',
   0, 0, 0, 50, NULL, NULL, 1);
