export const prerender = false;
import type { APIContext } from "astro";
import { adminActor, auditAdmin } from "../../../../lib/admin";
import { saveTemplate } from "../../../../lib/template-write";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

/**
 * Duplicate a template. Copies every field into a new slug, titled "… (Copy)",
 * created hidden + unfeatured with previews cleared so the clone is a clean
 * editing starting point. Returns the new id.
 */
export async function POST({ request, locals }: APIContext) {
  const env = locals.runtime.env;
  const actor = adminActor(request, locals, env.ADMIN_API_TOKEN);
  if (!actor) return json({ error: "Forbidden" }, 403);

  let id: string | undefined;
  try {
    ({ id } = (await request.json()) as { id?: string });
  } catch {
    return json({ error: "Invalid body" }, 400);
  }
  if (!id) return json({ error: "Missing id" }, 400);

  const row = await env.DB.prepare("SELECT * FROM templates WHERE id = ?").bind(id).first<Record<string, any>>();
  if (!row) return json({ error: "Template not found" }, 404);

  // Find an available "-copy" slug (within the 80-char limit).
  const base = id.slice(0, 73);
  let newId = `${base}-copy`;
  for (let n = 2; n < 50; n++) {
    const taken = await env.DB.prepare("SELECT 1 FROM templates WHERE id = ?").bind(newId).first();
    if (!taken) break;
    newId = `${base}-copy-${n}`;
  }

  const d: Record<string, any> = {
    ...row,
    id: newId,
    title: `${row.title} (Copy)`,
    is_hidden: 1, // clone starts hidden until reviewed
    is_featured: 0,
    preview_image: null, // examples belong to the original
    preview_video: null,
  };

  const res = await saveTemplate(env.DB, d);
  if (!res.ok) return json({ error: res.error }, res.status ?? 400);

  await auditAdmin(env.DB, actor, "template.duplicate", "template", newId, { from: id });
  return json({ ok: true, id: newId });
}
