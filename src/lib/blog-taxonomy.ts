// Blog taxonomy: one primary category and a small set of standardised tags per
// post, derived automatically from the text so editors do not have to tag every
// article by hand. Relevance for "Related articles" is computed from these.
//
// Everything here is deliberately deterministic — the same text always yields
// the same category and tags. That matters because recommendations are computed
// at request time: a classifier that drifted would make a page's own "related"
// list change under it without an edit.

export interface Category {
  id: string;
  label: string;
}

/** Primary categories. The first six are the agreed editorial set; `ar-work`
 *  and `press` were added because the blog also holds 22 AR case studies and
 *  20 press mentions, which would otherwise be forced into editorial buckets
 *  and pollute every recommendation list. */
export const CATEGORIES: Category[] = [
  { id: "brand", label: "Brand & Company" },
  { id: "beauty", label: "Beauty & Styling" },
  { id: "ai-creation", label: "AI Creation" },
  { id: "filmmaking", label: "Filmmaking" },
  { id: "social", label: "Social Content" },
  { id: "privacy", label: "Privacy & Responsible Use" },
  { id: "ar-work", label: "AR Work" },
  { id: "press", label: "Press & Recognition" },
];

export const CATEGORY_IDS = CATEGORIES.map((c) => c.id);
export const categoryLabel = (id: string | null | undefined): string =>
  CATEGORIES.find((c) => c.id === id)?.label ?? "";

/** The controlled tag vocabulary. Free-text tags still work — an editor can
 *  type anything — but only these are ever suggested, so the set stays small
 *  enough that "shares two tags" actually means something. */
export const TAGS = [
  "brand history", "AR", "iPhone", "hair", "makeup", "nails", "tattoo",
  "photoshoots", "AI video", "AI models", "previsualization", "micro-drama",
  "character development", "storytelling", "photo privacy", "workflow",
  "social AR", "music", "fashion", "retail", "interview", "celebrity",
  "beauty tech", "branded content", "VFX",
] as const;

/** Words that appear across most of the blog and therefore carry no signal.
 *  Without this, "AI" alone would make every article related to every other. */
const GENERIC = new Set([
  "ai", "creative", "creativity", "creator", "creators", "pixydust", "pixiedust",
  "content", "digital", "new", "how", "why", "what", "the", "and", "with", "for",
]);

export const isGenericTerm = (term: string): boolean => GENERIC.has(term.trim().toLowerCase());

interface Rule {
  /** Matched against title + excerpt + body text, case-insensitive. */
  test: RegExp;
  category?: string;
  tags?: string[];
  /** Extra weight for an unambiguous signal, e.g. a named brand campaign. */
  weight?: number;
}

/** Keyword → topic mapping. Ordered for readability only; all rules are scored.
 *  Patterns use word boundaries so "art" does not match "started". */
