export const prerender = false;
import type { APIContext } from "astro";
import { adminActor, auditAdmin } from "../../../lib/admin";
import { uniqueSlug, slugify, getById, textOf, relatedIdsOf, type BlogPost } from "../../../lib/blog";
import { classify } from "../../../lib/blog-taxonomy";
import { adminListAll } from "../../../lib/sections";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

interface SaveBody {
  action?: "create" | "save" | "delete";
  id?: number;
  title?: string;
  slug?: string;
  excerpt?: string;
  contentHtml?: string;
  thumbnailUrl?: string;
  thumbnailAlt?: string;
  author?: string;
  tags?: string[];
  status?: "draft" | "published";
  /** ISO-8601 (or 'YYYY-MM-DD HH:MM:SS') publish time, UTC. A future value
   *  schedules the post. "" clears it back to "stamp on next publish". */
  publishedAt?: string | null;
  /** Section the item is filed under (blog, made-with, ar-effects …). */
  section?: string;
  /** Sub-category within the section. "" clears it. */
  category?: string | null;
  /** Ordered manual related-article ids, max 3. */
  related?: number[];
  /** Ask the server to (re)derive category and tags from the text. */
  autoClassify?: boolean;
}

/** Normalise a client-supplied publish time to D1's 'YYYY-MM-DD HH:MM:SS' UTC.
 *  Returns undefined when the field was not sent (leave as-is), null when it
 *  was explicitly cleared, and a string when it parses. An unparseable value is
 *  rejected rather than silently coerced — a typo here would otherwise either
 *  hide a live post or publish a draft early. */
function normalisePublishedAt(raw: string | null | undefined): string | null | undefined | false {
  if (raw === undefined) return undefined;
  if (raw === null || String(raw).trim() === "") return null;
  const d = new Date(String(raw).includes("T") ? String(raw) : String(raw).replace(" ", "T") + "Z");
  if (Number.isNaN(d.getTime())) return false;
  return d.toISOString().slice(0, 19).replace("T", " ");
}

