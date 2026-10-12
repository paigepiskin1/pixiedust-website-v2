// Content collections — the footer sections that are not the blog. One generic
// model: a collection is an index page, its items are detail pages. Templates
// are data, not code paths, so a section's layout can change without a
// migration or a rewrite.
import type { D1Database } from "@cloudflare/workers-types";
import { textOf, excerptFor as blogExcerpt, isoDate, displayDate } from "./blog";

export interface Collection {
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
}

export interface CollectionItem {
  id: number;
  collection_id: string;
  slug: string;
  title: string;
  summary: string | null;
  content_html: string;
  hero_url: string | null;
  hero_alt: string | null;
  external_url: string | null;
  meta_json: string;
  tags_json: string;
  status: "draft" | "published";
  published_at: string | null;
  featured: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export const INDEX_TEMPLATES = ["grid", "list", "gallery"] as const;
export const ITEM_TEMPLATES = ["article", "gallery", "steps", "link"] as const;

/** Same rule as the blog: published, dated, and the date has passed. Keeps a
 *  scheduled item out of index pages, its own URL and the sitemap alike. */
const LIVE = `status = 'published' AND published_at IS NOT NULL AND published_at <= datetime('now')`;

export const collectionHref = (c: Pick<Collection, "slug">) => `/${c.slug}`;
export const itemHref = (c: Pick<Collection, "slug">, i: Pick<CollectionItem, "slug">) => `/${c.slug}/${i.slug}`;

/** Where a card should point: an external item links to its publisher, every
 *  other item to its own page. Press coverage is the case this exists for. */
export function linkFor(c: Collection, i: CollectionItem): { href: string; external: boolean } {
  const ext = (i.external_url || "").trim();
  return ext ? { href: ext, external: true } : { href: itemHref(c, i), external: false };
}

export function tagsOf(i: Pick<CollectionItem, "tags_json">): string[] {
  try {
    const v = JSON.parse(i.tags_json || "[]");
    return Array.isArray(v) ? v.filter((t) => typeof t === "string" && t.trim()).map((t) => t.trim()) : [];
  } catch {
    return [];
  }
}

/** Template-specific fields (brand, year, platform, …). Never throws: a
 *  malformed value degrades to no metadata rather than a 500 on the page. */
export function metaOf(i: Pick<CollectionItem, "meta_json">): Record<string, string> {
  try {
    const v = JSON.parse(i.meta_json || "{}");
    return v && typeof v === "object" && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}

export function summaryFor(i: CollectionItem, max = 155): string {
  const written = (i.summary || "").trim();
  if (written) return written.length <= max ? written : written.slice(0, max - 1).trimEnd() + "…";
  return blogExcerpt({ excerpt: null, content_html: i.content_html } as any, max);
}

export function imageFor(i: CollectionItem): string | null {
  const explicit = (i.hero_url || "").trim();
  if (explicit) return explicit;
  const m = /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/i.exec(i.content_html || "");
  return m ? m[1] : null;
}

export { isoDate, displayDate, textOf };

// ── public reads ───────────────────────────────────────────────────────────

export async function listCollections(db: D1Database, footerOnly = false): Promise<Collection[]> {
  const r = await db
    .prepare(
      `SELECT * FROM collections
       WHERE status = 'published' ${footerOnly ? "AND in_footer = 1" : ""}
       ORDER BY sort_order, title`
    )
    .all<Collection>();
  return r.results ?? [];
}

export async function getCollection(db: D1Database, slug: string): Promise<Collection | null> {
  return (
    (await db
      .prepare("SELECT * FROM collections WHERE slug = ? AND status = 'published'")
      .bind(slug)
      .first<Collection>()) ?? null
  );
}

export interface ItemPage {
  items: CollectionItem[];
  page: number;
  perPage: number;
  total: number;
  pages: number;
}

/** One page of live items.
 *
 *  Ordered by the editor's sort_order first, then newest. Index pages here are
 *  curated as often as chronological — an effects archive or a case-study list
 *  has a deliberate running order — so a manual position has to outrank the
 *  date, with the date as the fallback for everything left at zero. */
export async function listItems(db: D1Database, collectionId: string, page = 1, perPage = 12): Promise<ItemPage> {
  const row = await db
    .prepare(`SELECT COUNT(*) AS n FROM collection_items WHERE collection_id = ? AND ${LIVE}`)
    .bind(collectionId)
    .first<{ n: number }>();
  const total = row?.n ?? 0;
  const pages = Math.max(1, Math.ceil(total / perPage));
  const current = Math.min(Math.max(1, Math.floor(page) || 1), pages);
  const r = await db
    .prepare(
      `SELECT * FROM collection_items
       WHERE collection_id = ? AND ${LIVE}
       ORDER BY sort_order, published_at DESC, id DESC
       LIMIT ? OFFSET ?`
    )
    .bind(collectionId, perPage, (current - 1) * perPage)
    .all<CollectionItem>();
  return { items: r.results ?? [], page: current, perPage, total, pages };
}

export async function getItem(db: D1Database, collectionId: string, slug: string): Promise<CollectionItem | null> {
  return (
    (await db
      .prepare(`SELECT * FROM collection_items WHERE collection_id = ? AND slug = ? AND ${LIVE}`)
      .bind(collectionId, slug)
      .first<CollectionItem>()) ?? null
  );
}

/** Siblings shown under an item. Shared tags first, then the collection's own
 *  order — never padded with unrelated entries. */
export async function siblingItems(
  db: D1Database,
  collectionId: string,
  item: CollectionItem,
  limit = 3
): Promise<CollectionItem[]> {
  const all = (await listItems(db, collectionId, 1, 200)).items.filter((i) => i.id !== item.id);
  const mine = new Set(tagsOf(item).map((t) => t.toLowerCase()));
  if (!mine.size) return all.slice(0, limit);
  return all
    .map((i) => ({ i, score: tagsOf(i).filter((t) => mine.has(t.toLowerCase())).length }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.i);
}

/** Every live item across every collection — for the sitemap. External-only
 *  items are excluded: they have no page of ours to index. */
export async function allLiveItems(db: D1Database): Promise<{ collection: Collection; item: CollectionItem }[]> {
  const cols = await listCollections(db);
  const byId = new Map(cols.map((c) => [c.id, c]));
  const r = await db
    .prepare(`SELECT * FROM collection_items WHERE ${LIVE} ORDER BY collection_id, sort_order`)
    .all<CollectionItem>();
  return (r.results ?? [])
    .filter((i) => byId.has(i.collection_id) && !(i.external_url || "").trim())
    .map((i) => ({ collection: byId.get(i.collection_id)!, item: i }));
}

// ── admin reads ────────────────────────────────────────────────────────────

export async function adminListCollections(db: D1Database): Promise<Collection[]> {
  const r = await db.prepare("SELECT * FROM collections ORDER BY sort_order, title").all<Collection>();
  return r.results ?? [];
}

export async function adminGetCollection(db: D1Database, id: string): Promise<Collection | null> {
  return (await db.prepare("SELECT * FROM collections WHERE id = ?").bind(id).first<Collection>()) ?? null;
}

export async function adminListItems(db: D1Database, collectionId?: string): Promise<CollectionItem[]> {
  const r = collectionId
    ? await db
        .prepare("SELECT * FROM collection_items WHERE collection_id = ? ORDER BY sort_order, COALESCE(published_at, updated_at) DESC")
        .bind(collectionId)
        .all<CollectionItem>()
    : await db
        .prepare("SELECT * FROM collection_items ORDER BY collection_id, sort_order")
        .all<CollectionItem>();
  return r.results ?? [];
}

export async function adminGetItem(db: D1Database, id: number): Promise<CollectionItem | null> {
  return (await db.prepare("SELECT * FROM collection_items WHERE id = ?").bind(id).first<CollectionItem>()) ?? null;
}

/** Scheduled = published with a date still ahead. Derived, never stored. */
export function isScheduled(i: Pick<CollectionItem, "status" | "published_at">): boolean {
  if (i.status !== "published" || !i.published_at) return false;
  const t = isoDate(i.published_at);
  return !!t && new Date(t).getTime() > Date.now();
}

/** Free slug within a collection, suffixing -2, -3 … when taken. */
export async function uniqueItemSlug(
  db: D1Database,
  collectionId: string,
  desired: string,
  ignoreId?: number
): Promise<string> {
  const base = desired || "item";
  for (let n = 0; n < 60; n++) {
    const candidate = n === 0 ? base : `${base}-${n + 1}`;
    const row = await db
      .prepare("SELECT id FROM collection_items WHERE collection_id = ? AND slug = ?")
      .bind(collectionId, candidate)
      .first<{ id: number }>();
    if (!row || row.id === ignoreId) return candidate;
  }
  return `${base}-${Date.now()}`;
}
