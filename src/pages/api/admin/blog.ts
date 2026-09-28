export const prerender = false;
import type { APIContext } from "astro";
import { adminActor, auditAdmin } from "../../../lib/admin";
import { uniqueSlug, slugify, getById, type BlogPost } from "../../../lib/blog";

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
      const title = (body.title || "Untitled post").trim();
      const slug = await uniqueSlug(db, body.slug || title);
      const res = await db
        .prepare(
          `INSERT INTO blog_posts (slug, title, excerpt, content_html, status, created_at, updated_at)
           VALUES (?, ?, '', '', 'draft', datetime('now'), datetime('now'))`
        )
        .bind(slug, title)
        .run();
      const id = Number(res.meta?.last_row_id);
      await auditAdmin(db, actor, "create_blog_post", "blog_posts", String(id), { slug, title });
      return json({ ok: true, id, slug });
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

    const status: BlogPost["status"] = body.status === "published" ? "published" : "draft";
    // published_at is stamped once, on first publish, and kept thereafter —
    // re-publishing an edited post must not reorder the index or reset the
    // date search engines already recorded.
    const publishedAt =
      status === "published" ? existing.published_at ?? new Date().toISOString().slice(0, 19).replace("T", " ") : existing.published_at;

    const tags = Array.isArray(body.tags)
      ? body.tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 8)
      : JSON.parse(existing.tags_json || "[]");

    await db
      .prepare(
        `UPDATE blog_posts
         SET slug = ?, title = ?, excerpt = ?, content_html = ?, thumbnail_url = ?, thumbnail_alt = ?,
             author = ?, tags_json = ?, status = ?, published_at = ?, updated_at = datetime('now')
         WHERE id = ?`
      )
      .bind(
        slug,
        title,
        (body.excerpt ?? existing.excerpt ?? "").trim() || null,
        body.contentHtml ?? existing.content_html,
        (body.thumbnailUrl ?? existing.thumbnail_url ?? "").trim() || null,
        (body.thumbnailAlt ?? existing.thumbnail_alt ?? "").trim() || null,
        (body.author ?? existing.author ?? "").trim() || null,
        JSON.stringify(tags),
        status,
        publishedAt,
        existing.id
      )
      .run();

    await auditAdmin(db, actor, "save_blog_post", "blog_posts", String(existing.id), { slug, status });
    return json({ ok: true, id: existing.id, slug, status, publishedAt });
  } catch (err) {
    return json({ error: `Blog save failed: ${(err as Error)?.message || String(err)}` }, 500);
  }
}