export async function POST({ request, locals }: APIContext) {
  const env = locals.runtime.env;
  const actor = adminActor(request, locals, env.ADMIN_API_TOKEN);
  if (!actor) return json({ error: "Forbidden" }, 403);
  const db = env.DB;

  let body: SaveBody;
  try {
    body = (await request.json()) as SaveBody;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  try {
    // ── delete ────────────────────────────────────────────────────────────
    if (body.action === "delete") {
      if (!body.id) return json({ error: "Missing id" }, 400);
      const existing = await getById(db, body.id);
      if (!existing) return json({ error: "Not found" }, 404);
      await db.prepare("DELETE FROM blog_posts WHERE id = ?").bind(body.id).run();
      await auditAdmin(db, actor, "delete_blog_post", "blog_posts", String(body.id), { slug: existing.slug });
      return json({ ok: true });
    }

    // ── create ────────────────────────────────────────────────────────────
    if (body.action === "create") {
      const title = (body.title || "Untitled item").trim();
      const slug = await uniqueSlug(db, body.slug || title);
      const all = await adminListAll(db);
      const section = all.some((s) => !s.parent_id && s.id === body.section) ? body.section! : "blog";
      const res = await db
        .prepare(
          `INSERT INTO blog_posts (slug, title, excerpt, content_html, status, section, created_at, updated_at)
           VALUES (?, ?, '', '', 'draft', ?, datetime('now'), datetime('now'))`
        )
        .bind(slug, title, section)
        .run();
      const id = Number(res.meta?.last_row_id);
      await auditAdmin(db, actor, "create_item", "blog_posts", String(id), { slug, title, section });
      return json({ ok: true, id, slug, section });
    }

    // ── save ──────────────────────────────────────────────────────────────
    if (!body.id) return json({ error: "Missing id" }, 400);
    const existing = await getById(db, body.id);
    if (!existing) return json({ error: "Not found" }, 404);

    const title = (body.title ?? existing.title).trim() || "Untitled post";
    // Slug edits are honoured but always normalised and de-duplicated, so a
    // typo can't produce an unreachable URL or collide with a live post.
    const wantSlug = slugify(body.slug ?? existing.slug);
    const slug = wantSlug === existing.slug ? existing.slug : await uniqueSlug(db, wantSlug, existing.id);

    // An absent status means "leave it alone", not "unpublish". The editor
    // always sends one, but this endpoint is also the headless API for
    // scripts, where a partial update — move an item, fix a tag — must not
    // silently take a live item offline. Matches the help and sections APIs.
    const status: BlogPost["status"] =
      body.status === "published" ? "published" : body.status === "draft" ? "draft" : existing.status;

    // published_at doubles as the schedule: a future value keeps the post out
    // of /blog and the sitemap until the clock passes it (see lib/blog.ts).
    const wanted = normalisePublishedAt(body.publishedAt);
    if (wanted === false) return json({ error: "Unreadable publish date" }, 400);

    const publishedAt =
      wanted !== undefined
        ? // An explicit date always wins, including clearing it.
          wanted
        : status === "published"
          ? // Stamped once, on first publish, and kept thereafter — re-publishing
            // an edited post must not reorder the index or reset the date search
            // engines already recorded.
            existing.published_at ?? new Date().toISOString().slice(0, 19).replace("T", " ")
          : existing.published_at;

    const contentHtml = body.contentHtml ?? existing.content_html;
    const excerptText = (body.excerpt ?? existing.excerpt ?? "").trim();

    let tags = Array.isArray(body.tags)
      ? body.tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 8)
      : JSON.parse(existing.tags_json || "[]");
    // Section and sub-category. A sub-category is only valid inside its own
    // section, so moving an item to another section drops a sub-category that
    // does not belong there rather than leaving it pointing across sections.
    const all = await adminListAll(db);
    const isSection = (id: string | null | undefined) => !!id && all.some((s) => !s.parent_id && s.id === id);
    const isSubOf = (id: string | null | undefined, sectionId: string) =>
      !!id && all.some((s) => s.id === id && s.parent_id === sectionId);

    const section = isSection(body.section) ? body.section! : existing.section || "blog";
    let category = body.category !== undefined ? (body.category || null) : existing.category;
    if (!isSubOf(category, section)) category = null;

    // Classify from the text when asked, or whenever an item would otherwise be
    // saved with nothing to match on. Recommendations are only as good as the
    // metadata, and an untagged item is invisible to every other item's
    // related list — so the default is "always classified", and an editor's
    // explicit values always win. The classifier's category is only accepted
    // when it names a sub-category of this item's own section: it knows Blog's
    // editorial categories, and must not file an AR effect under "Beauty".
    if (body.autoClassify || !category || tags.length === 0) {
      const guess = classify(title, excerptText, textOf(contentHtml));
      const guessed = isSubOf(guess.category, section) ? guess.category : null;
      if (body.autoClassify) {
        category = guessed ?? category;
        tags = guess.tags.length ? guess.tags : tags;
      } else {
        if (!category) category = guessed;
        if (tags.length === 0) tags = guess.tags;
      }
    }

    // Manual related picks: ids only, de-duplicated, never self-referential,
    // capped at three.
    const related = Array.isArray(body.related)
      ? [...new Set(body.related.map(Number).filter((n) => Number.isFinite(n) && n !== existing.id))].slice(0, 3)
      : relatedIdsOf(existing);

    await db
      .prepare(
        `UPDATE blog_posts
         SET slug = ?, title = ?, excerpt = ?, content_html = ?, thumbnail_url = ?, thumbnail_alt = ?,
             author = ?, tags_json = ?, status = ?, published_at = ?, section = ?, category = ?, related_json = ?,
             updated_at = datetime('now')
         WHERE id = ?`
      )
      .bind(
        slug,
        title,
        excerptText || null,
        contentHtml,
        (body.thumbnailUrl ?? existing.thumbnail_url ?? "").trim() || null,
        (body.thumbnailAlt ?? existing.thumbnail_alt ?? "").trim() || null,
        (body.author ?? existing.author ?? "").trim() || null,
        JSON.stringify(tags),
        status,
        publishedAt,
        section,
        category,
        JSON.stringify(related),
        existing.id
      )
      .run();

    const scheduled = status === "published" && !!publishedAt && publishedAt > new Date().toISOString().slice(0, 19).replace("T", " ");
    await auditAdmin(db, actor, "save_blog_post", "blog_posts", String(existing.id), { slug, status, publishedAt, scheduled });
    return json({ ok: true, id: existing.id, slug, status, publishedAt, scheduled, section, category, tags, related });
  } catch (err) {
    return json({ error: `Blog save failed: ${(err as Error)?.message || String(err)}` }, 500);
  }
}
