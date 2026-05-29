/**
 * Batch-generates preview images/videos for templates missing them.
 * Uses SyncNode API → Replicate FLUX schnell (images) / Seedance (video).
 * Run: node scripts/generate-template-previews.mjs [--videos] [--dry-run]
 *
 * Flags:
 *   --videos     Also generate video previews (slower/pricier). Default: images only.
 *   --dry-run    Print what would be generated, don't actually call API.
 *   --limit N    Max templates to process.
 */

import * as https from "https";

// Secrets come from env only (loaded from .dev.vars). Run via:
//   node scripts/dev.mjs node scripts/generate-template-previews.mjs
const SYNCNODE_KEY = process.env.SYNCNODE_API_KEY;
const DB_ID   = process.env.CF_D1_DATABASE_ID || "105e2276-0d51-430a-8c6f-b4f7ee699aaf";
const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID || "15149dc8d99998b6c96a67c2cf52ad7c";
const CF_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
if (!SYNCNODE_KEY || !CF_TOKEN) {
  console.error("Missing SYNCNODE_API_KEY or CLOUDFLARE_API_TOKEN in env.\nRun via: node scripts/dev.mjs node scripts/generate-template-previews.mjs");
  process.exit(1);
}

const DO_VIDEOS = process.argv.includes("--videos");
const DRY_RUN   = process.argv.includes("--dry-run");
const limitArg  = process.argv.indexOf("--limit");
const LIMIT     = limitArg >= 0 ? parseInt(process.argv[limitArg + 1]) : Infinity;
const CONCURRENCY = 4; // parallel jobs

