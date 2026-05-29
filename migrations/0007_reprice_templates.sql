-- Migration 0007: Reprice templates at 5x Replicate cost
-- Reference rate: $0.064/credit (Creator pack: $32 / 500 credits)
-- Formula: credits = ceil(replicate_cost * 5 / 0.064)
--
-- Verified Replicate prices (fetched from replicate.com model pages + pricing page):
--   flux-schnell      $0.003/img  → 5x=$0.015 → 0.23 cr → 2 cr (floor minimum)
--   flux-dev          $0.025/img  → 5x=$0.125 → 1.95 cr → 2 cr
--   flux-dev-lora     ~$0.025/img → 5x=$0.125 → 1.95 cr → 2 cr  (same hardware as flux-dev)
--   flux-krea-dev     ~$0.025/img → 5x=$0.125 → 1.95 cr → 2 cr  (flux-dev fine-tune)
--   seedream-4/4.5    ~$0.015/img → 5x=$0.075 → 1.17 cr → 2 cr
--   gpt-image-2       $0.040/img  → 5x=$0.200 → 3.13 cr → 3 cr
--   nano-banana/pro   ~$0.005/img → 5x=$0.025 → 0.39 cr → 1 cr  (floor, keep)
--
--   seedance-1-lite   $0.036/sec@720p × 5s = $0.18/video
--                     → 5x=$0.90 → 14.06 cr → 14 cr
--                     Source: replicate.com/bytedance/seedance-1-lite (user-confirmed)
--
--   google/veo-3      $6.00/video
--                     → 5x=$30.00 → 468.75 cr → 469 cr
--                     Source: replicate.com/blog/compare-ai-video-models

-- ── Image fixes ──────────────────────────────────────────────────────────────

-- beauty-* templates use flux-schnell but were priced at 1 cr — raise to 2
UPDATE templates SET credit_cost = 2
  WHERE model = 'black-forest-labs/flux-schnell' AND credit_cost < 2;

-- flux-dev-lora: old templates priced at 1 cr — raise to 2
UPDATE templates SET credit_cost = 2
  WHERE model = 'black-forest-labs/flux-dev-lora';

-- flux-krea-dev: was 1 cr — raise to 2
UPDATE templates SET credit_cost = 2
  WHERE model = 'black-forest-labs/flux-krea-dev';

-- seedream-4 / seedream-4.5: were 1 cr — raise to 2
UPDATE templates SET credit_cost = 2
  WHERE model IN ('bytedance/seedream-4', 'bytedance/seedream-4.5');

-- gpt-image-2: $0.04/img (OpenAI medium quality) — raise to 3
UPDATE templates SET credit_cost = 3
  WHERE model = 'openai/gpt-image-2';

-- nano-banana / nano-banana-pro: cheap Gemini Flash compute, keep at 1 (floor)
-- (no change needed)

-- ── Video fixes ───────────────────────────────────────────────────────────────

-- seedance-1-lite: all templates use 5s @ 720p
-- $0.036/sec × 5s = $0.18 → 5x = $0.90 → ceil($0.90 / $0.064) = 14 credits
UPDATE templates SET credit_cost = 14
  WHERE model = 'bytedance/seedance-1-lite';

-- google/veo-3: $6.00/video confirmed (replicate.com/blog/compare-ai-video-models)
-- → 5x = $30.00 → ceil($30.00 / $0.064) = 469 credits
UPDATE templates SET credit_cost = 469
  WHERE model = 'google/veo-3';
