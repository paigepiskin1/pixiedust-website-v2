export const prerender = false;
import type { APIContext } from "astro";
import { isAdmin, auditAdmin } from "../../../../lib/admin";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

/** Mark a generation report ticket as resolved. */
export async function POST({ request, locals }: APIContext) {
  if (!isAdmin(locals)) return json({ error: "Forbidden" }, 403);

  let body: { id?: string; adminNote?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "Invalid body" }, 400);
  }
  const id = body.id?.trim();
  if (!id) return json({ error: "Missing id" }, 400);
  const adminNote = (body.adminNote ?? "").trim().slice(0, 1000) || null;
  const adminUid = locals.user!.uid;

  const res = await locals.runtime.env.DB.prepare(
    `UPDATE generation_reports
     SET status = 'resolved',
         admin_note = ?,
         resolved_by = ?,
         resolved_at = datetime('now')
     WHERE id = ? AND status = 'open'`
  )
    .bind(adminNote, adminUid, id)
    .run();

  if (!res.meta.changes) return json({ error: "Not found or already resolved" }, 404);

  await auditAdmin(locals.runtime.env.DB, adminUid, "report.resolve", "generation_report", id, {
    adminNote,
  });

  return json({ ok: true });
}
