-- Starting fact sheet for the AI Writer (Admin → AI Writer → Facts).
--
-- Each statement was checked against the live site, the code, or the live
-- templates table on 2026-10-20. Where two parts of the site disagree, the
-- fact is seeded as 'needs_review' with the conflict spelled out, so the writer
-- is told not to state it until an admin settles it.
--
-- ON CONFLICT DO NOTHING: re-running never overwrites an admin's edits.

INSERT INTO ai_facts (id, topic, statement, source, status, sort_order) VALUES
-- ── brand & history ───────────────────────────────────────────────────────
('brand.name', 'brand', 'The current brand name is PixyDust: one word, capital P and capital D.', '/about', 'approved', 10),
('brand.former-name', 'brand', 'PixyDust was formerly called PixieDust. Use PixieDust or Pixie Dust only when talking about the former name or the original AR filter, never for the company today.', '/about', 'approved', 11),
('brand.entity', 'brand', 'The company is PixyDust, LLC.', '/legal/terms', 'approved', 12),
('brand.name-origin', 'brand', 'Pixy is a historical spelling of pixie.', '/about', 'approved', 13),
('brand.origin', 'brand', 'The brand began in January 2019 with the Pixie Dust AR filter, an interactive augmented-reality filter on Instagram, Snapchat and TikTok.', '/about', 'approved', 14),
('brand.filter-views', 'brand', 'The original Pixie Dust AR filter generated more than 3 billion views across Instagram, Snapchat and TikTok.', '/about', 'approved', 15),
('brand.library-views', 'brand', 'The PixieDust library of AR experiences collectively generated more than 400 billion views across social platforms.', '/about', 'approved', 16),
('brand.creator-studio', 'brand', 'In February 2025 the brand launched PixieDust Creator Studio for iOS.', '/about', 'approved', 17),
('brand.evolution', 'brand', 'PixieDust evolved from AR filters into PixyDust, a platform for creating AI images and video.', '/about', 'approved', 18),
('brand.cofounder', 'brand', 'Paige Piskin is a co-founder of PixyDust. She began creating augmented-reality experiences in 2019.', '/about', 'approved', 19),
('brand.ar-count', 'brand', 'CONFLICT, do not state: the About page says both "300+" and "more than 100" AR experiences were created.', '/about', 'needs_review', 20),
('brand.followers', 'brand', 'UNVERIFIED, do not state: the About page shows "3M+ followers across PixyDust communities" with no source.', '/about', 'needs_review', 21),
('brand.partners', 'brand', 'UNVERIFIED, do not state: the About page logo wall (Netflix, Warner, Samsung, L''Oréal and others) and the "Featured in" list. Do not describe any company as a partner or customer.', '/about', 'needs_review', 22),
('brand.tagline', 'brand', 'CONFLICT, do not state: the site uses two taglines, "Imagine. Create. Magnify." and "Imagine. Create. Captivate."', '/about, /', 'needs_review', 23),

-- ── where it runs ─────────────────────────────────────────────────────────
('surfaces.web', 'surfaces', 'PixyDust runs in a web browser at pixydust.com. Nothing needs to be installed to use it.', '/', 'approved', 30),
('surfaces.no-store-listing', 'surfaces', 'The site links to no App Store or Google Play listing. Do not tell readers to download a mobile app or say that one is available now.', 'SiteFooter (IPHONE_APP_URL is null)', 'approved', 31),
('surfaces.sign-in', 'surfaces', 'You can sign in with Google or with an email address.', '/support', 'approved', 32),
('surfaces.ios-app', 'surfaces', 'UNCONFIRMED, do not state: whether a current PixyDust iPhone app exists, its name, and whether it shares accounts and credits with the web app. (A live article, "Meet the New PixyDust for iPhone", describes one.)', '/blog', 'needs_review', 33),

