// The internal-link inventory: every destination the writer may link to,
// each with a stable id. Ids, not URLs, go to the model and are stored on
// suggestions; they are resolved to canonical URLs at validation and render
// time, so a link can only ever point at a page that is live at that moment,
// and an item that moves section or changes slug still resolves.
import type { D1Database } from "@cloudflare/workers-types";
import { listPublished, excerptFor, tagsOf } from "../blog";
import { sectionsById, itemHref, listSections } from "../sections";
import { allArticles, articleHref } from "../help-db";
import type { LinkTarget } from "./types";

/** Public pages worth linking. Tools first: they're where a reader acts. */
const PAGES: { id: string; path: string; title: string; summary: string }[] = [
  { id: "page-shoots", path: "/shoots", title: "AI Photoshoots", summary: "Pick a photoshoot style and generate photos of yourself from up to 4 reference photos." },
  { id: "page-presets", path: "/presets", title: "Presets", summary: "Restyle one photo with a look: film stocks, decades, painters, cameras, color grades." },
  { id: "page-video", path: "/video", title: "Video", summary: "Short AI video clips: cinematic scenes, photo-to-life, runway, game openings." },
  { id: "page-motion", path: "/motion", title: "Motion Transfer", summary: "Copy the movement from a reference video onto your photo." },
  { id: "page-fashion", path: "/fashion", title: "Fashion Try-on", summary: "See yourself wearing a garment from a photo, or pick a look." },
  { id: "page-beauty", path: "/beauty", title: "Beauty Studio", summary: "Try makeup looks on your face from presets or a reference photo." },
  { id: "page-hair", path: "/hair", title: "Hair Studio", summary: "Try haircuts and colors on your photo while keeping your face." },
  { id: "page-tattoo", path: "/avatar", title: "Tattoo Studio", summary: "Preview fine-line tattoo designs on face, neck, arms or torso." },
  { id: "page-ad", path: "/ad", title: "Ad Studio", summary: "Product shots, UGC-style and lifestyle content and video in ad formats." },
  { id: "page-credits", path: "/credits", title: "Credits and pricing", summary: "Buy credits and see what plans include." },
  { id: "page-about", path: "/about", title: "About PixyDust", summary: "The brand's history from the 2019 Pixie Dust AR filter to PixyDust." },
  { id: "page-support", path: "/support", title: "Help Center", summary: "Answers about accounts, credits, tools and policies." },
  { id: "page-home", path: "/", title: "PixyDust home", summary: "All tools and trending templates." },
];

const SITE = "https://pixydust.com";

export async function linkInventory(db: D1Database): Promise<LinkTarget[]> {
  const [posts, sections, help, sectionList] = await Promise.all([
    listPublished(db, 500),
    sectionsById(db),
    allArticles(db).catch(() => []),
    listSections(db),
  ]);
  const out: LinkTarget[] = PAGES.map((p) => ({ id: p.id, kind: "page", title: p.title, url: p.path, summary: p.summary }));
  for (const s of sectionList) {
    out.push({ id: `section-${s.id}`, kind: "page", title: s.title, url: `/${s.slug}`, summary: s.blurb || `${s.title} index` });
  }
  for (const p of posts) {
    const tags = tagsOf(p);
    out.push({
      id: `item-${p.id}`,
      kind: "item",
      title: p.title,
      url: itemHref(sections, p),
      summary: `${excerptFor(p, 140)}${tags.length ? ` [${tags.slice(0, 4).join(", ")}]` : ""}`,
    });
  }
  // Published Help Center articles only (allArticles reads published rows).
  for (const a of help) {
    out.push({
      id: `help-${a.categoryId}-${a.slug}`,
      kind: "help",
      title: a.title,
      url: articleHref(a.categoryId, a.slug),
      summary: a.summary || `${a.categoryTitle} help`,
    });
  }
  return out;
}

export const targetMap = (inv: LinkTarget[]) => new Map(inv.map((t) => [t.id, { url: t.url, title: t.title, summary: t.summary }]));
export const absolute = (path: string) => (/^https?:/.test(path) ? path : `${SITE}${path}`);
