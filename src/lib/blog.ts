// Blog posts (D1). Public reads go through listPublished/getPublishedBySlug so
// a draft can never leak onto /blog or into the sitemap.
import type { D1Database } from "@cloudflare/workers-types";

export interface BlogPost {
  id: number;
  slug: string;
  title: string;
  excerpt: string | null;
  content_html: string;
  thumbnail_url: string | null;
  thumbnail_alt: string | null;
  author: string | null;
  tags_json: string;
  status: "draft" | "published";
  published_at: string | null;
  created_at: string;
  updated_at: string;
  /** Primary category id from blog-taxonomy. Null until classified. */
  category: string | null;
  /** Editor's ordered override: JSON array of blog_posts.id. */
  related_json: string;
}

/** Manual related-article picks, as ids. Stored as ids rather than slugs so a
 *  retitled or re-permalinked post keeps its incoming recommendations. */
export function relatedIdsOf(post: Pick<BlogPost, "related_json">): number[] {
  try {
    const v = JSON.parse(post.related_json || "[]");
    return Array.isArray(v) ? v.map(Number).filter((n) => Number.isFinite(n)) : [];
  } catch {
    return [];
  }
}

export const BLOG_AUTHOR_FALLBACK = "PixyDust";

/** URL-safe slug. Keeps ASCII words, collapses everything else to single dashes. */
export function slugify(input: string): string {
  return (input || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "post";
}

/** First <img src> in the body — lets a post inherit its card image from the
 *  content instead of forcing a separate upload. */
export function firstImageIn(html: string): string | null {
  const m = /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/i.exec(html || "");
  return m ? m[1] : null;
}

/** The image to use for cards, og:image and JSON-LD. */
export function thumbnailFor(post: Pick<BlogPost, "thumbnail_url" | "content_html">): string | null {
  const explicit = (post.thumbnail_url || "").trim();
  if (explicit) return explicit;
  return firstImageIn(post.content_html);
}

/** Plain text from the body, for excerpts and reading time. */
export function textOf(html: string): string {
  return (html || "")
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Meta description: the author's excerpt, else the opening of the body.
 *  Trimmed at a word boundary near 155 chars so search results aren't cut mid-word. */
export function excerptFor(post: Pick<BlogPost, "excerpt" | "content_html">, max = 155): string {
  const written = (post.excerpt || "").trim();
  const source = written || textOf(post.content_html);
  if (source.length <= max) return source;
  const cut = source.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 60 ? cut.slice(0, lastSpace) : cut).replace(/[.,;:!?-]+$/, "") + "…";
}

export function readingMinutes(html: string): number {
  const words = textOf(html).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 225));
}

export function tagsOf(post: Pick<BlogPost, "tags_json">): string[] {
  try {
    const v = JSON.parse(post.tags_json || "[]");
    return Array.isArray(v) ? v.filter((t) => typeof t === "string" && t.trim()).map((t) => t.trim()) : [];
  } catch {
    return [];
  }
}

