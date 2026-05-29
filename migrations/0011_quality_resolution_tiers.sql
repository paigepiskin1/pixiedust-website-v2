-- Migration 0011: map quality tiers to each model's real resolution options.
-- Quality keys are now the actual resolution values the model accepts; the
-- generate endpoint injects the selected key into the model's `resolution`
-- param. Multipliers reflect real Replicate price ratios.
-- Only templates that already expose a `resolution` param are touched.
--
--   seedance-1-lite: 480p $0.018/s · 720p $0.036/s · 1080p $0.072/s
--     → relative to 720p base (credit_cost 14): 480p ×0.5, 720p ×1, 1080p ×2
--   nano-banana-pro: 1K / 2K / 4K  (2K is the existing default → ×1)
--   veo-3: 720p / 1080p  (Replicate charges the same $0.40/s for both → ×1)

UPDATE templates
  SET quality_json = '{"480p":0.5,"720p":1,"1080p":2}'
  WHERE model = 'bytedance/seedance-1-lite' AND input_json LIKE '%"resolution"%';

UPDATE templates
  SET quality_json = '{"1K":0.7,"2K":1,"4K":1.8}'
  WHERE model = 'google/nano-banana-pro' AND input_json LIKE '%"resolution"%';

UPDATE templates
  SET quality_json = '{"720p":1,"1080p":1}'
  WHERE model = 'google/veo-3' AND input_json LIKE '%"resolution"%';
