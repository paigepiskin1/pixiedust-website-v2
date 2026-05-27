export const prerender = false;
import type { APIContext } from "astro";
import { getUserByUid } from "../../../lib/users";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

export async function POST({ request, locals }: APIContext) {
  const user = locals.user;
  if (!user) return json({ error: "Unauthorized" }, 401);
  const env = locals.runtime.env;
  const dbUser = await getUserByUid(env.DB, user.uid);
  if (!dbUser) return json({ error: "Unauthorized" }, 401);

  let id: string | undefined;
  try {
    ({ id } = (await request.json()) as { id?: string });
  } catch {
    return json({ error: "Invalid body" }, 400);
  }
  if (!id) return json({ error: "Missing id" }, 400);

  // Ownership-scoped delete (note: SyncNode does not handle CDN deletes, so the
  // Bunny asset is left in place — only the DB record is removed).
  const res = await env.DB.prepare("DELETE FROM generations WHERE id = ? AND user_id = ?").bind(id, dbUser.id).run();
  if (!res.meta.changes) return json({ error: "Not found" }, 404);
  return json({ ok: true });
}
