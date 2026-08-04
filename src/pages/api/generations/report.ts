export const prerender = false;
import type { APIContext } from "astro";
import { getUserByUid } from "../../../lib/users";
import { isReportReason } from "../../../lib/generation-reports";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

/** File a generation issue ticket (stuck processing, bad result, etc.). */
export async function POST({ request, locals }: APIContext) {
  const user = locals.user;
  if (!user) return json({ error: "Unauthorized" }, 401);

  const env = locals.runtime.env;
  const db = env.DB;
  const dbUser = await getUserByUid(db, user.uid);
  if (!dbUser) return json({ error: "Unauthorized" }, 401);

  let body: { id?: string; reason?: string; note?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "Invalid body" }, 400);
  }

  const genId = body.id?.trim();
  const reason = body.reason?.trim();
  const note = (body.note ?? "").trim().slice(0, 1000) || null;
  if (!genId) return json({ error: "Missing generation id" }, 400);
  if (!isReportReason(reason)) return json({ error: "Invalid reason" }, 400);

  const gen = await db
    .prepare(`SELECT id, user_id, status FROM generations WHERE id = ? AND user_id = ?`)
    .bind(genId, dbUser.id)
    .first<{ id: string; user_id: number; status: string }>();
  if (!gen) return json({ error: "Generation not found" }, 404);

  const existing = await db
    .prepare(
      `SELECT id FROM generation_reports
       WHERE generation_id = ? AND user_id = ? AND status = 'open'
       LIMIT 1`
    )
    .bind(genId, dbUser.id)
    .first<{ id: string }>();
  if (existing) {
    return json({ ok: true, id: existing.id, alreadyReported: true });
  }

  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO generation_reports (id, generation_id, user_id, reason, note, status)
       VALUES (?, ?, ?, ?, ?, 'open')`
    )
    .bind(id, genId, dbUser.id, reason, note)
    .run();

  return json({ ok: true, id, genStatus: gen.status });
}
