-- Migration 0008: Correct template pricing using llm-stats.com verified costs
-- Reference rate: $0.064/credit (Creator pack: $32 / 500 credits)
-- Formula: credits = ceil(cost_usd * 5 / 0.064)
-- Source: https://llm-stats.com/models?category=image + video
--
-- Corrections to migration 0007 (all prices now from llm-stats.com):
--
--   seedream-4        $0.030/img (Replicate)  → 5x=$0.150 → 2.34 cr → 3 cr
--   seedream-4.5      $0.040/img (Replicate)  → 5x=$0.200 → 3.13 cr → 4 cr
--   gpt-image-2       $0.053/img (OpenAI)     → 5x=$0.265 → 4.14 cr → 5 cr
--   nano-banana       $0.040/img (Google)     → 5x=$0.200 → 3.13 cr → 4 cr
--   nano-banana-pro   $0.130/img (Google)     → 5x=$0.650 → 10.16cr → 11 cr
--   veo-3             $0.400/s × 8s = $3.20   → 5x=$16.00 → 250 cr
--                     (8s is Veo 3.0 default output duration)
--
-- Unchanged (already correct from 0007):
--   flux-schnell:     $0.003/img → 2 cr (floor minimum)
--   flux-dev-lora:    ~$0.025/img → 2 cr
--   flux-krea-dev:    ~$0.025/img → 2 cr
--   seedance-1-lite:  $0.036/s × 5s = $0.18 → 14 cr ✓

-- ── Image fixes ──────────────────────────────────────────────────────────────

-- seedream-4: $0.030/img → 3 cr (was 2)
UPDATE templates SET credit_cost = 3
  WHERE model = 'bytedance/seedream-4';

-- seedream-4.5: $0.040/img → 4 cr (was 2)
UPDATE templates SET credit_cost = 4
  WHERE model = 'bytedance/seedream-4.5';

-- gpt-image-2: $0.053/img → 5 cr (was 3)
UPDATE templates SET credit_cost = 5
  WHERE model = 'openai/gpt-image-2';

-- nano-banana (Gemini 2.5 Flash Image): $0.040/img → 4 cr (was 1)
UPDATE templates SET credit_cost = 4
  WHERE model = 'google/nano-banana';

-- nano-banana-pro (Gemini 3 Pro Image): $0.130/img → 11 cr (was 1)
UPDATE templates SET credit_cost = 11
  WHERE model = 'google/nano-banana-pro';

-- ── Video fixes ───────────────────────────────────────────────────────────────

-- google/veo-3: $0.400/s × 8s default = $3.20/video → 250 cr (was 469 — corrected)
UPDATE templates SET credit_cost = 250
  WHERE model = 'google/veo-3';
