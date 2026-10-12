export const prerender = false;
import type { APIContext } from "astro";
import { adminActor, auditAdmin } from "../../../lib/admin";
import { slugify } from "../../../lib/blog";
import { adminGetArticle, type HelpNode } from "../../../lib/help-db";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

interface Body {
  action?:
    | "save-article" | "create-article" | "delete-article"
    | "save-category" | "create-category" | "delete-category"
    | "reorder";
  id?: number;
  categoryId?: string;
  slug?: string;
  title?: string;
  summary?: string;
  body?: HelpNode[];
  status?: "draft" | "published";
  popular?: boolean;
  // categories
  icon?: string;
  blurb?: string;
  // reorder
  kind?: "article" | "category";
  order?: (number | string)[];
}

/** Keep only the node shapes the article layout can render. Content arrives as
 *  structured nodes rather than HTML precisely so an editor cannot inject
 *  markup; validating here is what makes that true. */
function cleanBody(input: unknown): HelpNode[] {
  if (!Array.isArray(input)) return [];
  const out: HelpNode[] = [];
  for (const n of input) {
    if (typeof n === "string") {
      if (n.trim()) out.push(n.trim());
    } else if (n && typeof n === "object") {
      const o = n as Record<string, unknown>;
      if (typeof o.h === "string" && o.h.trim()) out.push({ h: o.h.trim() });
      else if (typeof o.note === "string" && o.note.trim()) out.push({ note: o.note.trim() });
      else if (Array.isArray(o.list)) {
        const list = o.list.map(String).map((s) => s.trim()).filter(Boolean);
        if (list.length) out.push({ list });
      } else if (Array.isArray(o.steps)) {
        const steps = o.steps.map(String).map((s) => s.trim()).filter(Boolean);
        if (steps.length) out.push({ steps });
      }
    }
  }
  return out;
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

  try {
    switch (body.action) {
      // ── categories ──────────────────────────────────────────────────
      case "create-category": {
        const id = slugify(body.categoryId || body.title || "");
        if (!id) return json({ error: "Missing category id" }, 400);
        const clash = await db.prepare("SELECT id FROM help_categories WHERE id = ?").bind(id).first();
        if (clash) return json({ error: `Category "${id}" already exists` }, 409);
        const next = await db.prepare("SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM help_categories").first<{ n: number }>();
        await db
          .prepare("INSERT INTO help_categories (id, title, icon, blurb, sort_order, status) VALUES (?, ?, ?, ?, ?, 'draft')")
          .bind(id, (body.title || id).trim(), body.icon || "book", (body.blurb || "").trim(), next?.n ?? 0)
          .run();
        await auditAdmin(db, actor, "create_help_category", "help_categories", id, {});
        return json({ ok: true, id });
      }

      case "save-category": {
        const id = body.categoryId;
        if (!id) return json({ error: "Missing category id" }, 400);
        await db
          .prepare(
            `UPDATE help_categories SET title = ?, icon = ?, blurb = ?, status = ?, updated_at = datetime('now') WHERE id = ?`
          )
          .bind(
            (body.title || id).trim(),
            body.icon || "book",
            (body.blurb || "").trim(),
            body.status === "draft" ? "draft" : "published",
            id
          )
          .run();
        await auditAdmin(db, actor, "save_help_category", "help_categories", id, { status: body.status });
        return json({ ok: true, id });
      }

      case "delete-category": {
        const id = body.categoryId;
        if (!id) return json({ error: "Missing category id" }, 400);
        const n = await db
          .prepare("SELECT COUNT(*) AS n FROM help_articles WHERE category_id = ?")
          .bind(id)
          .first<{ n: number }>();
        // Refuse rather than cascade: deleting a category would silently 404
        // every article URL under it, and those are indexed.
        if ((n?.n ?? 0) > 0) {
          return json({ error: `Category still has ${n!.n} article(s). Move or delete them first.` }, 409);
        }
        await db.prepare("DELETE FROM help_categories WHERE id = ?").bind(id).run();
        await auditAdmin(db, actor, "delete_help_category", "help_categories", id, {});
        return json({ ok: true });
      }

      // ── articles ────────────────────────────────────────────────────
      case "create-article": {
        const categoryId = body.categoryId;
        if (!categoryId) return json({ error: "Missing category" }, 400);
        const title = (body.title || "Untitled article").trim();
        let slug = slugify(body.slug || title) || "article";
        // Slugs are unique per category, so only that pair needs probing.
        for (let i = 2; i < 60; i++) {
          const clash = await db
            .prepare("SELECT id FROM help_articles WHERE category_id = ? AND slug = ?")
            .bind(categoryId, slug)
            .first();
          if (!clash) break;
          slug = `${slugify(body.slug || title)}-${i}`;
        }
        const next = await db
          .prepare("SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM help_articles WHERE category_id = ?")
          .bind(categoryId)
          .first<{ n: number }>();
        const res = await db
          .prepare(
            `INSERT INTO help_articles (category_id, slug, title, summary, body_json, sort_order, status)
             VALUES (?, ?, ?, '', '[]', ?, 'draft')`
          )
          .bind(categoryId, slug, title, next?.n ?? 0)
          .run();
        const id = Number(res.meta?.last_row_id);
        await auditAdmin(db, actor, "create_help_article", "help_articles", String(id), { categoryId, slug });
        return json({ ok: true, id, slug });
      }

      case "save-article": {
        if (!body.id) return json({ error: "Missing id" }, 400);
        const existing = await adminGetArticle(db, body.id);
        if (!existing) return json({ error: "Not found" }, 404);

        const categoryId = body.categoryId || existing.category_id;
        const title = (body.title ?? existing.title).trim() || "Untitled article";
        const wantSlug = slugify(body.slug ?? existing.slug) || existing.slug;
        let slug = wantSlug;
        if (slug !== existing.slug || categoryId !== existing.category_id) {
          for (let i = 2; i < 60; i++) {
            const clash = await db
              .prepare("SELECT id FROM help_articles WHERE category_id = ? AND slug = ? AND id != ?")
              .bind(categoryId, slug, existing.id)
              .first();
            if (!clash) break;
            slug = `${wantSlug}-${i}`;
          }
        }

        await db
          .prepare(
            `UPDATE help_articles
             SET category_id = ?, slug = ?, title = ?, summary = ?, body_json = ?, status = ?, popular = ?,
                 updated_at = datetime('now')
             WHERE id = ?`
          )
          .bind(
            categoryId,
            slug,
            title,
            (body.summary ?? existing.summary ?? "").trim(),
            JSON.stringify(body.body !== undefined ? cleanBody(body.body) : JSON.parse(existing.body_json || "[]")),
            body.status === "draft" ? "draft" : body.status === "published" ? "published" : existing.status,
            body.popular === undefined ? existing.popular : body.popular ? 1 : 0,
            existing.id
          )
          .run();

        await auditAdmin(db, actor, "save_help_article", "help_articles", String(existing.id), { categoryId, slug });
        return json({ ok: true, id: existing.id, categoryId, slug });
      }

      case "delete-article": {
        if (!body.id) return json({ error: "Missing id" }, 400);
        const existing = await adminGetArticle(db, body.id);
        if (!existing) return json({ error: "Not found" }, 404);
        await db.prepare("DELETE FROM help_articles WHERE id = ?").bind(body.id).run();
        await auditAdmin(db, actor, "delete_help_article", "help_articles", String(body.id), {
          categoryId: existing.category_id,
          slug: existing.slug,
        });
        return json({ ok: true });
      }

      // ── ordering ────────────────────────────────────────────────────
      case "reorder": {
        const ids = Array.isArray(body.order) ? body.order : [];
        if (!ids.length) return json({ error: "Nothing to reorder" }, 400);
        const table = body.kind === "category" ? "help_categories" : "help_articles";
        await db.batch(
          ids.map((id, i) =>
            db.prepare(`UPDATE ${table} SET sort_order = ?, updated_at = datetime('now') WHERE id = ?`).bind(i, id)
          )
        );
        await auditAdmin(db, actor, "reorder_help", table, String(ids.length), {});
        return json({ ok: true });
      }

      default:
        return json({ error: "Unknown action" }, 400);
    }
  } catch (err) {
    return json({ error: `Help save failed: ${(err as Error)?.message || String(err)}` }, 500);
  }
}
