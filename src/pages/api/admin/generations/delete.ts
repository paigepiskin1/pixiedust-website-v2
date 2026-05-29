export const prerender = false;
import type { APIContext } from "astro";
import { isAdmin, auditAdmin } from "../../../../lib/admin";
import { deleteFromBunny } from "../../../../lib/bunny";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

/**
 * Admin content removal. Deletes the DB record(s) and best-effort purges the
 * Bunny CDN asset(s). Body: { id } for one creation, or { uid, all: true } to
 * wipe everything a user made (abuse cleanup).
 */
export async function POST({ request, locals }: APIContext) {
  if (!isAdmin(locals)) return json({ error: "Forbidden" }, 403);
  const env = locals.runtime.env;

  let body: { id?: string; uid?: string; all?: boolean };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "Invalid body" }, 400);
  }

  // Wipe all of a user's creations.
  if (body.all && body.uid) {
    const u = await env.DB.prepare("SELECT id FROM users WHERE uid = ?").bind(body.uid).first<{ id: number }>();
    if (!u) return json({ error: "User not found" }, 404);
    const { results } = await env.DB
      .prepare("SELECT output_url FROM generations WHERE user_id = ?")
      .bind(u.id)
      .all<{ output_url: string | null }>();
    const rows = results ?? [];
    await Promise.all(rows.map((r) => (r.output_url ? deleteFromBunny(env, r.output_url) : Promise.resolve(false))));
    await env.DB.prepare("DELETE FROM generations WHERE user_id = ?").bind(u.id).run();
    await auditAdmin(env.DB, locals.user!.uid, "generation.delete_all", "user", body.uid, { count: rows.length });
    return json({ ok: true, deleted: rows.length });
  }

  // Delete a single creation (any owner) + purge its CDN file.
  if (!body.id) return json({ error: "id or { uid, all } required" }, 400);
  const row = await env.DB
    .prepare("SELECT output_url FROM generations WHERE id = ?")
    .bind(body.id)
    .first<{ output_url: string | null }>();
  if (!row) return json({ error: "Not found" }, 404);
  if (row.output_url) await deleteFromBunny(env, row.output_url);
  await env.DB.prepare("DELETE FROM generations WHERE id = ?").bind(body.id).run();
  await auditAdmin(env.DB, locals.user!.uid, "generation.delete", "generation", body.id, null);
  return json({ ok: true });
}
