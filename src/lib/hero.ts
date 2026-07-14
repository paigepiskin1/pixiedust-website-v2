// Admin-curated homepage hero (#pd-hero) slides. Stored as a JSON array in
// app_settings under HERO_KEY. Each pick is either an existing template (by id)
// or a custom slide (uploaded media + text + link). Empty → the home page falls
// back to the automatic video-template hero.
import type { D1Database } from "@cloudflare/workers-types";
import { getSetting } from "./app-settings";
import { getTemplate } from "./templates";
import type { HeroSlide, Tone } from "./content";

export const HERO_KEY = "hero_slides";

export type HeroPick =
  | { kind: "template"; id: string }
  | { kind: "custom"; title: string; kicker?: string; href: string; url: string; mediaType: "image" | "video"; cr?: number; tone?: Tone };

export async function getHeroPicks(db: D1Database): Promise<HeroPick[]> {
  const raw = await getSetting(db, HERO_KEY);
  if (!raw) return [];
  try {
    const p = JSON.parse(raw);
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

/** Resolve picks to hero slides. Template picks pull live from `templates`
 * (skipped if deleted); custom picks render their own media + text. */
export async function resolveHeroSlides(db: D1Database, picks: HeroPick[]): Promise<HeroSlide[]> {
  const slides: HeroSlide[] = [];
  for (const p of picks) {
    if (p.kind === "template") {
      const t = await getTemplate(db, p.id);
      if (!t) continue;
      slides.push({
        tone: t.tone,
        kicker: t.category || t.kind || "Featured",
        title: t.title,
        hot: "Trending",
        dur: t.eta || "video",
        cta: "Try template",
        cr: t.creditCost ?? 0,
        href: `/studio/${t.id}`,
        previewImage: t.previewImage ?? undefined,
        previewVideo: t.previewVideo ?? undefined,
      });
    } else {
      slides.push({
        tone: (p.tone || "lilac") as Tone,
        kicker: p.kicker || "Featured",
        title: p.title,
        hot: "Featured",
        dur: "",
        cta: "Open",
        cr: p.cr ?? 0,
        href: p.href || "#",
        previewImage: p.mediaType === "image" ? p.url : undefined,
        previewVideo: p.mediaType === "video" ? p.url : undefined,
      });
    }
  }
  return slides;
}
