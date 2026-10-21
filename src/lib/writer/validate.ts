// Deterministic checks on a writer draft. These run on every draft, before
// the review panel shows it and again before it is saved into an item, and
// they don't depend on a model agreeing: a banned character is found by
// searching for it.
import type { Brief, Draft, Issue, LinkSuggestion, Research, ReviewEdits } from "./types";
import { articleText, blockLabel, blockText, plain } from "./render";
import { slugify } from "../blog";

// Words and phrases the style rules ban. Matched as whole words, any case.
const BANNED = [
  "unlock", "unleash", "elevate", "empower", "delve", "dive in", "dive into", "showcase", "testament", "tapestry",
  "realm", "robust", "game-changer", "game-changing", "game changer", "next-level", "next level", "seamless",
  "seamlessly", "cutting-edge", "cutting edge", "revolutionary", "revolutionize", "revolutionizes", "transformative",
  "ai-powered", "next-generation", "next generation", "ultimate", "effortless", "effortlessly", "stunning",
  "breathtaking", "masterpiece", "masterpieces", "supercharge", "harness", "streamline", "fast-paced",
  "ever-evolving", "world-class", "industry-leading", "look no further", "without further ado",
  "in this article", "let's dive", "here's the thing", "i hope this helps", "happy creating", "feel free to",
  "at its core", "the possibilities are endless", "the future looks bright", "whether you're a beginner",
  "in order to", "due to the fact that", "it is important to note",
];
const GENERIC_CTA = /^(get started|learn more|try now|try it now|explore|discover|click here|here|read more)$/i;

// Leftovers that must never reach a page: evidence ids, bracketed notes,
// placeholders, model chatter.
const LEAKS: { re: RegExp; what: string }[] = [
  { re: /\[(?:todo|tk|tbd|insert|placeholder|source|citation|cite|link|image|note)[^\]]*\]/i, what: "a bracketed placeholder" },
  { re: /\b(?:TODO|TBD|FIXME|lorem ipsum)\b/i, what: "a placeholder word" },
  { re: /\b(?:S\d{1,2}|A\d{1,2})\b(?=[\],)])/, what: "an evidence id" },
  { re: /\b(?:tool|brand|pricing|policy|surfaces)\.[a-z-]+(?:\.[a-z-]+)?\b/, what: "a fact id" },
  { re: /\b(?:item-\d+|page-[a-z]+|section-[a-z]+(?:-[a-z]+)*|help-[a-z0-9]+-[a-z0-9-]+)\b/, what: "a link id" },
  { re: /\bas an ai\b|\blanguage model\b/i, what: "model chatter" },
  { re: /note to (?:the )?editor|editor'?s note|\(source:|\(evidence/i, what: "an editorial note" },
];

const words = (s: string) => s.split(/\s+/).filter(Boolean);
const count = (hay: string, needle: string) => {
  if (!needle.trim()) return 0;
  const re = new RegExp(`\\b${needle.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+")}\\b`, "gi");
  return (hay.match(re) || []).length;
};

/** Every piece of text the reader sees, labeled the way the audit labels it. */
export function labeledParts(d: Draft, e: ReviewEdits = {}): { where: string; text: string }[] {
  return [
    { where: "title", text: e.title ?? d.title },
    { where: "seo_title", text: e.seo_title ?? d.seo_title },
    { where: "meta", text: e.meta_description ?? d.meta_description },
    { where: "excerpt", text: e.excerpt ?? d.excerpt },
    ...d.blocks.map((b, i) => ({ where: blockLabel(i), text: blockText(b) })),
    { where: "next", text: plain(d.next_step?.text ?? "") },
  ];
}

export interface ValidateContext {
  brief: Brief;
  research: Research | null;
  /** Slugs already used by other items. */
  takenSlugs: Set<string>;
  /** Link target ids that resolve right now. */
  liveTargets: Map<string, { url: string; title: string }>;
  selfTargetId: string | null;
  links: LinkSuggestion[];
}

