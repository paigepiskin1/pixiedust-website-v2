// Help Center content. Rendered by the /help pages. Written as structured
// nodes (paragraphs, subheadings, lists, numbered steps, callouts) so the
// article layout can style each consistently. Keep copy accurate to the app:
// credits, Stripe billing, auto-refunded failed generations, tools/studios,
// reference @mentions, and real-person handling.

export type HelpNode =
  | string
  | { h: string }
  | { list: string[] }
  | { steps: string[] }
  | { note: string };

export interface HelpArticle {
  slug: string;
  title: string;
  summary: string;
  body: HelpNode[];
}

export interface HelpCategory {
  id: string;
  title: string;
  icon: string;
  blurb: string;
  articles: HelpArticle[];
}

const SUPPORT_EMAIL = "support@pixydust.com";
const BILLING_EMAIL = "billing@pixydust.com";

export const HELP_CATEGORIES: HelpCategory[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    icon: "rocket",
    blurb: "Create an account, spend your first credits, and make something.",
    articles: [
      {
        slug: "what-is-pixydust",
        title: "What is PixyDust?",
        summary: "A quick tour of the studio and what you can make with it.",
        body: [
          "PixyDust is an AI creative studio for making images and videos. Instead of wiring up each AI model yourself, you pick a tool or template, add a prompt and optional reference photos, and hit Generate — we route it to the right model and hand back the result.",
          { h: "What you can make" },
          {
            list: [
              "Images — presets, photoshoots, headshots, fashion, beauty, and free-prompt generation.",
              "Video — cinematic clips, image-to-video, motion transfer, and the Movie Studio.",
              "AI Models — go straight to a specific model (Seedream, GPT Image, Seedance, Kling, Veo, and more).",
            ],
          },
          { note: "New here? Start on the Home page, pick any tool under Tools, and follow the on-screen fields. Every generation shows its credit cost before you run it." },
        ],
      },
      {
        slug: "create-an-account-and-sign-in",
        title: "How do I create an account and sign in?",
        summary: "Sign up with email or Google and claim your free credits.",
        body: [
          "You can create an account in under a minute — no card required to start.",
          {
            steps: [
              "Click Sign in (top-right) or open any tool and choose Sign in to generate.",
              "Continue with Google, or enter your email to get a verification link.",
              "Verify your email if prompted, and you're in.",
            ],
          },
          "New accounts start with free credits so you can try things right away. Your balance is always shown in the sidebar.",
          { note: "Use one account per person. If you're signed out unexpectedly, just sign in again with the same method you used originally." },
        ],
      },
      {
        slug: "your-first-generation",
        title: "How do I create my first generation?",
        summary: "From prompt to result in a few clicks.",
        body: [
          {
            steps: [
              "Open a tool or template (for example, Presets or Video).",
              "Fill in the fields — usually a prompt, and optionally one or more reference images.",
              "Choose your options: aspect ratio, duration (for video), quality, and how many outputs.",
              "Check the credit cost shown on the Generate button, then click Generate.",
              "Wait for the result to appear, then download it or reuse the prompt for another run.",
            ],
          },
          "Images usually take a few seconds; video can take up to a couple of minutes depending on the model and length.",
          { note: "If a generation fails, your credits are refunded automatically — you're never charged for a result you didn't get." },
        ],
      },
      {
        slug: "writing-a-good-prompt",
        title: "How do I write a good prompt?",
        summary: "Simple habits that dramatically improve your results.",
        body: [
          "A good prompt describes the subject, the setting, and the style — clearly and concretely.",
          {
            list: [
              "Lead with the subject: who or what is in frame.",
              "Add setting and lighting: location, time of day, mood.",
              "Name a style or camera: film stock, lens, color grade, or an artist/era reference.",
              "Keep it tidy: short, comma-separated phrases beat long run-on sentences.",
            ],
          },
          { h: "Using reference images" },
          "When a tool supports references, upload your photos and tag them in the prompt (e.g. \u201c@Image1 for the character, @Image2 for the background\u201d). Say what each reference controls.",
          { note: "Iterate. Generate, keep what works, and adjust one thing at a time." },
        ],
      },
      {
        slug: "free-credits",
        title: "How do I get free credits?",
        summary: "Where your starter credits come from and how to earn more.",
        body: [
          "Every new account starts with free credits. You can earn more by inviting friends.",
          {
            list: [
              "Sign-up bonus: free credits are added automatically when you create your account.",
              "Referrals: share your invite link — you and your friend both get credits when they join.",
            ],
          },
          "See the Invite friends page in the sidebar for your personal link and current referral rewards.",
        ],
      },
    ],
  },
  {
    id: "credits",
    title: "Credits",
    icon: "coin",
    blurb: "How credits work, what they cost, and whether they expire.",
    articles: [
      {
        slug: "how-credits-work",
        title: "How do credits work?",
        summary: "Credits are the single unit you spend on every generation.",
        body: [
          "Credits are the in-app currency you spend to generate images and video. Your balance shows in the sidebar and updates instantly after each run.",
          {
            list: [
              "Every tool shows the exact credit cost before you generate.",
              "Cost scales with the model, output count, quality tier, and (for video) length.",
              "Failed generations are refunded automatically.",
            ],
          },
          { note: "Out of credits? Top up any time from the Credits page — pick any amount that suits you." },
        ],
      },
      {
        slug: "what-uses-credits",
        title: "What uses my credits?",
        summary: "The factors that make one generation cost more than another.",
        body: [
          "The credit cost of a generation depends on a few things:",
          {
            list: [
              "Model — premium image and video models cost more than lightweight ones.",
              "Quantity — generating 2 or 4 outputs multiplies the cost.",
              "Quality/resolution tier — higher tiers cost more.",
              "Video length — video bills per second, so longer clips cost more.",
            ],
          },
          "The number on the Generate button is always the final cost for the current settings, so you can adjust before committing.",
        ],
      },
      {
        slug: "do-credits-expire",
        title: "Do my credits expire?",
        summary: "Top-up vs. subscription credits, and what happens if you cancel.",
        body: [
          {
            list: [
              "Top-up credits never expire — they stay in your balance until you use them.",
              "Subscription credits roll over for a limited window; older subscription credits are spent first.",
              "If you cancel a subscription, any purchased top-up credits remain yours.",
            ],
          },
          { note: "Not sure which kind you have? Your Credits page shows your balance; reach out if you'd like a breakdown." },
        ],
      },
      {
        slug: "top-up-credits",
        title: "How do I buy more credits?",
        summary: "Top up in seconds with a secure Stripe checkout.",
        body: [
          {
            steps: [
              "Open the Credits page from the sidebar (or the Top up shortcut).",
              "Choose an amount with the dial, or pick a preset pack.",
              "Continue to Stripe's secure checkout and pay.",
              "Your balance updates as soon as the payment succeeds.",
            ],
          },
          { note: "If your balance doesn't update within a minute of a successful payment, refresh the page — the webhook may still be catching up. Still stuck? Contact us." },
        ],
      },
    ],
  },
  {
    id: "billing",
    title: "Billing & Payments",
    icon: "card",
    blurb: "Payments, invoices, and fixing a failed charge.",
    articles: [
      {
        slug: "how-billing-works",
        title: "How does billing work?",
        summary: "Stripe handles payments; we keep your credit ledger.",
        body: [
          "All payments are processed securely by Stripe. We never see or store your full card details. Stripe is the source of truth for charges, and we maintain your credit balance.",
          {
            list: [
              "One-time top-ups add credits immediately after payment.",
              "Subscriptions renew automatically on their billing date until cancelled.",
              "Receipts are emailed by Stripe after each successful charge.",
            ],
          },
        ],
      },
      {
        slug: "payment-failed",
        title: "What should I do if my payment failed?",
        summary: "Common reasons a card is declined and how to fix it.",
        body: [
          "If a payment didn't go through, no credits are added and you're not charged. Try these steps:",
          {
            steps: [
              "Confirm the card details, expiry, and billing ZIP/postcode are correct.",
              "Check with your bank — many declines are a temporary fraud hold you can approve.",
              "Try a different card or payment method.",
              "Disable VPNs/ad-blockers that can interfere with the checkout, then retry.",
            ],
          },
          { note: `Still failing after that? Email ${BILLING_EMAIL} with the approximate time and amount and we'll help.` },
        ],
      },
      {
        slug: "download-invoice-or-receipt",
        title: "How do I download an invoice or receipt?",
        summary: "Get a copy of any charge for your records.",
        body: [
          "Stripe emails a receipt after every successful payment. To get another copy or a full invoice:",
          {
            list: [
              "Check your email inbox (and spam) for the Stripe receipt from your purchase.",
              `Need a formal invoice or a VAT/Tax ID added? Email ${BILLING_EMAIL} with the details and we'll issue one.`,
            ],
          },
        ],
      },
    ],
  },
  {
    id: "refunds",
    title: "Refunds",
    icon: "refund",
    blurb: "Failed-generation refunds, cancellations, and how to ask for help.",
    articles: [
      {
        slug: "failed-generation-refunds",
        title: "Do I get a refund if a generation fails?",
        summary: "Yes — failed generations are auto-refunded to credits.",
        body: [
          "If a generation fails, is cancelled, or gets blocked before producing a result, the credits are automatically returned to your balance. You'll usually see a note like \u201ccredits refunded \u2014 you weren't charged.\u201d",
          { note: "This is automatic. If you believe a failed run wasn't refunded, contact us with the approximate time and we'll make it right." },
        ],
      },
      {
        slug: "request-a-refund",
        title: "How do I request a refund?",
        summary: "When cash refunds apply and how to ask for one.",
        body: [
          "Failed generations are refunded in credits automatically. For a payment-level (cash) refund:",
          {
            steps: [
              `Email ${BILLING_EMAIL} from the address on your account.`,
              "Include the approximate date, amount, and reason.",
              "We'll review and respond, and process eligible refunds through Stripe.",
            ],
          },
          { note: "Cash refunds are for purchases; already-spent credits generally aren't refundable in cash. See our Terms for the full policy." },
        ],
      },
      {
        slug: "accidental-charge",
        title: "How do I get a refund for an accidental charge?",
        summary: "Duplicate or unexpected charge? Here's what to do.",
        body: [
          "If you see a charge you didn't expect — a duplicate, or a subscription renewal you meant to cancel — get in touch and we'll sort it out.",
          {
            list: [
              `Email ${BILLING_EMAIL} with the charge date and amount.`,
              "Let us know if it was a duplicate or an unwanted renewal.",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "tools",
    title: "Tools & Studios",
    icon: "grid",
    blurb: "Which tool to use, and what each studio is for.",
    articles: [
      {
        slug: "which-tool-should-i-use",
        title: "Which tool should I use?",
        summary: "A quick map of the tools and when to reach for each.",
        body: [
          { h: "For images" },
          {
            list: [
              "Presets — one-tap looks (film stocks, eras, color grades) applied to your photo.",
              "Photoshoots — themed multi-shot sets (headshots, editorial, lifestyle).",
              "Fashion Try-on, Beauty, Hair, Tattoo studios — targeted edits for a specific look.",
            ],
          },
          { h: "For video" },
          {
            list: [
              "Video — cinematic and image-to-video clips.",
              "Motion Transfer — apply motion from one clip to your subject.",
              "Movie Studio — multi-reference, prompt-tagged generation with image, video, and audio inputs.",
            ],
          },
          { note: "Want a specific model? Use the AI Models section to go straight to it." },
        ],
      },
      {
        slug: "using-studios",
        title: "How do the Studios work?",
        summary: "Beauty, Hair, Tattoo, Fashion, and Ad studios explained.",
        body: [
          "The Studios are focused tools that do one job well. Upload a photo, choose the look or settings, and generate.",
          {
            list: [
              "Beauty Studio — makeup and glow-up looks.",
              "Hair Studio — hairstyles and colors.",
              "Tattoo Studio — preview tattoo ideas on a photo.",
              "Fashion Try-on — swap outfits onto your subject.",
              "Ad Studio — product and marketing-style shots.",
            ],
          },
        ],
      },
      {
        slug: "movie-studio",
        title: "How do I use the Movie Studio?",
        summary: "Multi-reference video with image, video, and audio inputs.",
        body: [
          "The Movie Studio lets you combine multiple references and tag them in your prompt for precise control.",
          {
            steps: [
              "Upload your references — images, and optionally short video and audio clips.",
              "Tag them in the prompt as @Image1, @Video1, @Audio1… (numbered per type, in upload order).",
              "Describe what each reference controls, then choose your model, length, and aspect.",
              "Generate. Longer clips take more time and credits.",
            ],
          },
          { note: "Real people are supported — reference faces are registered automatically. Only upload media you have the rights and consent to use." },
        ],
      },
    ],
  },
  {
    id: "ai-models",
    title: "AI Models",
    icon: "cube",
    blurb: "Pick the right model and get the most from references.",
    articles: [
      {
        slug: "which-model-should-i-use",
        title: "Which AI model should I use?",
        summary: "A plain-language guide to the image and video models.",
        body: [
          "You can jump straight to a specific model from the AI Models section in the sidebar. Here's the short version:",
          { h: "Image models" },
          {
            list: [
              "Seedream — crisp, photoreal text-to-image with reference support.",
              "Nano Banana — natural-language photo editing and blending.",
              "GPT Image — strong prompt adherence and clean text rendering.",
            ],
          },
          { h: "Video models" },
          {
            list: [
              "Seedance — cinematic clips from a prompt or first frame.",
              "Kling — highly dynamic, physically believable motion.",
              "Google Veo — high quality with synchronized generated audio.",
              "Minimax / Wan — versatile, expressive motion at different tiers.",
            ],
          },
          { note: "Not sure? Start with the default for a tool. If the motion or detail isn't right, try a different model with the same prompt." },
        ],
      },
      {
        slug: "reference-images-and-mentions",
        title: "How do reference images and @mentions work?",
        summary: "Upload references and tag them in your prompt.",
        body: [
          "Many tools let you guide a generation with reference media. Upload your files, then reference them by tag in your prompt.",
          {
            list: [
              "Images are tagged @Image1, @Image2… in upload order.",
              "Where supported, video and audio use @Video1 and @Audio1.",
              "Say what each controls, e.g. \u201c@Image1 for the face, @Image2 for the outfit.\u201d",
            ],
          },
          { note: "Clear, well-lit references produce better results. Front-facing photos tend to work best for faces." },
        ],
      },
      {
        slug: "real-people-and-portraits",
        title: "Can I use photos of real people?",
        summary: "How real-person references are handled and what to upload.",
        body: [
          "Yes — tools that support it will register reference faces automatically so the model can use them. A few tips:",
          {
            list: [
              "Only upload photos of people who have consented, or of yourself.",
              "Use clear, well-lit, front-facing photos for the most reliable results.",
              "If a photo is rejected, try another angle or a higher-quality image.",
            ],
          },
          { note: "Some images may be blocked for safety, copyright, or moderation reasons. When that happens the generation is refunded — see Troubleshooting." },
        ],
      },
    ],
  },
  {
    id: "troubleshooting",
    title: "Troubleshooting",
    icon: "bug",
    blurb: "Fix stuck jobs, blocked content, and loading issues.",
    articles: [
      {
        slug: "generation-stuck-or-failed",
        title: "My generation is stuck or failed. What should I do?",
        summary: "What happens automatically, and how to retry.",
        body: [
          "First, the good news: if a generation fails, your credits are refunded automatically.",
          {
            steps: [
              "Give it a moment — video can take a couple of minutes.",
              "If it's clearly stuck or shows an error, refresh the page; finished results are saved to My Creations.",
              "Check your credit balance — a refund confirms the run failed.",
              "Try again, ideally with a slightly simpler prompt or a different model.",
            ],
          },
          { note: "Still failing repeatedly? Report it (see below) with the tool name and prompt so we can investigate." },
        ],
      },
      {
        slug: "content-flagged-nsfw",
        title: "Why was my content flagged?",
        summary: "Understanding safety flags and what to do about them.",
        body: [
          "Generations pass through safety checks. If content is flagged as unsafe, the run is stopped and your credits are refunded.",
          {
            list: [
              "Rework the prompt to avoid explicit or unsafe terms.",
              "Swap reference images that may have triggered the filter.",
              "Review our Acceptable Use policy for what's allowed.",
            ],
          },
          { note: "Believe a flag was a mistake? Contact us with the details and we'll take a look." },
        ],
      },
      {
        slug: "blocked-copyright-or-real-person",
        title: "Why was my generation blocked for copyright or a real person?",
        summary: "Common blocks around IP and real-person imagery.",
        body: [
          "Some requests are blocked when they involve protected characters/brands, or when a reference photo can't be verified for real-person use. The run is refunded when this happens.",
          {
            list: [
              "Avoid prompts that name trademarked characters, logos, or celebrities.",
              "For real people, upload clear, front-facing photos you have consent to use.",
              "If a specific reference is blocked, try a different, higher-quality image.",
            ],
          },
        ],
      },
      {
        slug: "site-wont-load",
        title: "The site won't load or looks broken. What can I do?",
        summary: "Quick fixes for loading and display issues.",
        body: [
          {
            steps: [
              "Hard refresh the page (Cmd/Ctrl + Shift + R).",
              "Try an incognito/private window to rule out extensions.",
              "Disable ad-blockers or VPNs that can block app requests.",
              "Check you're online and try a different browser or network.",
            ],
          },
          { note: "If it persists across browsers, let us know your device and browser so we can reproduce it." },
        ],
      },
      {
        slug: "report-a-bug",
        title: "How do I report a bug or request a feature?",
        summary: "Send it straight to the team.",
        body: [
          "We read everything. Use the Feedback page in the app, or email us.",
          {
            list: [
              "Feedback page — pick a topic (bug, feature request, billing, other) and describe it.",
              `Email — ${SUPPORT_EMAIL}. Screenshots and the steps to reproduce help a lot.`,
            ],
          },
        ],
      },
    ],
  },
  {
    id: "account",
    title: "Account",
    icon: "user",
    blurb: "Access, deletion, privacy, and ownership of your work.",
    articles: [
      {
        slug: "recover-access",
        title: "How do I recover access to my account?",
        summary: "Locked out? Here's how to get back in.",
        body: [
          "Sign in with the same method you originally used (Google or email).",
          {
            list: [
              "If you used email, request a fresh sign-in/verification link and check spam.",
              "If you used Google, make sure you're signing into the same Google account.",
              `Can't get in? Email ${SUPPORT_EMAIL} from your account address and we'll help verify and restore access.`,
            ],
          },
        ],
      },
      {
        slug: "delete-account",
        title: "How do I delete my account?",
        summary: "Permanently remove your account and data.",
        body: [
          "You can request permanent deletion of your account and associated data.",
          {
            steps: [
              `Email ${SUPPORT_EMAIL} from your account address with the subject \u201cDelete my account.\u201d`,
              "We'll confirm the request and process the deletion.",
            ],
          },
          { note: "Deletion is permanent and can't be undone. Any unused credits are forfeited on deletion." },
        ],
      },
      {
        slug: "privacy-gdpr-request",
        title: "How do I submit a privacy (GDPR/CCPA) request?",
        summary: "Access, export, or delete your personal data.",
        body: [
          `Send privacy requests — access, export, correction, or deletion — to ${SUPPORT_EMAIL}. Include enough detail for us to verify your identity. See our Privacy Policy for how we handle data.`,
        ],
      },
      {
        slug: "who-owns-my-generations",
        title: "Who owns my generations? Can I use them commercially?",
        summary: "Your rights to the images and videos you create.",
        body: [
          "You own the outputs you generate, and you're generally free to use them — including commercially — subject to our Terms and Acceptable Use policy and to the rights of any people or content in your references.",
          { note: "You're responsible for having the rights to any reference media you upload. Review our Terms for the full details." },
        ],
      },
    ],
  },
  {
    id: "referrals",
    title: "Referrals & Invites",
    icon: "gift",
    blurb: "Earn credits by inviting friends.",
    articles: [
      {
        slug: "how-referrals-work",
        title: "How do referrals work?",
        summary: "Share your link and you both earn credits.",
        body: [
          "Invite friends and you both get rewarded when they join.",
          {
            steps: [
              "Open Invite friends in the sidebar to get your personal link.",
              "Share it with a friend.",
              "When they sign up through your link, credits are added to both accounts.",
            ],
          },
          { note: "The Invite page always shows your current reward amount and how many friends have joined." },
        ],
      },
    ],
  },
];

export function getCategory(id: string): HelpCategory | undefined {
  return HELP_CATEGORIES.find((c) => c.id === id);
}

export function getArticle(
  categoryId: string,
  slug: string
): { category: HelpCategory; article: HelpArticle } | null {
  const category = getCategory(categoryId);
  const article = category?.articles.find((a) => a.slug === slug);
  return category && article ? { category, article } : null;
}

export interface ArticleRef {
  categoryId: string;
  categoryTitle: string;
  slug: string;
  title: string;
  summary: string;
}

export function allArticles(): ArticleRef[] {
  return HELP_CATEGORIES.flatMap((c) =>
    c.articles.map((a) => ({
      categoryId: c.id,
      categoryTitle: c.title,
      slug: a.slug,
      title: a.title,
      summary: a.summary,
    }))
  );
}

// Curated list shown under "Popular topics" on the landing page.
const POPULAR: [string, string][] = [
  ["getting-started", "what-is-pixydust"],
  ["getting-started", "your-first-generation"],
  ["credits", "how-credits-work"],
  ["credits", "do-credits-expire"],
  ["tools", "which-tool-should-i-use"],
  ["ai-models", "which-model-should-i-use"],
  ["troubleshooting", "generation-stuck-or-failed"],
  ["refunds", "failed-generation-refunds"],
];

export function popularArticles(): ArticleRef[] {
  const refs: ArticleRef[] = [];
  for (const [cat, slug] of POPULAR) {
    const found = getArticle(cat, slug);
    if (found) {
      refs.push({
        categoryId: found.category.id,
        categoryTitle: found.category.title,
        slug: found.article.slug,
        title: found.article.title,
        summary: found.article.summary,
      });
    }
  }
  return refs;
}

export function categoryHref(id: string): string {
  return `/support/${id}`;
}

export function articleHref(categoryId: string, slug: string): string {
  return `/support/${categoryId}/${slug}`;
}

export const HELP_SUPPORT_EMAIL = SUPPORT_EMAIL;
