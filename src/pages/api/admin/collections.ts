export const prerender = false;
import type { APIContext } from "astro";
import { adminActor, auditAdmin } from "../../../lib/admin";
import { slugify } from "../../../lib/blog";
import {
  adminGetItem, adminGetCollection, uniqueItemSlug,
  INDEX_TEMPLATES, ITEM_TEMPLATES,
} from "../../../lib/collections";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

interface Body {
  action?:
    | "create-collection" | "save-collection" | "delete-collection"
    | "create-item" | "save-item" | "delete-item" | "reorder";
  // collection
  collectionId?: string;
  slug?: string;
  title?: string;
  blurb?: string;
  indexTemplate?: string;
  itemTemplate?: string;
  noun?: string;
  icon?: string;
  inFooter?: boolean;
  // item
  id?: number;
  summary?: string;
  contentHtml?: string;
  heroUrl?: string;
  heroAlt?: string;
  externalUrl?: string;
  meta?: Record<string, string>;
  tags?: string[];
  featured?: boolean;
  status?: "draft" | "published";
  publishedAt?: string | null;
  // reorder
  kind?: "collection" | "item";
  order?: (number | string)[];
}

/** Normalise a client publish time to D1's 'YYYY-MM-DD HH:MM:SS' UTC.
 *  undefined = leave alone, null = clear, false = unparseable (reject). */
function normalisePublishedAt(raw: string | null | undefined): string | null | undefined | false {
  if (raw === undefined) return undefined;
  if (raw === null || String(raw).trim() === "") return null;
  const d = new Date(String(raw).includes("T") ? String(raw) : String(raw).replace(" ", "T") + "Z");
  if (Number.isNaN(d.getTime())) return false;
  return d.toISOString().slice(0, 19).replace("T", " ");
}

/** Only http(s) external links. A javascript: or data: URL here would become a
 *  stored redirect we render into an anchor on a public page. */