export function validateDraft(d: Draft, e: ReviewEdits, ctx: ValidateContext): Issue[] {
  const issues: Issue[] = [];
  const add = (level: Issue["level"], code: string, message: string, where?: string) => issues.push({ level, code, message, where });
  const parts = labeledParts(d, e);
  const body = articleText(d);
  const bodyWords = words(body).length;

  // ── punctuation and banned language (antislop R-02, R-16, R-36) ──────────
  for (const p of parts) {
    if (/[—–]|\s--\s/.test(p.text)) add("error", "dash", "Em or en dash. The style rules ban it; use a period, comma, colon or parentheses.", p.where);
    const lower = p.text.toLowerCase();
    for (const w of BANNED) {
      if (new RegExp(`(^|[^a-z])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`).test(lower)) {
        add("warn", "banned-word", `Banned phrase "${w}".`, p.where);
      }
    }
    if (/\b[A-Z]{4,}(?:\s+[A-Z]{2,}){2,}\b/.test(p.text)) add("warn", "all-caps", "All-caps emphasis.", p.where);
    if (/\p{Extended_Pictographic}/u.test(p.text)) add("warn", "emoji", "Emoji in the text.", p.where);
    for (const l of LEAKS) {
      if (l.re.test(p.text)) add("error", "leak", `Contains ${l.what}; drafting material must not reach the page.`, p.where);
    }
  }
  const boldCount = (d.blocks.map((b) => [b.text, ...b.items].join(" ")).join(" ").match(/\*\*[^*]+\*\*/g) || []).length;
  if (boldCount > 4) add("warn", "bold", `Bold used ${boldCount} times; keep it to a few.`);

  // ── brand naming ─────────────────────────────────────────────────────────
  for (const p of parts) {
    if (/\bPixy\s+Dust\b|\bPixydust\b|\bPIXYDUST\b|\bPixyDUST\b/.test(p.text)) {
      add("error", "brand-spelling", 'Brand misspelled. It is "PixyDust".', p.where);
    }
    const old = p.text.match(/[^.!?]*\bPixie\s?Dust\b[^.!?]*/gi) || [];
    for (const sentence of old) {
      if (!/\b(former|formerly|originally|original|began|started|ar filter|filter|renamed|became|evolved|history|2019|2025|creator studio|was called|used to)\b/i.test(sentence)) {
        add("error", "brand-old-name", `"PixieDust/Pixie Dust" used outside the brand's history: "${sentence.trim().slice(0, 90)}"`, p.where);
      }
    }
  }
  if (/\b(download|install)\b[^.]{0,40}\b(app|application)\b|\bapp store\b|\bgoogle play\b/i.test(body)) {
    add("error", "mobile-claim", "Tells readers to download or install an app. PixyDust has no store listing to point to.");
  }

  // ── structure: one H1 (the title), H2/H3 hierarchy, a next step ──────────
  const h2s = d.blocks.filter((b) => b.type === "h2");
  if (h2s.length < 3) add("warn", "structure", `Only ${h2s.length} H2 sections; expected at least 3.`);
  let seenH2 = false;
  d.blocks.forEach((b, i) => {
    if (b.type === "h2") seenH2 = true;
    if (b.type === "h3" && !seenH2) add("error", "heading-order", "An H3 appears before any H2.", blockLabel(i));
    if ((b.type === "ul" || b.type === "ol") && b.items.filter((t) => t.trim()).length < 2) add("warn", "list", "A list block with fewer than 2 items.", blockLabel(i));
    if (b.type === "p" && !b.text.trim()) add("warn", "empty", "Empty paragraph.", blockLabel(i));
    if (/^#{1,6}\s|<\/?[a-z][^>]*>/i.test(b.text)) add("error", "markup", "Markup inside block text.", blockLabel(i));
  });
  if (d.blocks[0] && d.blocks[0].type !== "p") add("warn", "intro", "The article should open with a paragraph, not a heading or list.");
  if (bodyWords < 700) add("warn", "length", `Body is ${bodyWords} words; that is thin for an article.`);
  if (bodyWords > 2600) add("warn", "length", `Body is ${bodyWords} words; consider cutting.`);

  const ns = d.next_step;
  if (!ns?.text?.trim()) add("error", "next-step", "No next step at the end of the article.");
  else {
    if (!ctx.liveTargets.has(ns.link_id)) add("error", "next-step-link", `The next step links to "${ns.link_id}", which is not a live page.`, "next");
    if (!ns.anchor?.trim() || plain(ns.text).toLowerCase().indexOf(ns.anchor.trim().toLowerCase()) < 0) {
      add("error", "next-step-anchor", "The next step's link text is not in its sentence.", "next");
    } else if (GENERIC_CTA.test(ns.anchor.trim())) {
      add("warn", "cta", `Generic call to action "${ns.anchor}". Name the action.`, "next");
    }
  }

  // ── SEO fields ───────────────────────────────────────────────────────────
  const title = (e.title ?? d.title).trim();
  const seoTitle = (e.seo_title ?? d.seo_title).trim();
  const meta = (e.meta_description ?? d.meta_description).trim();
  const excerpt = (e.excerpt ?? d.excerpt).trim();
  const slug = slugify(e.slug ?? d.slug);
  if (!title) add("error", "title", "No title.");
  if (title.length > 70) add("warn", "title", `Title is ${title.length} characters; search results cut it near 60.`, "title");
  if (seoTitle.length > 60) add("warn", "seo-title", `SEO title is ${seoTitle.length} characters (aim for 60 or fewer).`, "seo_title");
  if (meta.length < 110 || meta.length > 160) add("warn", "meta", `Meta description is ${meta.length} characters (aim for 120 to 160).`, "meta");
  if (!excerpt) add("warn", "excerpt", "No excerpt.", "excerpt");
  if (excerpt.length > 220) add("warn", "excerpt", `Excerpt is ${excerpt.length} characters.`, "excerpt");
  if (!slug || slug === "post") add("error", "slug", "No usable slug.");
  else if (ctx.takenSlugs.has(slug)) add("error", "slug-taken", `The slug "${slug}" is already used by another item. Choose another.`, "slug");
  if (slug.length > 75) add("warn", "slug", "Slug is long.");
  const tags = e.tags ?? d.tags;
  if (tags.length < 2 || tags.length > 8) add("warn", "tags", `${tags.length} tags; 3 to 6 work best.`);

  // Keyword placement and stuffing. Counted on the reader's text, not raw.
  const kw = ctx.brief.primaryKeyword.trim();
  if (kw) {
    const first100 = words(body).slice(0, 100).join(" ");
    if (count(title, kw) === 0 && count(seoTitle, kw) === 0) add("warn", "keyword", `Primary keyword "${kw}" is not in the title or SEO title.`);
    if (count(first100, kw) === 0) add("warn", "keyword", `Primary keyword "${kw}" is not in the first 100 words.`);
    const n = count(body, kw);
    const density = bodyWords ? (n * words(kw).length * 100) / bodyWords : 0;
    if (density > 2.5) add("error", "stuffing", `Primary keyword appears ${n} times (${density.toFixed(1)}% of words). That reads as keyword stuffing.`);
  }
  for (const k of ctx.brief.keywords) {
    const n = count(body, k);
    const density = bodyWords ? (n * words(k).length * 100) / bodyWords : 0;
    if (density > 2) add("warn", "stuffing", `"${k}" appears ${n} times (${density.toFixed(1)}%).`);
  }

  // ── numbers must come from the evidence ──────────────────────────────────
  // A figure in the article that appears nowhere in the facts or sources is
  // either invented or unverifiable. Ordinals and list positions are ignored.
  if (ctx.research) {
    const evidence = [
      ...ctx.research.facts.filter((f) => f.status === "approved").map((f) => f.statement),
      ...ctx.research.adminFacts.map((f) => f.statement),
      ...ctx.research.sources.map((s) => s.text ?? ""),
      ctx.brief.topic, ctx.brief.instructions, ctx.brief.outline,
    ].join(" ").toLowerCase().replace(/,(?=\d{3})/g, "");
    const seen = new Set<string>();
    for (const p of parts) {
      const nums = p.text.match(/\$?\d[\d,]*(?:\.\d+)?\s?(?:%|percent|x\b|k\b|m\b|b\b|million|billion)?/gi) || [];
      for (const raw of nums) {
        const n = raw.toLowerCase().replace(/,(?=\d{3})/g, "").trim();
        const digits = n.replace(/[^\d.]/g, "");
        if (!digits || /^[1-9]$/.test(digits) || seen.has(n)) continue;
        seen.add(n);
        if (!evidence.includes(digits)) add("warn", "number", `"${raw.trim()}" is not in the evidence. Check it or remove it.`, p.where);
      }
    }
  }

  // Testimonial shapes: a quotation with an attribution.
  if (/[“"][^”"]{20,}[”"]\s*[,—-]?\s*(?:says|said|—|-)\s*[A-Z][a-z]+/.test(body)) {
    add("error", "testimonial", "Looks like a quotation attributed to a person. Testimonials need a real, approved source.");
  }

  // ── internal links ───────────────────────────────────────────────────────
  for (const l of ctx.links.filter((x) => x.state === "accepted")) {
    if (!ctx.liveTargets.has(l.target)) add("error", "link-dead", `Link "${l.anchor}" points at ${l.target}, which is not live.`, l.where);
    if (ctx.selfTargetId && l.target === ctx.selfTargetId) add("error", "link-self", `Link "${l.anchor}" points at this article.`, l.where);
    if (l.problem) add("error", "link", `Link "${l.anchor}": ${l.problem}`, l.where);
  }
  const accepted = ctx.links.filter((x) => x.state === "accepted");
  const targets = accepted.map((l) => l.target);
  if (new Set(targets).size !== targets.length) add("warn", "link-repeat", "Two accepted links go to the same page.");

  // ── evidence the writer said it couldn't find ────────────────────────────
  for (const m of d.missing_evidence ?? []) {
    if (m.trim()) add("warn", "missing-evidence", `Writer had no evidence for: ${m.trim()}`);
  }

  return issues;
}
