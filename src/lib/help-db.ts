// Help Centre content, read from D1 so it can be edited in the admin instead
// of requiring a deploy. The node shapes and function names match the original
// src/lib/help.ts, which seeded these tables — the pages kept their structure
// and only became async.
import type { D1Database } from "@cloudflare/workers-types";
import type { HelpNode, HelpArticle, HelpCategory, ArticleRef } from "./help";

export type { HelpNode, HelpArticle, HelpCategory, ArticleRef };

export const HELP_SUPPORT_EMAIL = "support@pixydust.com";
export const HELP_BILLING_EMAIL = "billing@pixydust.com";

export const categoryHref = (id: string): string => `/support/${id}`;
export const articleHref = (categoryId: string, slug: string): string => `/support/${categoryId}/${slug}`;

/** Icon keys the HelpIcon component knows how to draw. */
export const HELP_ICONS = [
  "rocket", "coin", "card", "refund", "tools", "model", "wrench", "user", "gift", "book",
] as const;

interface CategoryRow {
  id: string;
  title: string;
  icon: string;
  blurb: string;
  sort_order: number;
  status: string;
}

interface ArticleRow {
  id: number;
  category_id: string;
  slug: string;
  title: string;
  summary: string;
  body_json: string;
  sort_order: number;
  status: string;
  popular: number;
}

/** Body nodes, tolerant of anything malformed. A help article that throws takes
 *  the whole support page down, so a bad row degrades to no body instead. */
export function bodyOf(row: Pick<ArticleRow, "body_json">): HelpNode[] {
  try {
    const v = JSON.parse(row.body_json || "[]");
    return Array.isArray(v) ? (v as HelpNode[]) : [];
  } catch {
    return [];
  }
}

const toArticle = (r: ArticleRow): HelpArticle => ({
  slug: r.slug,
  title: r.title,
  summary: r.summary,
  body: bodyOf(r),
});

/** Published categories with their published articles, in editor order.
 *  Two queries rather than a join: there are tens of rows, and assembling in
 *  memory keeps the ordering rules in one obvious place. */
export async function listCategories(db: D1Database, includeDrafts = false): Promise<HelpCategory[]> {
  const where = includeDrafts ? "" : "WHERE status = 'published'";
  const [cats, arts] = await Promise.all([
    db.prepare(`SELECT * FROM help_categories ${where} ORDER BY sort_order, title`).all<CategoryRow>(),
    db.prepare(`SELECT * FROM help_articles ${where} ORDER BY sort_order, title`).all<ArticleRow>(),
  ]);
  const byCat = new Map<string, HelpArticle[]>();
  for (const a of arts.results ?? []) {
    if (!byCat.has(a.category_id)) byCat.set(a.category_id, []);
    byCat.get(a.category_id)!.push(toArticle(a));
  }
  return (cats.results ?? []).map((c) => ({
    id: c.id,
    title: c.title,
    icon: c.icon,
    blurb: c.blurb,
    articles: byCat.get(c.id) ?? [],
  }));
}

export async function getCategory(db: D1Database, id: string): Promise<HelpCategory | undefined> {
  const c = await db
    .prepare("SELECT * FROM help_categories WHERE id = ? AND status = 'published'")
    .bind(id)
    .first<CategoryRow>();
  if (!c) return undefined;
  const arts = await db
    .prepare("SELECT * FROM help_articles WHERE category_id = ? AND status = 'published' ORDER BY sort_order, title")
    .bind(id)
    .all<ArticleRow>();
  return { id: c.id, title: c.title, icon: c.icon, blurb: c.blurb, articles: (arts.results ?? []).map(toArticle) };
}

export async function getArticle(
  db: D1Database,
  categoryId: string,
  slug: string
): Promise<{ category: HelpCategory; article: HelpArticle } | null> {
  const category = await getCategory(db, categoryId);
  const article = category?.articles.find((a) => a.slug === slug);
  return category && article ? { category, article } : null;
}

export async function allArticles(db: D1Database): Promise<ArticleRef[]> {
  const cats = await listCategories(db);
  return cats.flatMap((c) =>
    c.articles.map((a) => ({
      categoryId: c.id,
      categoryTitle: c.title,
      slug: a.slug,
      title: a.title,
      summary: a.summary,
    }))
  );
}

/** "Popular topics" on the landing page — now a flag editors can toggle per
 *  article rather than a hardcoded list. Falls back to the first few articles
 *  so the section is never empty on a fresh install. */
export async function popularArticles(db: D1Database, limit = 8): Promise<ArticleRef[]> {
  const all = await allArticles(db);
  const flagged = await db
    .prepare("SELECT category_id, slug FROM help_articles WHERE popular = 1 AND status = 'published' ORDER BY sort_order")
    .all<{ category_id: string; slug: string }>();
  const keys = new Set((flagged.results ?? []).map((r) => `${r.category_id}/${r.slug}`));
  const picked = all.filter((a) => keys.has(`${a.categoryId}/${a.slug}`));
  return (picked.length ? picked : all).slice(0, limit);
}

// ── admin reads ────────────────────────────────────────────────────────────

export async function adminListCategories(db: D1Database): Promise<CategoryRow[]> {
  const r = await db.prepare("SELECT * FROM help_categories ORDER BY sort_order, title").all<CategoryRow>();
  return r.results ?? [];
}

export async function adminListArticles(db: D1Database): Promise<ArticleRow[]> {
  const r = await db.prepare("SELECT * FROM help_articles ORDER BY category_id, sort_order, title").all<ArticleRow>();
  return r.results ?? [];
}

export async function adminGetArticle(db: D1Database, id: number): Promise<ArticleRow | null> {
  return (await db.prepare("SELECT * FROM help_articles WHERE id = ?").bind(id).first<ArticleRow>()) ?? null;
}

export type { CategoryRow as HelpCategoryRow, ArticleRow as HelpArticleRow };