function safeExternal(raw: string | undefined | null): string | null {
  const v = (raw || "").trim();
  if (!v) return null;
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
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
      // ── collections ─────────────────────────────────────────────────
      case "create-collection": {
        const id = slugify(body.collectionId || body.title || "");
        const slug = slugify(body.slug || body.title || id);
        if (!id || !slug) return json({ error: "Missing name" }, 400);
        const clash = await db
          .prepare("SELECT id FROM collections WHERE id = ? OR slug = ?")
          .bind(id, slug)
          .first();
        if (clash) return json({ error: `"${id}" already exists` }, 409);
        const next = await db.prepare("SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM collections").first<{ n: number }>();
        await db
          .prepare(
            `INSERT INTO collections (id, slug, title, blurb, index_template, item_template, noun, icon, sort_order, status, in_footer)
             VALUES (?, ?, ?, ?, 'grid', 'article', 'items', 'book', ?, 'draft', 1)`
          )
          .bind(id, slug, (body.title || id).trim(), (body.blurb || "").trim(), next?.n ?? 0)
          .run();
        await auditAdmin(db, actor, "create_collection", "collections", id, { slug });
        return json({ ok: true, id, slug });
      }

      case "save-collection": {
        const id = body.collectionId;
        if (!id) return json({ error: "Missing collection" }, 400);
        const existing = await adminGetCollection(db, id);
        if (!existing) return json({ error: "Not found" }, 404);

        const slug = slugify(body.slug ?? existing.slug) || existing.slug;
        if (slug !== existing.slug) {
          const clash = await db.prepare("SELECT id FROM collections WHERE slug = ? AND id != ?").bind(slug, id).first();
          if (clash) return json({ error: `/${slug} is already used by another section` }, 409);
        }
        const indexTemplate = INDEX_TEMPLATES.includes(body.indexTemplate as any) ? body.indexTemplate! : existing.index_template;
        const itemTemplate = ITEM_TEMPLATES.includes(body.itemTemplate as any) ? body.itemTemplate! : existing.item_template;

        await db
          .prepare(
            `UPDATE collections SET slug = ?, title = ?, blurb = ?, index_template = ?, item_template = ?,
                    noun = ?, icon = ?, status = ?, in_footer = ?, updated_at = datetime('now')
             WHERE id = ?`
          )
          .bind(
            slug,
            (body.title ?? existing.title).trim() || existing.title,
            (body.blurb ?? existing.blurb ?? "").trim(),
            indexTemplate,
            itemTemplate,
            (body.noun ?? existing.noun).trim() || "items",
            (body.icon ?? existing.icon).trim() || "book",
            body.status === "draft" ? "draft" : body.status === "published" ? "published" : existing.status,
            body.inFooter === undefined ? existing.in_footer : body.inFooter ? 1 : 0,
            id
          )
          .run();
        await auditAdmin(db, actor, "save_collection", "collections", id, { slug, indexTemplate, itemTemplate });
        return json({ ok: true, id, slug, indexTemplate, itemTemplate });
      }

      case "delete-collection": {
        const id = body.collectionId;
        if (!id) return json({ error: "Missing collection" }, 400);
        const n = await db
          .prepare("SELECT COUNT(*) AS n FROM collection_items WHERE collection_id = ?")
          .bind(id)
          .first<{ n: number }>();
        // Refuse rather than cascade — deleting the section would 404 every
        // item URL beneath it, and those are indexed.
        if ((n?.n ?? 0) > 0) return json({ error: `Section still has ${n!.n} item(s). Delete them first.` }, 409);
        await db.prepare("DELETE FROM collections WHERE id = ?").bind(id).run();
        await auditAdmin(db, actor, "delete_collection", "collections", id, {});
        return json({ ok: true });
      }

      // ── items ───────────────────────────────────────────────────────
      case "create-item": {
        const collectionId = body.collectionId;
        if (!collectionId) return json({ error: "Missing section" }, 400);
        const collection = await adminGetCollection(db, collectionId);
        if (!collection) return json({ error: "Section not found" }, 404);
        const title = (body.title || "Untitled").trim();
        const slug = await uniqueItemSlug(db, collectionId, slugify(body.slug || title));
        const next = await db
          .prepare("SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM collection_items WHERE collection_id = ?")
          .bind(collectionId)
          .first<{ n: number }>();
        const res = await db
          .prepare(
            `INSERT INTO collection_items (collection_id, slug, title, summary, content_html, sort_order, status)
             VALUES (?, ?, ?, '', '', ?, 'draft')`
          )
          .bind(collectionId, slug, title, next?.n ?? 0)
          .run();
        const id = Number(res.meta?.last_row_id);
        await auditAdmin(db, actor, "create_collection_item", "collection_items", String(id), { collectionId, slug });
        return json({ ok: true, id, slug });
      }

      case "save-item": {
        if (!body.id) return json({ error: "Missing id" }, 400);
        const existing = await adminGetItem(db, body.id);
        if (!existing) return json({ error: "Not found" }, 404);

        const collectionId = body.collectionId || existing.collection_id;
        const title = (body.title ?? existing.title).trim() || "Untitled";
        const wantSlug = slugify(body.slug ?? existing.slug) || existing.slug;
        const slug =
          wantSlug === existing.slug && collectionId === existing.collection_id
            ? existing.slug
            : await uniqueItemSlug(db, collectionId, wantSlug, existing.id);

        const status = body.status === "published" ? "published" : body.status === "draft" ? "draft" : existing.status;
        const wanted = normalisePublishedAt(body.publishedAt);
        if (wanted === false) return json({ error: "Unreadable publish date" }, 400);
        const publishedAt =
          wanted !== undefined
            ? wanted
            : status === "published"
              ? existing.published_at ?? new Date().toISOString().slice(0, 19).replace("T", " ")
              : existing.published_at;

        const tags = Array.isArray(body.tags)
          ? body.tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 10)
          : JSON.parse(existing.tags_json || "[]");

        const meta =
          body.meta && typeof body.meta === "object" && !Array.isArray(body.meta)
            ? Object.fromEntries(
                Object.entries(body.meta)
                  .map(([k, v]) => [String(k).trim(), String(v ?? "").trim()])
                  .filter(([k, v]) => k && v)
                  .slice(0, 20)
              )
            : JSON.parse(existing.meta_json || "{}");

        await db
          .prepare(
            `UPDATE collection_items
             SET collection_id = ?, slug = ?, title = ?, summary = ?, content_html = ?, hero_url = ?, hero_alt = ?,
                 external_url = ?, meta_json = ?, tags_json = ?, status = ?, published_at = ?, featured = ?,
                 updated_at = datetime('now')
             WHERE id = ?`
          )
          .bind(
            collectionId,
            slug,
            title,
            (body.summary ?? existing.summary ?? "").trim() || null,
            body.contentHtml ?? existing.content_html,
            (body.heroUrl ?? existing.hero_url ?? "").trim() || null,
            (body.heroAlt ?? existing.hero_alt ?? "").trim() || null,
            body.externalUrl !== undefined ? safeExternal(body.externalUrl) : existing.external_url,
            JSON.stringify(meta),
            JSON.stringify(tags),
            status,
            publishedAt,
            body.featured === undefined ? existing.featured : body.featured ? 1 : 0,
            existing.id
          )
          .run();

        const scheduled =
          status === "published" && !!publishedAt && publishedAt > new Date().toISOString().slice(0, 19).replace("T", " ");
        await auditAdmin(db, actor, "save_collection_item", "collection_items", String(existing.id), {
          collectionId, slug, status,
        });
        return json({ ok: true, id: existing.id, collectionId, slug, status, publishedAt, scheduled, tags, meta });
      }

      case "delete-item": {
        if (!body.id) return json({ error: "Missing id" }, 400);
        const existing = await adminGetItem(db, body.id);
        if (!existing) return json({ error: "Not found" }, 404);
        await db.prepare("DELETE FROM collection_items WHERE id = ?").bind(body.id).run();
        await auditAdmin(db, actor, "delete_collection_item", "collection_items", String(body.id), {
          collectionId: existing.collection_id, slug: existing.slug,
        });
        return json({ ok: true });
      }

      case "reorder": {
        const ids = Array.isArray(body.order) ? body.order : [];
        if (!ids.length) return json({ error: "Nothing to reorder" }, 400);
        const table = body.kind === "collection" ? "collections" : "collection_items";
        await db.batch(
          ids.map((id, i) =>
            db.prepare(`UPDATE ${table} SET sort_order = ?, updated_at = datetime('now') WHERE id = ?`).bind(i, id)
          )
        );
        await auditAdmin(db, actor, "reorder_collections", table, String(ids.length), {});
        return json({ ok: true });
      }

      default:
        return json({ error: "Unknown action" }, 400);
    }
  } catch (err) {
    return json({ error: `Save failed: ${(err as Error)?.message || String(err)}` }, 500);
  }
}
