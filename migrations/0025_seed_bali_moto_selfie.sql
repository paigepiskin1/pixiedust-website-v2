-- Bali Moto Selfie: lower-res natural iPhone look, windblown hair, black Oakleys.
-- Carousel covers live in meta.previewImages (3 model tests).

INSERT INTO templates (
  id, title, kind, type, category, provider, model,
  input_json, fields_json, credit_cost, quality_json, aspects_json, quantities_json,
  eta, tags_json, tone, accent, subtitle, description, preview_image, meta,
  is_featured, is_hidden, is_admin_only, is_adult, sort_order, updated_at
) VALUES
(
  'bali-moto-selfie',
  'Bali Moto Selfie',
  'shoot', 'image', 'Selfie', 'replicate', 'openai/gpt-image-2',
  '{"prompt":"Generate a candid lower-resolution natural iPhone selfie of me on a motorcycle scooter in Bali. Ultra-wide front-camera selfie, arm extended holding the phone, sitting on a classic scooter on a tropical Balinese road with palms or rice terraces behind. Messy windblown hair whipping around my face, wearing black Oakley-style wraparound sport sunglasses, warm daylight, slightly soft and grainy phone compression, imperfect candid snapshot energy — not polished studio, sharp facial likeness to the reference photos, natural skin texture, slightly distorted wide lens look, authentic phone snapshot, no text overlays, no helmet blocking the face.","quality":"auto","background":"auto","moderation":"low","aspect_ratio":"{{aspect}}","input_images":"{{files*}}","output_format":"webp","number_of_images":1,"output_compression":90}',
  '[{"key":"files","type":"file","label":"Your photos","required":true,"multiple":true,"max":4,"accept":"image/*","help":"Clear face photos work best for the scooter selfie angle"},{"key":"outfit","type":"file","label":"Change outfit (optional)","required":false,"multiple":true,"max":4,"accept":"image/*","help":"Optional — upload flat lays or outfit photos to wear instead of what''s in your photos."}]',
  5, NULL, '["match","1:1","2:3","3:2"]', '[1,2,4]',
  '~2 min', '["bali","moto","selfie","oakley","windblown",".5"]', 'amber', 'var(--pd-amber)',
  'Selfie · Bali · windblown Oakleys',
  'Bali moto selfie — messy windblown hair, black wraparound Oakleys, natural lower-res iPhone look.',
  'https://pixiecdn.b-cdn.net/gen_d80b0323-9f76-44ee-bb08-a6aed948e196_1785162699662.png',
  '{"kicker":"Photoshoot · Bali Moto Selfie","howItWorks":["Upload clear photos of yourself","We put you on a Bali moto selfie with windblown hair + Oakleys","Pick a ratio and generate"],"previewImages":["https://pixiecdn.b-cdn.net/gen_d80b0323-9f76-44ee-bb08-a6aed948e196_1785162699662.png", "https://pixiecdn.b-cdn.net/gen_d80b0323-9f76-44ee-bb08-a6aed948e196_1785162888912.png", "https://pixiecdn.b-cdn.net/gen_d80b0323-9f76-44ee-bb08-a6aed948e196_1785163146893.png"]}',
  1, 0, 0, 0, 19, datetime('now')
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
  preview_image=COALESCE(excluded.preview_image, templates.preview_image),
  meta=excluded.meta,
  is_featured=excluded.is_featured,
  is_hidden=excluded.is_hidden,
  is_admin_only=excluded.is_admin_only,
  is_adult=excluded.is_adult,
  sort_order=excluded.sort_order,
  updated_at=excluded.updated_at;