const RULES: Rule[] = [
  // ── Press & recognition ──────────────────────────────────────────────
  { test: /\b(i-?D|Grazia|Dazed|Adobe|FLANNELS|Netimperative|Chief Marketer|BRICKS|Evening Standard|BeautyMatter|Forbes|AR Insider|Digiday|TheWrap|Business Insider)\b/i, category: "press", tags: ["interview"], weight: 3 },
  { test: /\b(profiles|interviews|covers|reports on|documents|credits|features|examines|includes|discusses|names)\b.{0,40}\bPaige\b/i, category: "press", weight: 2 },
  { test: /\b(Elon Musk|Kim Kardashian|Dua Lipa|Kendall Jenner|Grimes)\b/i, category: "press", tags: ["celebrity"], weight: 2 },

  // ── AR case studies ──────────────────────────────────────────────────
  { test: /\b(Bratz|Coldplay|NYX|OPI|Coachella|Ashnikko|Netflix|Bella Poarch|Samsung 837|Walmart|Snap(chat)?)\b/i, category: "ar-work", tags: ["social AR"], weight: 3 },
  { test: /\b(lens|effect|filter)\b/i, category: "ar-work", tags: ["AR"] },
  { test: /\b(Spark AR|Lens Studio|Instagram lens|Snapchat lens)\b/i, category: "ar-work", tags: ["social AR"], weight: 2 },
  { test: /\b(music video|debut campaign|festival)\b/i, tags: ["music"] },
  { test: /\b(retail|in-store|store)\b/i, tags: ["retail"] },
  { test: /\b(fashion universe|fashion)\b/i, tags: ["fashion"] },

  // ── Brand & company ──────────────────────────────────────────────────
  { test: /\b(rebrand|becomes PixyDust|story behind the name|next chapter|why we built)\b/i, category: "brand", tags: ["brand history"], weight: 3 },
  { test: /\b(400 billion|3 billion|AR views|our story|the early AR effect)\b/i, category: "brand", tags: ["brand history"], weight: 2 },
  // The origin story mentions the original filter, so the generic "filter"
  // rule would otherwise file it as an AR case study rather than brand history.
  { test: /pixie ?dust\b.{0,40}\bto pixydust|became a creative platform|behind the pixydust story/i, category: "brand", tags: ["brand history"], weight: 4 },
  { test: /\bfrom AR to AI\b/i, category: "brand", tags: ["brand history", "AR"], weight: 2 },
  { test: /\b(iPhone|iOS|camera app|photo editing)\b/i, tags: ["iPhone"], weight: 2 },

  // ── Beauty & styling ─────────────────────────────────────────────────
  { test: /\b(hair ?styles?|hair colou?rs?|hair studio|haircut)\b/i, category: "beauty", tags: ["hair"], weight: 3 },
  { test: /\b(makeup|cosmetics|lipstick|eyeliner)\b/i, category: "beauty", tags: ["makeup"], weight: 2 },
  { test: /\bbeauty tech\b/i, category: "beauty", tags: ["beauty tech"], weight: 3 },
  { test: /\bAR beauty|AI beauty|digital beauty\b/i, category: "beauty", tags: ["beauty tech", "AR"], weight: 2 },
  { test: /\bnail ?(lacquer|lens|art)?\b/i, tags: ["nails"] },
  { test: /\btattoo\b/i, tags: ["tattoo"] },

  // ── AI creation ──────────────────────────────────────────────────────
  { test: /\bAI photoshoots?\b/i, category: "ai-creation", tags: ["photoshoots"], weight: 3 },
  { test: /\bAI video\b/i, category: "ai-creation", tags: ["AI video"], weight: 3 },
  { test: /\b(choose the right AI model|AI model|which model)\b/i, category: "ai-creation", tags: ["AI models"], weight: 2 },
  { test: /\b(prompting|prompt to|prompts)\b/i, category: "ai-creation", tags: ["AI video"] },
  { test: /\b(creative voice|without losing your)\b/i, category: "ai-creation", weight: 2 },
  { test: /\b(one creative workflow|creator stack|ten AI apps)\b/i, category: "ai-creation", tags: ["workflow"], weight: 2 },
  { test: /\bworkflow\b/i, tags: ["workflow"] },

  // ── Filmmaking ───────────────────────────────────────────────────────
  { test: /\b(previsualization|previs|see a scene before)\b/i, category: "filmmaking", tags: ["previsualization"], weight: 3 },
  { test: /\b(micro-?drama)\b/i, category: "filmmaking", tags: ["micro-drama"], weight: 3 },
  { test: /\b(character (development|arc)|build characters)\b/i, category: "filmmaking", tags: ["character development"], weight: 3 },
  { test: /\b(cinematic|60-second story|script to screen|independent film|feature film|filmmakers?|moviemaking)\b/i, category: "filmmaking", tags: ["storytelling"], weight: 2 },
  { test: /\b(hook|turn|cliffhanger|story structure|serialized)\b/i, category: "filmmaking", tags: ["storytelling"], weight: 2 },
  { test: /\b(visual world|world ?building|before you shoot)\b/i, category: "filmmaking", tags: ["previsualization"], weight: 2 },
  { test: /\b(VFX|virtual production)\b/i, category: "filmmaking", tags: ["VFX"], weight: 2 },

  // ── Social content ───────────────────────────────────────────────────
  // "social content" in a headline is an explicit statement of category and
  // must outrank the storytelling vocabulary these posts share with filmmaking.
  { test: /\bsocial content\b/i, category: "social", weight: 4 },
  { test: /\b(short-?form|long-?form|30 pieces)\b/i, category: "social", tags: ["storytelling"], weight: 2 },
  { test: /\bbranded content\b/i, category: "social", tags: ["branded content"], weight: 3 },
  { test: /\b(social creators?|social platforms?)\b/i, category: "social" },

  // ── Privacy ──────────────────────────────────────────────────────────
  { test: /\b(privacy|your photos|data (retention|storage)|what happens to your)\b/i, category: "privacy", tags: ["photo privacy"], weight: 3 },
  { test: /\b(responsible|consent|moderation)\b/i, category: "privacy" },
];

export interface Classification {
  category: string | null;
  tags: string[];
}

/** Derive a primary category and tags from an article's own text.
 *
 *  Title and excerpt are weighted above the body: a word in the headline is a
 *  statement of topic, the same word buried in paragraph nine usually is not.
 *  Only the first ~4k characters of the body are considered, which is well past
 *  the point where a post has established what it is about and keeps this cheap
 *  enough to run on every save. */
export function classify(title: string, excerpt: string, bodyText: string): Classification {
  const head = `${title || ""} ${excerpt || ""}`;
  const body = (bodyText || "").slice(0, 4000);

  const headCats = new Map<string, number>();
  const bodyCats = new Map<string, number>();
  const tags = new Set<string>();

  for (const rule of RULES) {
    const inHead = rule.test.test(head);
    const inBody = rule.test.test(body);
    if (!inHead && !inBody) continue;
    const weight = rule.weight ?? 1;

    if (rule.category) {
      if (inHead) headCats.set(rule.category, (headCats.get(rule.category) ?? 0) + weight);
      else bodyCats.set(rule.category, (bodyCats.get(rule.category) ?? 0) + weight);
    }

    // Tags follow the same discipline as the category. A passing mention of
    // "makeup" in paragraph nine of a filmmaking piece is not a topic, so a
    // body-only match has to come from a high-confidence rule to count.
    if (inHead || weight >= 3) rule.tags?.forEach((t) => tags.add(t));
  }

  // The headline decides. An article's title and excerpt are a statement of
  // what it is about; its body will mention half the blog's vocabulary in
  // passing. Scoring both together let a beauty-heavy body outvote a title
  // that plainly said "From AR to AI", which is how brand-history posts ended
  // up filed under beauty. Body categories are consulted only when the
  // headline is silent.
  const source = headCats.size ? headCats : bodyCats;
  let category: string | null = null;
  let best = 0;
  for (const [id, score] of source) {
    if (score > best) { best = score; category = id; }
  }

  return {
    category,
    // Cap at six: beyond that a tag set stops discriminating between posts.
    tags: [...tags].filter((t) => !isGenericTerm(t)).slice(0, 6),
  };
}
