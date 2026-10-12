// Item Sections — the top-level homes items are filed under, each with its own
// URL root (/blog, /made-with-pixydust, /ar-effects …), plus optional
// sub-categories an admin creates inside a section.
//
// Both live in the `collections` table: parent_id NULL is a section, a
// parent_id makes the row a sub-category of that section. Items are stored in
// blog_posts with `section` (required) and `category` (optional sub-category).
import type { D1Database } from "@cloudflare/workers-types";

export interface Section {
  id: string;
  slug: string;
  title: string;
  blurb: string;
  index_template: string;
  item_template: string;
  noun: string;
  icon: string;
  sort_order: number;
  status: "draft" | "published";
  in_footer: number;
  parent_id: string | null;
}

/** Layouts a section can use. "default" is the Blog look; the others are
 *  alternatives an admin can switch to per section without a deploy. */
export const INDEX_TEMPLATES = [
  { id: "default", label: "Default — Blog grid" },
  { id: "list", label: "List — compact rows" },
  { id: "gallery", label: "Gallery — image-first" },
] as const;
export const ITEM_TEMPLATES = [
  { id: "default", label: "Default — Blog article" },
  { id: "steps", label: "Steps — numbered walkthrough" },
  { id: "gallery", label: "Gallery — media-first" },
] as const;

/** First path segments that already belong to real pages. A section with one
 *  of these slugs would never be reached — Astro serves the static route
 *  first — so the admin refuses them rather than creating a dead section. */
export const RESERVED_SLUGS = new Set([
  "404", "about", "account", "ad", "admin", "api", "auth", "avatar", "beauty", "brand",
  "credits", "fashion", "feedback", "gallery", "hair", "help", "index", "invite", "legal",
  "motion", "presets", "robots.txt", "search", "shoots", "sitemap.xml", "studio", "support",
  "trending", "video", "_astro", "__",
]);

/** The URL key of a sub-category — its slug is namespaced "<section>/<key>"
 *  because slugs are unique across the whole table. */
export const subKey = (sub: Pick<Section, "slug">) => sub.slug.split("/").pop() || sub.slug;

/** Where an item lives. A missing section means Blog: items saved before
 *  sections existed, or by an older admin, still resolve. */
export function itemHref(sections: Map<string, Section>, item: { section?: string | null; slug: string }): string {
  const s = sections.get(item.section || "blog");
  return `/${s ? s.slug : "blog"}/${item.slug}`;
}

// ── public reads ───────────────────────────────────────────────────────────

/** Published top-level sections, in admin order. */
export async function listSections(db: D1Database): Promise<Section[]> {
  const r = await db
    .prepare("SELECT * FROM collections WHERE parent_id IS NULL AND status = 'published' ORDER BY sort_order, title")
    .all<Section>();
  return r.results ?? [];
}

/** Published sections keyed by id — for resolving item URLs in bulk without a
 *  query per item. */
export async function sectionsById(db: D1Database): Promise<Map<string, Section>> {
  return new Map((await listSections(db)).map((s) => [s.id, s]));
}

export async function getSectionBySlug(db: D1Database, slug: string): Promise<Section | null> {
  return (
    (await db
      .prepare("SELECT * FROM collections WHERE slug = ? AND parent_id IS NULL AND status = 'published'")
      .bind(slug)
      .first<Section>()) ?? null
  );
}

/** A section's published sub-categories, in admin order. */
export async function listSubcategories(db: D1Database, sectionId: string): Promise<Section[]> {
  const r = await db
    .prepare("SELECT * FROM collections WHERE parent_id = ? AND status = 'published' ORDER BY sort_order, title")
    .bind(sectionId)
    .all<Section>();
  return r.results ?? [];
}

// ── admin reads ────────────────────────────────────────────────────────────

/** Every section and sub-category, drafts included. */
export async function adminListAll(db: D1Database): Promise<Section[]> {
  const r = await db
    .prepare("SELECT * FROM collections ORDER BY parent_id IS NOT NULL, sort_order, title")
    .all<Section>();
  return r.results ?? [];
}

export async function adminGet(db: D1Database, id: string): Promise<Section | null> {
  return (await db.prepare("SELECT * FROM collections WHERE id = ?").bind(id).first<Section>()) ?? null;
}

/** Item counts per section and per sub-category, live and total. */
export async function itemCounts(
  db: D1Database
): Promise<{ bySection: Map<string, { total: number; live: number }>; bySub: Map<string, number> }> {
  const r = await db
    .prepare(
      `SELECT COALESCE(section, 'blog') AS section, category,
              COUNT(*) AS total,
              SUM(CASE WHEN status = 'published' AND published_at IS NOT NULL AND published_at <= datetime('now') THEN 1 ELSE 0 END) AS live
       FROM blog_posts GROUP BY COALESCE(section, 'blog'), category`
    )
    .all<{ section: string; category: string | null; total: number; live: number }>();
  const bySection = new Map<string, { total: number; live: number }>();
  const bySub = new Map<string, number>();
  for (const row of r.results ?? []) {
    const cur = bySection.get(row.section) ?? { total: 0, live: 0 };
    cur.total += row.total;
    cur.live += row.live ?? 0;
    bySection.set(row.section, cur);
    if (row.category) bySub.set(row.category, (bySub.get(row.category) ?? 0) + row.total);
  }
  return { bySection, bySub };
}
