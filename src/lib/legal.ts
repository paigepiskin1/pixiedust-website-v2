// Legal document content (designed example copy — replace with counsel-approved
// text before launch). Rendered by LegalLayout.astro.

// `h` = a numbered sub-heading (e.g. "12.5 Credit Expiration and Rollover").
// `clauses` = lettered/roman sub-clauses that carry their own "(a)" markers, so
// they render without bullets to keep the legal numbering authoritative.
export type LegalNode =
  | string
  | { list: string[] }
  | { note: string }
  | { h: string }
  | { clauses: string[] };
export interface LegalSection {
  id: string;
  title: string;
  body: LegalNode[];
}
export interface LegalDoc {
  current: "terms" | "privacy" | "au";
  kicker: string;
  title: string;
  subtitle: string;
  lastUpdated: string;
  /** Titles already carry their own numbering — suppress the auto "§ 01" marker. */
  numbered?: boolean;
  sections: LegalSection[];
}

// TERMS lives in ./legal-terms.ts (verbatim counsel-supplied document).

export const PRIVACY: LegalDoc = {
  current: "privacy",
  kicker: "Legal · what we collect, what we do with it",
  title: "Privacy Policy",
  subtitle:
    "We try to collect as little as we can. This policy is the long version — the short version is in your Account → Privacy & data tab, where you can flip anything off.",
  lastUpdated: "May 12, 2026",
  sections: [
    {
      id: "collect",
      title: "What we collect",
      body: [
        "We collect three buckets of data: account, content, and usage.",
        {
          list: [
            "Account: email, OAuth identifiers (Apple ID, Google sub), Stripe customer ID, display name, avatar.",
            "Content: photos and prompts you upload; generations you produce; metadata about each generation (template, engine, cost, duration).",
            "Usage: events about how you navigate the Service — page views, button clicks, generation success/failure.",
          ],
        },
      ],
    },
    {
      id: "use",
      title: "How we use it",
      body: [
        "To run the Service: store your work, sync across devices, run generations through AI providers, debit credits accurately, send receipts.",
        "To improve the Service: aggregate analytics on which tools are used, which generations succeed, which UIs convert. Never tied back to your face or content.",
        { note: "We do not sell your data. Ever. Full stop." },
      ],
    },
    {
      id: "training",
      title: "Training & AI providers",
      body: [
        "We do not train models on your face or private generations by default. If you opt in via Account → Privacy & data, we use a privacy-preserving pipeline (face-redacted samples) to improve template quality.",
        "When you run a generation, the input image and prompt are sent to a third-party AI provider via SyncNode. These providers handle data under their own privacy policies. We delete the cached copy from their side within 24 hours where we have control.",
      ],
    },
    {
      id: "rights",
      title: "Your rights",
      body: [
        "You can, at any time:",
        {
          list: [
            "See everything we have on you (Account → Privacy → Request full export).",
            "Delete your account and all associated data (Account → Profile → Delete).",
            "Opt out of any non-essential cookies and analytics.",
            "File a GDPR or CCPA request via the form in Account → Privacy.",
          ],
        },
      ],
    },
    {
      id: "cookies",
      title: "Cookies & similar tech",
      body: [
        "We use exactly three cookies: session, theme preference, and feature-flag identifier. We do not use ad-targeting cookies. No third-party trackers run on pixydust.com.",
      ],
    },
    {
      id: "retention",
      title: "Data retention",
      body: [
        "Account data is kept while your account is active. Generations are kept until you delete them. After account deletion, we keep minimal billing records for 7 years to comply with tax law; everything else is purged within 30 days.",
      ],
    },
    {
      id: "contact-p",
      title: "Contact our DPO",
      body: ["For anything privacy-related: legal@pixydust.com. Our DPO responds within 14 business days."],
    },
  ],
};

export const ACCEPTABLE_USE: LegalDoc = {
  current: "au",
  kicker: "Legal · what you can — and can't — make",
  title: "Acceptable Use Policy",
  subtitle:
    "What follows is non-negotiable. Violating this policy gets your account suspended without refund, and in some cases reported to authorities.",
  lastUpdated: "May 12, 2026",
  sections: [
    {
      id: "principle",
      title: "The principle",
      body: [
        "PixyDust exists to help creators make beautiful, original work. We block uses that cause real-world harm to real-world people, that infringe other creators' rights, or that put us legally at risk.",
        { note: "Rule of thumb: if you wouldn't be comfortable explaining what you made to a friend over coffee, don't make it here." },
      ],
    },
    {
      id: "people",
      title: "Real people",
      body: [
        "You may generate your own likeness freely. You may generate other people's likeness only if:",
        { list: ["You have their written consent, and", "The content is non-explicit, non-misleading, and they're aware of the intended use."] },
        "Public figures may not be depicted in misleading contexts — fake quotes, fake events, fake endorsements. Editorial commentary and parody are allowed if clearly labeled.",
      ],
    },
    {
      id: "csam",
      title: "Minors & exploitation",
      body: [
        "Generation of CSAM (child sexual abuse material) is absolutely prohibited and will result in immediate account termination, content reporting to NCMEC, and notification of law enforcement.",
        "Any sexualized generation involving real people requires that person's documented written consent and that they are 18+. We hash-match against known consent-violation datasets at upload time.",
      ],
    },
    {
      id: "harm",
      title: "Harm & misuse",
      body: [
        "You may not use the Service to:",
        {
          list: [
            "Create non-consensual intimate imagery of anyone.",
            "Make material that incites violence, harassment, or hatred against a person or group.",
            "Generate content that promotes self-harm, suicide, or eating disorders.",
            "Build deepfake fraud materials — synthetic ID documents, fake passports, voice clones for scams.",
            "Train models that bypass our safety filters, or reproduce models from our outputs.",
          ],
        },
      ],
    },
    {
      id: "ip",
      title: "Copyright & trademarks",
      body: [
        "You're responsible for the rights to anything you upload. Don't upload other artists' work as input, don't prompt for a living artist's \"in the style of\" output and pass it off commercially, don't generate brand logos or trademarked characters for use you don't have a license for.",
        'We respond to DMCA notices at dmca@pixydust.com. We honor "do not train on my work" requests for any work whose rightsholder writes to us.',
      ],
    },
    {
      id: "security",
      title: "Security & abuse",
      body: [
        "No probing, scraping, or attempts to circumvent rate limits or safety filters. No reverse-engineering the AI pipeline. No automated account creation. Bug reports welcome at legal@pixydust.com under our responsible-disclosure policy.",
      ],
    },
    {
      id: "enforcement",
      title: "Enforcement",
      body: [
        "Violations are caught by a mix of automated classifiers and human review. Consequences scale: warning → temporary suspension → permanent ban. Severe violations are immediate permanent bans with no refund and, where applicable, law-enforcement referral.",
        "Disputes: write to support@pixydust.com within 30 days of a suspension. A human will review.",
      ],
    },
  ],
};