/** ISO-8601 for <time> and structured data. D1 stores 'YYYY-MM-DD HH:MM:SS' UTC. */
export function isoDate(sqlDate: string | null): string | null {
  if (!sqlDate) return null;
  const d = new Date(sqlDate.includes("T") ? sqlDate : sqlDate.replace(" ", "T") + "Z");
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function displayDate(sqlDate: string | null): string {
  const iso = isoDate(sqlDate);
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

/** Scheduling works by letting published_at sit in the future rather than by
 *  adding a 'scheduled' status or a cron job. A post goes live the moment the
 *  clock passes its date, because every public read filters on
 *  `published_at <= now` — there is no job to miss, nothing to retry, and a
 *  missed window is impossible. The cost is that "is this live?" is a function
 *  of the current time, so the admin computes the label rather than storing it.
 *
 *  SQL comparison is safe here: D1 stores 'YYYY-MM-DD HH:MM:SS' in UTC, which
 *  sorts and compares lexicographically in the same order as chronologically. */
const LIVE = `status = 'published' AND published_at IS NOT NULL AND published_at <= datetime('now')`;

/** True once the post's publish time has passed. */
export function isLive(post: Pick<BlogPost, "status" | "published_at">): boolean {
  if (post.status !== "published" || !post.published_at) return false;
  const t = isoDate(post.published_at);
  return !!t && new Date(t).getTime() <= Date.now();
}

/** Published with a future date — queued, not yet visible. */
export function isScheduled(post: Pick<BlogPost, "status" | "published_at">): boolean {
  return post.status === "published" && !!post.published_at && !isLive(post);
}

/** Live posts, newest first. Used by /blog and the sitemap. Excludes both
 *  drafts and anything scheduled for later. */
export async function listPublished(db: D1Database, limit = 100): Promise<BlogPost[]> {
  const r = await db
    .prepare(
      `SELECT * FROM blog_posts
       WHERE ${LIVE}
       ORDER BY published_at DESC, id DESC
       LIMIT ?`
    )
    .bind(limit)
    .all<BlogPost>();
  return r.results ?? [];
}

export interface Page<T> {
  items: T[];
  page: number;
  perPage: number;
  total: number;
  pages: number;
}

/** One page of live posts, newest first.
 *
 *  Counts and selects in the same request so "page 3 of 7" can never disagree
 *  with what page 3 actually contains. `page` is clamped into range rather than
 *  404ing: ?page=99 lands on the last page, which is friendlier to a stale link
 *  and stops a crawler manufacturing endless empty pages. */
export async function listPublishedPage(db: D1Database, page = 1, perPage = 12): Promise<Page<BlogPost>> {
  const row = await db.prepare(`SELECT COUNT(*) AS n FROM blog_posts WHERE ${LIVE}`).first<{ n: number }>();
  const total = row?.n ?? 0;
  const pages = Math.max(1, Math.ceil(total / perPage));
  const current = Math.min(Math.max(1, Math.floor(page) || 1), pages);
  const r = await db
    .prepare(
      `SELECT * FROM blog_posts
       WHERE ${LIVE}
       ORDER BY published_at DESC, id DESC
       LIMIT ? OFFSET ?`
    )
    .bind(perPage, (current - 1) * perPage)
    .all<BlogPost>();
  return { items: r.results ?? [], page: current, perPage, total, pages };
}

export async function getPublishedBySlug(db: D1Database, slug: string): Promise<BlogPost | null> {
  return (
    (await db
      .prepare(`SELECT * FROM blog_posts WHERE slug = ? AND ${LIVE}`)
      .bind(slug)
      .first<BlogPost>()) ?? null
  );
}

/** Every post including drafts — admin only. */
export async function listAll(db: D1Database): Promise<BlogPost[]> {
  const r = await db
    .prepare("SELECT * FROM blog_posts ORDER BY COALESCE(published_at, updated_at) DESC, id DESC")
    .all<BlogPost>();
  return r.results ?? [];
}

export async function getById(db: D1Database, id: number): Promise<BlogPost | null> {
  return (await db.prepare("SELECT * FROM blog_posts WHERE id = ?").bind(id).first<BlogPost>()) ?? null;
}

/** Slug that is free, suffixing -2, -3 … when taken. `ignoreId` lets a post keep its own. */
export async function uniqueSlug(db: D1Database, desired: string, ignoreId?: number): Promise<string> {
  const base = slugify(desired);
  for (let n = 0; n < 50; n++) {
    const candidate = n === 0 ? base : `${base}-${n + 1}`;
    const row = await db
      .prepare("SELECT id FROM blog_posts WHERE slug = ?")
      .bind(candidate)
      .first<{ id: number }>();
    if (!row || row.id === ignoreId) return candidate;
  }
  return `${base}-${Date.now()}`;
}

/** Articles to recommend under a post, most relevant first.
 *
 *  Order of precedence:
 *    1. The editor's manual picks, in the order they chose.
 *    2. Same primary category, then by number of shared tags.
 *    3. Shared tags alone, for cross-category matches.
 *
 *  Publication date only ever breaks a tie between equally relevant posts — it
 *  is not itself a reason to recommend something. An article with no relevant
 *  neighbours returns fewer than `limit`, or none at all, rather than padding
 *  with whatever is newest. Showing three unrelated posts is worse than showing
 *  one related one, and worse than showing nothing.
 *
 *  Candidates come from listPublished, so drafts, scheduled-for-later and
 *  deleted posts are already excluded, and every card reflects the target's
 *  current title and slug because it is read fresh on each request. */
export async function relatedPosts(db: D1Database, post: BlogPost, limit = 3): Promise<BlogPost[]> {
  // A generous pool: relevance, not recency, decides what survives.
  const pool = (await listPublished(db, 500)).filter((p) => p.id !== post.id);
  const byId = new Map(pool.map((p) => [p.id, p]));

  const picked: BlogPost[] = [];
  const seen = new Set<number>([post.id]);
  const take = (p: BlogPost | undefined) => {
    if (!p || seen.has(p.id) || picked.length >= limit) return;
    seen.add(p.id);
    picked.push(p);
  };

  // 1. Manual overrides. Silently skipped if unpublished or deleted — the
  //    editor's intent was "show this", not "show a gap".
  for (const id of relatedIdsOf(post)) take(byId.get(id));
  if (picked.length >= limit) return picked;

  // 2+3. Automatic relevance.
  const myTags = new Set(tagsOf(post).map((t) => t.toLowerCase()));
  const scored = pool
    .filter((p) => !seen.has(p.id))
    .map((p) => {
      const shared = tagsOf(p).filter((t) => myTags.has(t.toLowerCase())).length;
      const sameCategory = !!post.category && p.category === post.category;
      // Category dominates: any same-category post outranks a cross-category
      // one, however many tags the latter happens to share.
      const score = (sameCategory ? 100 : 0) + shared * 10;
      return { p, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const at = a.p.published_at || "";
      const bt = b.p.published_at || "";
      return bt.localeCompare(at); // newer first, tie-break only
    });

  for (const s of scored) take(s.p);
  return picked;
}