-- ── tools ─────────────────────────────────────────────────────────────────
('tool.shoots', 'tools', 'AI Photoshoots (pixydust.com/shoots): pick a photoshoot style, upload up to 4 reference photos of yourself, and PixyDust generates new photos of you in that style. There is no model-training or setup step.', '/shoots, templates table', 'approved', 40),
('tool.shoots.output', 'tools', 'Each photoshoot run makes 1, 2 or 4 images, and you choose how many. Most styles let you pick the image shape: square, portrait (2:3), landscape (3:2), or the shape of your own photo.', 'templates table (kind=shoot)', 'approved', 41),
('tool.shoots.cost', 'tools', 'Most photoshoot styles cost 5 credits per image. The exact cost is shown before you generate.', 'templates table (kind=shoot)', 'approved', 42),
('tool.shoots.categories', 'tools', 'Photoshoot styles are grouped into categories including Selfie, Street, With Friends, Lifestyle, Broadcast Trends, Movies and Fantasy.', 'templates table (kind=shoot)', 'approved', 43),
('tool.shoots.outfit', 'tools', 'Some photoshoot styles have a "Keep my original outfit" toggle.', 'templates table (kind=shoot)', 'approved', 44),
('tool.shoots.likeness', 'tools', 'More reference photos (up to 4) help the result look more like you.', 'templates table (kind=shoot, field help text)', 'approved', 45),
('tool.shoots.count', 'tools', 'CONFLICT, do not state: the Photoshoots page says "100+ styles" and "12–30 frames" per pack; the live catalog has 59 styles that make 1 to 4 images per run.', '/shoots vs templates table', 'needs_review', 46),
('tool.presets', 'tools', 'Presets (pixydust.com/presets) restyle a single photo with a look, such as a film stock, a decade, a painter, a camera or a color grade.', '/presets', 'approved', 50),
('tool.presets.count-cost', 'tools', 'CONFLICT, do not state: the number of presets ("120+", "100+", "86+" appear on different pages) and their cost (the page says 2 credits; live presets cost 3 to 5).', '/presets vs templates table', 'needs_review', 51),
('tool.video', 'tools', 'Video (pixydust.com/video) makes short video clips: cinematic scenes, photo-to-life animation, fashion runway and video-game openings, using models including Kling 3.0, Seedance 2.0 and Veo.', '/video', 'approved', 52),
('tool.video.billing', 'tools', 'Video generations are billed by length in seconds. The cost depends on the model, the number of outputs and the quality setting.', '/support', 'approved', 53),
('tool.motion', 'tools', 'Motion Transfer (pixydust.com/motion) applies the movement from a reference video to a photo.', '/motion', 'approved', 54),
('tool.fashion', 'tools', 'Fashion Try-on (pixydust.com/fashion): upload a photo of yourself and a photo of a garment, or pick a look, and PixyDust shows you wearing it.', '/fashion', 'approved', 55),
('tool.beauty', 'tools', 'Beauty Studio (pixydust.com/beauty) applies makeup looks to your face, from a preset look or copied from a reference photo.', '/beauty', 'approved', 56),
('tool.hair', 'tools', 'Hair Studio (pixydust.com/hair) tries haircuts and hair colors on your photo, from presets or a reference hairstyle, while keeping your face.', '/hair', 'approved', 57),
('tool.tattoo', 'tools', 'Tattoo Studio (pixydust.com/avatar) previews fine-line tattoo designs on the face, neck, arms or torso.', '/avatar', 'approved', 58),
('tool.ad', 'tools', 'Ad Studio (pixydust.com/ad) makes product shots, UGC-style and lifestyle content, and video, exported at 1:1, 9:16, 16:9 or 4:5.', '/ad', 'approved', 59),
('tool.models', 'tools', 'PixyDust has pages for third-party AI models, including GPT Image 2, Nano Banana 2.0 Pro, Seedream 5.0 Pro, Kling 3.0, Google Veo 3, Seedance 2.0 and Wan 3.0.', 'site navigation', 'approved', 60),

-- ── pricing & credits ─────────────────────────────────────────────────────
('pricing.credits', 'pricing', 'PixyDust runs on credits. Each generation costs a set number of credits, shown before you generate.', '/credits', 'approved', 70),
('pricing.signup', 'pricing', 'New accounts get 5 free credits.', '/auth/sign-in', 'approved', 71),
('pricing.referral', 'pricing', 'A friend who signs up through your invite gets 10 credits. Each account can invite up to 5 people.', '/invite', 'approved', 72),
('pricing.top-up', 'pricing', 'Credits can be bought in any amount from $5 to $100 at the starter rate of 12.5 credits per dollar.', '/credits', 'approved', 73),
('pricing.stripe', 'pricing', 'Payments are processed by Stripe.', '/credits', 'approved', 74),
('pricing.plans', 'pricing', 'UNCONFIRMED, do not state: subscription plan names, prices, monthly credits and the subscriber discount. They are set in the database and not documented.', '/credits', 'needs_review', 75),
('pricing.expiry', 'pricing', 'CONFLICT, do not state: whether credits expire. The Help Center says top-up credits never expire; the Terms say add-on credits expire after 90 days and subscription credits do not roll over.', '/support vs /legal/terms', 'needs_review', 76),
('pricing.refunds', 'pricing', 'CONFLICT, do not state: refund rules. The Help Center says failed or blocked runs are refunded automatically; the Terms make it discretionary.', '/support vs /legal/terms', 'needs_review', 77),
('pricing.referrer-reward', 'pricing', 'CONFLICT, do not state: whether the person who sends an invite also earns credits. The Help Center says yes; the invite page and the code give credits to the new user only.', '/support vs /invite', 'needs_review', 78),

-- ── policy ────────────────────────────────────────────────────────────────
('policy.age', 'policy', 'PixyDust is for adults 18 and over.', '/legal/terms', 'approved', 80),
('policy.consent', 'policy', 'Uploading photos of another real person requires that person''s consent.', '/support, /legal/acceptable-use', 'approved', 81),
('policy.prohibited', 'policy', 'The Acceptable Use Policy bans sexual content involving minors, non-consensual intimate imagery and deepfake fraud.', '/legal/acceptable-use', 'approved', 82),
('policy.providers', 'policy', 'Generations are processed by third-party AI providers.', '/legal/privacy', 'approved', 83),
('policy.retention', 'policy', 'Your generations are kept until you delete them.', '/legal/privacy', 'approved', 84),
('policy.ownership', 'policy', 'PixyDust does not claim ownership of what you create, and the Terms allow commercial use.', '/legal/terms', 'approved', 85),
('policy.training', 'policy', 'CONFLICT, do not state: whether uploads are used to train models. The Privacy Policy says not by default; Terms section 6.1 says user content may be used to develop and train.', '/legal/privacy vs /legal/terms', 'needs_review', 86),
('policy.watermark', 'policy', 'UNCONFIRMED, do not state: whether outputs carry a watermark.', '/legal/terms', 'needs_review', 87)
ON CONFLICT(id) DO NOTHING;
