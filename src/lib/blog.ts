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

/** Published posts, newest first. Used by /blog and the sitemap. */
export async function listPublished(db: D1Database, limit = 100): Promise<BlogPost[]> {
  const r = await db
    .prepare(
      `SELECT * FROM blog_posts
       WHERE status = 'published' AND published_at IS NOT NULL
       ORDER BY published_at DESC, id DESC
       LIMIT ?`
    )
    .bind(limit)
    .all<BlogPost>();
  return r.results ?? [];
}

export async function getPublishedBySlug(db: D1Database, slug: string): Promise<BlogPost | null> {
  return (
    (await db
      .prepare("SELECT * FROM blog_posts WHERE slug = ? AND status = 'published' AND published_at IS NOT NULL")
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

/** Posts to show under an article. Prefers shared tags, fills up with recent. */
export async function relatedPosts(db: D1Database, post: BlogPost, limit = 3): Promise<BlogPost[]> {
  const others = (await listPublished(db, 30)).filter((p) => p.id !== post.id);
  const tags = new Set(tagsOf(post).map((t) => t.toLowerCase()));
  if (!tags.size) return others.slice(0, limit);
  const scored = others
    .map((p) => ({ p, score: tagsOf(p).filter((t) => tags.has(t.toLowerCase())).length }))
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.p);
}
