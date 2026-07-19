export const prerender = false;
import type { APIContext } from "astro";
import { adminActor, auditAdmin } from "../../../lib/admin";
import { addAdminMedia, deleteAdminMedia, listAdminMedia } from "../../../lib/admin-media";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

/** List recent admin media uploads. */
export async function GET({ request, locals }: APIContext) {
  const env = locals.runtime.env;
  const actor = adminActor(request, locals, env.ADMIN_API_TOKEN);
  if (!actor) return json({ error: "Forbidden" }, 403);
  const items = await listAdminMedia(env.DB, 200);
  return json({ items });
}

/**
 * Register an uploaded CDN URL in the admin media library.
 * Body: { url, kind?, filename?, bytes? }
 * Delete: { id, delete: true }
 */
export async function POST({ request, locals }: APIContext) {
  const env = locals.runtime.env;
  const actor = adminActor(request, locals, env.ADMIN_API_TOKEN);
  if (!actor) return json({ error: "Forbidden" }, 403);

  let body: { url?: string; kind?: string; filename?: string; bytes?: number; id?: string; delete?: boolean };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "Invalid body" }, 400);
  }

  if (body.delete) {
    if (!body.id) return json({ error: "id required" }, 400);
    const ok = await deleteAdminMedia(env.DB, body.id);
    if (!ok) return json({ error: "Not found" }, 404);
    await auditAdmin(env.DB, actor, "media.delete", "admin_media", body.id);
    return json({ ok: true });
  }

  if (!body.url || !/^https?:\/\//i.test(body.url)) return json({ error: "url required" }, 400);
  const item = await addAdminMedia(env.DB, {
    url: body.url,
    kind: body.kind,
    filename: body.filename,
    bytes: body.bytes,
    createdBy: actor,
  });
  await auditAdmin(env.DB, actor, "media.add", "admin_media", item.id, { url: item.url, kind: item.kind });
  return json({ ok: true, item });
}