// ── Cloudflare D1 helper ─────────────────────────────────────────────────────
async function d1(sql) {
  const r = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/d1/database/${DB_ID}/query`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${CF_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ sql }),
    }
  );
  const d = await r.json();
  if (!d.success) throw new Error(`D1 error: ${JSON.stringify(d.errors)}`);
  return d.result?.[0]?.results ?? [];
}

// ── SyncNode helpers ─────────────────────────────────────────────────────────
async function submit(provider, model, input) {
  const base = "https://run.syncnode.ai";
  const url = provider === "fal" ? `${base}/fal/generate` : `${base}/generate`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey: SYNCNODE_KEY, model, input }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.job_id) throw new Error(d.error || d.detail || `Submit failed (${r.status})`);
  return d.job_id;
}

async function poll(provider, jobId, maxMs = 120000) {
  const base = "https://run.syncnode.ai";
  const url = provider === "fal"
    ? `${base}/fal/status?job_id=${encodeURIComponent(jobId)}&apiKey=${encodeURIComponent(SYNCNODE_KEY)}`
    : `${base}/prediction-status?job_id=${encodeURIComponent(jobId)}&apiKey=${encodeURIComponent(SYNCNODE_KEY)}`;
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    await new Promise(res => setTimeout(res, 4000));
    const r = await fetch(url, { headers: { Authorization: `Bearer ${SYNCNODE_KEY}` } });
    const d = await r.json().catch(() => ({}));
    const st = d.replicate_status || d.task_status || d.status;
    const ok = ["succeeded", "COMPLETED", "SUCCEEDED", "completed"].includes(st);
    const fail = ["failed", "FAILED", "CANCELED", "error"].includes(st);
    if (ok) {
      // extract first output URL
      const out = d.output;
      if (typeof out === "string") return out;
      if (Array.isArray(out) && out.length) return out[0];
      if (out?.url) return out.url;
      if (Array.isArray(out?.images) && out.images.length) return out.images[0]?.url ?? out.images[0];
    }
    if (fail) throw new Error(`Job failed: ${d.error || d.output || "unknown"}`);
  }
  throw new Error("Timed out waiting for generation");
}

// ── Prompt lookup ─────────────────────────────────────────────────────────────
// Well-chosen example prompts that highlight each template's aesthetic.
const SPECIFIC_PROMPTS = {
  // Presets — film-look portrait
  "preset-1970s":        "Young woman with wavy hair, sitting in a vintage car, natural light",
  "preset-1980s":        "Woman with bold makeup and big hair, neon city lights behind her",
  "preset-1990s":        "Teenage girl on a swing in a quiet suburb, golden afternoon light",
  "preset-anime":        "Young woman with expressive eyes, cherry blossoms falling, anime-style",
  "preset-blade-runner": "Woman standing in a rainy neon-lit alley, futuristic city at night",
  "preset-camcorder":    "Family gathered in a living room, soft warm light, nostalgic",
  "preset-cctv":         "Person walking through a city street, grainy overhead angle",
  "preset-cd-shimmer":   "Close-up of a woman's face with iridescent holographic light",
  "preset-cinestill-800t":"Woman in a dimly lit jazz bar, warm tungsten glow, night city window",
  "preset-claymation":   "Cute clay figure of a girl in a colorful garden, stop-motion style",
  "preset-disposable":   "Group of friends laughing at a summer party, flash photography",
  "preset-dreamy":       "Woman in a field of wildflowers, soft bokeh, golden hour haze",
  "preset-drone":        "Aerial view of a woman standing on a rooftop, city skyline",
  "preset-ektachrome":   "Mountain hiker woman on a summit, vibrant blue sky, slide film look",
  "preset-ethereal":     "Woman in flowing white dress, misty forest clearing, soft backlight",
  "preset-fincher-green":"Woman sitting alone in a dark interrogation room, teal-green shadow",
  "preset-fisheye":      "Skateboarder woman doing a trick on a halfpipe, wide fisheye lens",
  "preset-frosted-glass":"Silhouette of a woman behind frosted glass, diffused light",
  "preset-fuji-pro-400h":"Wedding couple in a garden, soft pastel greens, film grain",
  "preset-ghibli":       "Young woman in a meadow with a windmill, whimsical anime sky",
  "preset-headshot":     "Professional woman in a blazer, clean grey studio backdrop",
  "preset-kodak-gold":   "Young woman at a golden-hour beach picnic, warm orange tones",
  "preset-kodak-portra": "Portrait of a mother and child in soft afternoon light, film grain",
  "preset-linkedin":     "Professional businesswoman smiling, grey studio background",
  "preset-liquid-chrome":"Abstract metallic liquid surface with a face reflection",
  "preset-magazine":     "High-fashion woman in bold outfit, editorial magazine spread",
  "preset-melancholy":   "Young woman sitting alone by a rain-streaked window, muted tones",
  "preset-oil-paint":    "Woman in a Victorian garden, thick brushstrokes, impressionist",
  "preset-pixar-3d":     "Cute 3D animated girl with big eyes, colorful bedroom, Pixar style",
  "preset-polaroid-600": "Friends at a summer barbecue, Polaroid border, faded warm colors",
  "preset-sun-kissed":   "Woman laughing on a California beach, golden sunlight, freckles",
  "preset-teal-orange":  "Action hero woman, explosive scene, cinematic teal-orange grade",
  "preset-tri-x-400":    "Street scene of a woman reading a newspaper, grainy black-and-white",
  "preset-vogue":        "High-fashion model in dramatic couture gown, Vogue editorial",
  "preset-watercolor":   "Portrait of a girl with flowers in her hair, loose watercolor style",
  "preset-wes-anderson": "Woman in a pastel-colored railway car, symmetrical composition",

  // Beauty
  "beauty-berry-stain":  "Close-up portrait of a woman with deep berry-tinted lips, studio",
  "beauty-copper-bob":   "Woman with a sleek copper bob haircut, side profile, studio light",
  "beauty-curtain-bangs":"Young woman with soft curtain bangs, natural makeup, warm light",
  "beauty-doll":         "Woman with porcelain doll makeup, glossy lips, wide innocent eyes",
  "beauty-feather-brow": "Close-up of feathery, brushed-up eyebrows on a woman, minimal makeup",
  "beauty-glass-skin":   "Woman with ultra-luminous glass skin, dewy glow, studio portrait",
  "beauty-glazed-glow":  "Woman with a warm glazed highlighter glow, radiant skin portrait",
  "beauty-glossy-nude":  "Woman with glossy nude lips, natural skin, clean portrait",
  "beauty-long-waves":   "Woman with long flowing beachy waves, golden hour light",
  "beauty-platinum-blonde":"Woman with platinum blonde hair, bold makeup, fashion editorial",
  "beauty-smoky-noir":   "Woman with dramatic smoky eye makeup, dark moody studio lighting",
  "beauty-sun-kissed":   "Woman with bronzed sun-kissed skin, beach waves, natural beauty",

  // Avatar
  "avatar-anime-self":   "Young woman portrait, expressive eyes, clean background",
  "avatar-builder":      "Professional person portrait, neutral expression, studio",
  "avatar-cottagecore":  "Young woman in a flower-filled meadow, wearing linen dress",
  "avatar-cyber-model":  "Woman in futuristic outfit, neon city at night behind her",
  "avatar-editorial-me": "Woman in fashion editorial pose, dramatic studio lighting",
  "avatar-goth":         "Woman with dark makeup, gothic fashion, dark moody background",
  "avatar-pixar-me":     "Young smiling woman portrait, colorful background",
  "avatar-renaissance":  "Woman in elegant clothing, soft classical painting light",
  "avatar-y2k-avatar":   "Young woman with Y2K fashion accessories, fun colorful style",

  // Fashion
  "fashion-athleisure":  "Woman in stylish athleisure outfit, city background, sporty look",
  "fashion-black-tie":   "Woman in elegant black evening gown, formal event setting",
  "fashion-coastal-grandma":"Woman in linen wide-leg pants and wicker hat, ocean background",
  "fashion-cocktail":    "Woman in chic cocktail dress at an upscale party",
  "fashion-runway-editorial":"High-fashion model walking the runway, dramatic stage lighting",
  "fashion-streetwear":  "Young woman in oversized hoodie and chunky sneakers, urban setting",
  "fashion-vintage-70s": "Woman in flared jeans and floral blouse, vintage city street",
  "fashion-y2k-mall":    "Teenage girl in low-rise jeans and butterfly clips, mall setting",

  // Shoots
  "shoot-boudoir":       "Elegant woman in a luxury bedroom, tasteful intimate portrait",
  "shoot-caf-lifestyle": "Woman with a coffee at a stylish café, relaxed portrait",
  "shoot-ceo-headshots": "Confident businesswoman in a corner office, professional headshot",
  "shoot-coffee-shop":   "Young woman reading a book in a cozy coffee shop, warm light",
  "shoot-cyber-goddess": "Woman in futuristic silver outfit, dark neon cyber background",
  "shoot-editorial-noir":"Woman in black clothing, dramatic shadow, high-contrast noir",
  "shoot-fairy-tale":    "Woman in a flowing gown in an enchanted forest, magical light",
  "shoot-linkedin-pro":  "Professional woman smiling, modern office backdrop",
  "shoot-old-hollywood": "Glamorous woman in vintage dress, classic Hollywood portrait",
  "shoot-soft-siren":    "Woman with long hair in a flowy dress, romantic soft lighting",
  "shoot-vogue-editorial":"Fashion model in avant-garde outfit, magazine editorial pose",
  "shoot-y2k-mall-girl": "Teen in Y2K fashion at a colorful shopping mall, playful pose",

  // Ads
  "ad-beauty-before-after":"Split view of woman's face transformation, beauty advertisement",
  "ad-cinematic-ad":     "Woman holding luxury product, cinematic wide shot advertisement",
  "ad-founder-portrait": "Confident entrepreneur in a modern studio, personal brand photo",
  "ad-lifestyle-ad":     "Happy woman enjoying a product in a sunny apartment, lifestyle ad",
  "ad-outdoor-billboard":"Model on a billboard, city street behind her, advertising campaign",
  "ad-product-hero":     "Luxury skincare product bottle on marble surface, ad photography",
  "ad-studio-packshot":  "Clean studio photo of a perfume bottle, white background, product",
  "ad-ugc-review":       "Woman holding a product and smiling at camera, UGC review style",

  // Old
  "old-courtside-basketball":"Player dunking a basketball, courtside action shot, sports photography",

  // Cinema / video
  "cinema-action-scene": "Hero running through an exploding building, dramatic action scene",
  "cinema-caf-main-char":"Main character sitting alone in a Parisian café, cinematic drama",
  "cinema-noir-chase":   "Detective chasing a suspect through rain-slicked streets at night",

  // Fashion video
  "fashion-video-couture-walk":"Model in haute couture gown walking gracefully on runway",
  "fashion-video-y2k-runway":  "Model in Y2K fashion outfit walking a colorful runway",

  // Game videos
  "game-video-anime-opening":"Anime hero girl posing dramatically, cherry blossom wind",
  "game-video-cyberpunk-run":"Cyberpunk girl running through neon-lit rain alley at night",
  "game-video-gta-cutscene":  "Cool gangster character by a sports car, cinematic game cutscene",
  "game-video-neon-arcade":  "Girl playing arcade game, neon lights, retro arcade hall",

  // i2v
  "i2v-glass-shatter":   "Close-up of a wine glass, dramatic still life, elegant",
  "i2v-petals-bloom":    "Pink rose slowly blooming, macro photography, soft light",
  "i2v-snakes-wrapped":  "Exotic snake wrapped around a tree branch, tropical forest",

  // Motion
  "motion-action-stunt": "Stuntwoman doing a backflip off a rooftop, action movie",
  "motion-fashion-week": "Model walking the runway at Paris fashion week, editorial",
  "motion-glass-strut":  "Confident woman striding through a glass office lobby",
  "motion-savage-dance": "Woman in streetwear dancing energetically in an urban space",
  "motion-slow-mo-spin": "Woman in a flowing dress spinning in a slow-motion close-up",
  "motion-snakes-wrap":  "Woman in dramatic pose with draped fabric, artistic movement",
  "motion-tiktok-trend": "Trendy young woman doing a fun dance on a colorful background",
  "motion-y2k-runway":   "Model in Y2K outfit strutting down a colorful retro runway",
};

const DEFAULT_BY_CATEGORY = {
  preset:  "Beautiful young woman portrait, outdoor natural light",
  beauty:  "Elegant woman close-up portrait, studio lighting",
  avatar:  "Young professional woman, neutral background, portrait",
  fashion: "Fashion model in stylish outfit, editorial setting",
  shoot:   "Professional model, studio photography session",
  ad:      "Lifestyle product advertisement, professional photography",
  cinema:  "Person in dramatic scene, cinematic lighting",
  motion:  "Person moving gracefully, dynamic moment",
  game:    "Character in stylized environment, dynamic action",
  "i2v":   "Beautiful nature scene, macro photography",
  old:     "Professional portrait photography",
};

function getPrompt(id) {
  if (SPECIFIC_PROMPTS[id]) return SPECIFIC_PROMPTS[id];
  const cat = id.split("-")[0];
  return DEFAULT_BY_CATEGORY[cat] || "Beautiful portrait photography, professional studio";
}

// ── Main ──────────────────────────────────────────────────────────────────────
console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"} | Videos: ${DO_VIDEOS} | Limit: ${LIMIT}`);

