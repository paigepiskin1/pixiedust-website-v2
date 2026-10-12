export const prerender = false;
import type { APIContext } from "astro";
import { adminActor, auditAdmin } from "../../../lib/admin";
import { slugify } from "../../../lib/blog";
import { adminGet, adminListAll, RESERVED_SLUGS, INDEX_TEMPLATES, ITEM_TEMPLATES } from "../../../lib/sections";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

interface Body {
  action?:
    | "create-section" | "save-section" | "delete-section"
    | "create-sub" | "save-sub" | "delete-sub"
    | "reorder";
  id?: string;
  sectionId?: string;
  title?: string;
  slug?: string;
  key?: string;
  blurb?: string;
  noun?: string;
  indexTemplate?: string;
  itemTemplate?: string;
  status?: "draft" | "published";
  inFooter?: boolean;
  order?: string[];
}

export async function POST({ request, locals }: APIContext) {
  const env = locals.runtime.env;
  const actor = adminActor(request, locals, env.ADMIN_API_TOKEN);
  if (!actor) return json({ error: "Forbidden" }, 403);
  const db = env.DB;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const all = await adminListAll(db);
  /** A section slug is its URL root, so it must not shadow a real page and
   *  must not collide with another row's slug. */
  const sectionSlugProblem = (slug: string, selfId?: string): string | null => {
    if (!slug) return "A URL is required.";
    if (RESERVED_SLUGS.has(slug)) return `/${slug} is already a page on the site — choose another URL.`;
    if (all.some((s) => s.slug === slug && s.id !== selfId)) return `/${slug} is already used by another section.`;
    return null;
  };

  try {
    switch (body.action) {
      // ── sections ────────────────────────────────────────────────────
      case "create-section": {
        const title = (body.title || "").trim();
        const slug = slugify(body.slug || title);
        const problem = sectionSlugProblem(slug);
        if (problem) return json({ error: problem }, 409);
        let id = slug;
        if (all.some((s) => s.id === id)) id = `${slug}-${Date.now().toString(36)}`;
        const next = Math.max(-1, ...all.filter((s) => !s.parent_id).map((s) => s.sort_order)) + 1;
        await db
          .prepare(
            `INSERT INTO collections (id, slug, title, blurb, index_template, item_template, noun, icon, sort_order, status, in_footer, url_mode, parent_id)
             VALUES (?, ?, ?, '', 'default', 'default', 'items', 'book', ?, 'draft', 0, 'section', NULL)`
          )
          .bind(id, slug, title || slug, next)
          .run();
        await auditAdmin(db, actor, "create_section", "collections", id, { slug });
        return json({ ok: true, id, slug });
      }

      case "save-section": {
        const s = body.id ? await adminGet(db, body.id) : null;
        if (!s || s.parent_id) return json({ error: "Section not found" }, 404);
        const slug = slugify(body.slug ?? s.slug) || s.slug;
        if (slug !== s.slug) {
          const problem = sectionSlugProblem(slug, s.id);
          if (problem) return json({ error: problem }, 409);
        }
        const indexTemplate = INDEX_TEMPLATES.some((t) => t.id === body.indexTemplate) ? body.indexTemplate! : s.index_template;
        const itemTemplate = ITEM_TEMPLATES.some((t) => t.id === body.itemTemplate) ? body.itemTemplate! : s.item_template;
        await db
          .prepare(
            `UPDATE collections SET slug = ?, title = ?, blurb = ?, noun = ?, index_template = ?, item_template = ?,
                    status = ?, in_footer = ?, updated_at = datetime('now')
             WHERE id = ?`
          )
          .bind(
            slug,
            (body.title ?? s.title).trim() || s.title,
            (body.blurb ?? s.blurb ?? "").trim(),
            (body.noun ?? s.noun).trim() || "items",
            indexTemplate,
            itemTemplate,
            body.status === "draft" ? "draft" : body.status === "published" ? "published" : s.status,
            body.inFooter === undefined ? s.in_footer : body.inFooter ? 1 : 0,
            s.id
          )
          .run();
        await auditAdmin(db, actor, "save_section", "collections", s.id, { slug, indexTemplate, itemTemplate });
        return json({ ok: true, id: s.id, slug, indexTemplate, itemTemplate });
      }

      case "delete-section": {
        const s = body.id ? await adminGet(db, body.id) : null;
        if (!s || s.parent_id) return json({ error: "Section not found" }, 404);
        if (s.id === "blog") return json({ error: "Blog can be renamed or hidden, but not deleted." }, 409);
        const n = await db
          .prepare("SELECT COUNT(*) AS n FROM blog_posts WHERE COALESCE(section, 'blog') = ?")
          .bind(s.id)
          .first<{ n: number }>();
        // Refuse rather than cascade: deleting a section would 404 every item
        // URL under it, and those are indexed.
        if ((n?.n ?? 0) > 0) {
          return json({ error: `${s.title} still has ${n!.n} item(s). Move or delete them first.` }, 409);
        }
        await db.batch([
          db.prepare("DELETE FROM collections WHERE parent_id = ?").bind(s.id),
          db.prepare("DELETE FROM collections WHERE id = ?").bind(s.id),
        ]);
        await auditAdmin(db, actor, "delete_section", "collections", s.id, {});
        return json({ ok: true });
      }

      // ── sub-categories ──────────────────────────────────────────────
      case "create-sub": {
        const section = body.sectionId ? await adminGet(db, body.sectionId) : null;
        if (!section || section.parent_id) return json({ error: "Section not found" }, 404);
        const title = (body.title || "").trim();
        const key = slugify(body.key || title);
        if (!key) return json({ error: "A name is required." }, 400);
        // Keys only have to be unique within their section — that is the only
        // place they appear (?category=<key>). The stored slug is namespaced
        // because the column is unique across the whole table.
        const slug = `${section.id}/${key}`;
        if (all.some((s) => s.slug === slug)) return json({ error: `${section.title} already has “${key}”.` }, 409);
        let id = key;
        if (all.some((s) => s.id === id)) id = `${section.id}-${key}`;
        if (all.some((s) => s.id === id)) id = `${section.id}-${key}-${Date.now().toString(36)}`;
        const next = Math.max(-1, ...all.filter((s) => s.parent_id === section.id).map((s) => s.sort_order)) + 1;
        await db
          .prepare(
            `INSERT INTO collections (id, slug, title, blurb, index_template, item_template, noun, icon, sort_order, status, in_footer, url_mode, parent_id)
             VALUES (?, ?, ?, ?, 'default', 'default', 'items', 'book', ?, 'published', 0, 'section', ?)`
          )
          .bind(id, slug, title || key, (body.blurb || "").trim(), next, section.id)
          .run();
        await auditAdmin(db, actor, "create_subcategory", "collections", id, { section: section.id, key });
        return json({ ok: true, id, key });
      }

      case "save-sub": {
        const sub = body.id ? await adminGet(db, body.id) : null;
        if (!sub || !sub.parent_id) return json({ error: "Sub-category not found" }, 404);
        const key = slugify(body.key ?? sub.slug.split("/").pop() ?? "") || sub.slug.split("/").pop()!;
        const slug = `${sub.parent_id}/${key}`;
        if (slug !== sub.slug && all.some((s) => s.slug === slug)) {
          return json({ error: `This section already has “${key}”.` }, 409);
        }
        await db
          .prepare("UPDATE collections SET slug = ?, title = ?, blurb = ?, updated_at = datetime('now') WHERE id = ?")
          .bind(slug, (body.title ?? sub.title).trim() || sub.title, (body.blurb ?? sub.blurb ?? "").trim(), sub.id)
          .run();
        await auditAdmin(db, actor, "save_subcategory", "collections", sub.id, { key });
        return json({ ok: true, id: sub.id, key });
      }

      case "delete-sub": {
        const sub = body.id ? await adminGet(db, body.id) : null;
        if (!sub || !sub.parent_id) return json({ error: "Sub-category not found" }, 404);
        // Detach rather than refuse. Sub-categories are not part of an item's
        // URL, so removing one changes no address — its items simply become
        // unsorted within their section.
        const n = await db.prepare("SELECT COUNT(*) AS n FROM blog_posts WHERE category = ?").bind(sub.id).first<{ n: number }>();
        await db.batch([
          db.prepare("UPDATE blog_posts SET category = NULL, updated_at = datetime('now') WHERE category = ?").bind(sub.id),
          db.prepare("DELETE FROM collections WHERE id = ?").bind(sub.id),
        ]);
        await auditAdmin(db, actor, "delete_subcategory", "collections", sub.id, { detached: n?.n ?? 0 });
        return json({ ok: true, detached: n?.n ?? 0 });
      }

      case "reorder": {
        const ids = Array.isArray(body.order) ? body.order : [];
        if (!ids.length) return json({ error: "Nothing to reorder" }, 400);
        await db.batch(
          ids.map((id, i) =>
            db.prepare("UPDATE collections SET sort_order = ?, updated_at = datetime('now') WHERE id = ?").bind(i, id)
          )
        );
        await auditAdmin(db, actor, "reorder_sections", "collections", String(ids.length), {});
        return json({ ok: true });
      }

      default:
        return json({ error: "Unknown action" }, 400);
    }
  } catch (err) {
    return json({ error: `Save failed: ${(err as Error)?.message || String(err)}` }, 500);
  }
}
