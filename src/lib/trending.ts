// Admin-curated "Trending this week" rail on the home page. Stored as a JSON
// array in app_settings under TRENDING_KEY. Each pick is either an existing
// template (by id) or a custom card (uploaded media + text + link). Empty/missing
// → the home page falls back to the automatic featured/video trending rail.
import type { D1Database } from "@cloudflare/workers-types";
import { getSetting } from "./app-settings";
import { getTemplate, templateToRail } from "./templates";
import type { Tone } from "./content";

export const TRENDING_KEY = "trending_picks";

export type TrendingPick =
  | { kind: "template"; id: string }
  | { kind: "custom"; title: string; sub?: string; href: string; url: string; mediaType: "image" | "video"; tone?: Tone };

export async function getTrendingPicks(db: D1Database): Promise<TrendingPick[]> {
  const raw = await getSetting(db, TRENDING_KEY);
  if (!raw) return [];
  try {
    const p = JSON.parse(raw);
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

/** Resolve picks to home-rail cards. Template picks pull live from `templates`
 * (skipped if deleted); custom picks render their own media + text. Returns an
 * empty array when there are no picks so the caller can fall back to auto. */
export async function resolveTrendingCards(db: D1Database, picks: TrendingPick[]) {
  const cards = [] as ReturnType<typeof templateToRail>[];
  for (const p of picks) {
    if (p.kind === "template") {
      const t = await getTemplate(db, p.id);
      if (t) cards.push(templateToRail(t));
    } else {
      cards.push({
        name: p.title,
        sub: p.sub || undefined,
        type: "Trending",
        tone: (p.tone || "pink") as Tone,
        accent: "var(--pd-pink)",
        href: p.href || "#",
        previewImage: p.mediaType === "image" ? p.url : undefined,
        previewVideo: p.mediaType === "video" ? p.url : undefined,
      });
    }
  }
  return cards;
}