const allMissing = await d1(`
  SELECT id, title, type, provider, model, input_json
  FROM templates
  WHERE (preview_image IS NULL OR preview_image = '')
    AND (preview_video IS NULL OR preview_video = '')
  ORDER BY type, id
`);

const toProcess = allMissing
  .filter(t => DO_VIDEOS ? true : t.type !== "video")
  .slice(0, LIMIT);

console.log(`\nTemplates to generate: ${toProcess.length} (${allMissing.length - toProcess.length} skipped)\n`);

if (DRY_RUN) {
  toProcess.forEach(t => {
    const prompt = getPrompt(t.id);
    console.log(`[${t.type}] ${t.id}`);
    console.log(`         prompt: "${prompt}"`);
    console.log(`         model:  ${t.model}`);
  });
  process.exit(0);
}

// Process in batches
let done = 0, failed = 0;

async function processTemplate(t) {
  const prompt = getPrompt(t.id);
  process.stdout.write(`  [${t.type}] ${t.id} … `);

  // Build input by replacing {{prompt}} in the template's input_json
  let inputStr = t.input_json.replace(/\{\{prompt\}\}/g, prompt);
  let input;
  try { input = JSON.parse(inputStr); }
  catch { console.log(`✗ bad input_json`); failed++; return; }

  try {
    const jobId = await submit(t.provider, t.model, input);
    const outputUrl = await poll(t.provider, jobId, t.type === "video" ? 180000 : 90000);
    if (!outputUrl) throw new Error("No output URL returned");

    const col = t.type === "video" ? "preview_video" : "preview_image";
    await d1(`UPDATE templates SET ${col} = '${outputUrl.replace(/'/g, "''")}' WHERE id = '${t.id.replace(/'/g, "''")}'`);
    console.log(`✓ ${outputUrl.slice(0, 60)}…`);
    done++;
  } catch (err) {
    console.log(`✗ ${err.message.slice(0, 80)}`);
    failed++;
  }
}

// Run in batches of CONCURRENCY
for (let i = 0; i < toProcess.length; i += CONCURRENCY) {
  const batch = toProcess.slice(i, i + CONCURRENCY);
  await Promise.all(batch.map(processTemplate));
  console.log(`  Progress: ${Math.min(i + CONCURRENCY, toProcess.length)}/${toProcess.length} (${done} ok, ${failed} failed)\n`);
}

console.log(`\n✅ Done: ${done} previews generated, ${failed} failed`);
