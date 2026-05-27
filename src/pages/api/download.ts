// Protected download proxy: verifies session ownership then streams from CDN.
// Prevents raw Bunny CDN URLs from being shared as direct links.
export const prerender = false;
import type { APIContext } from "astro";
import { getUserByUid } from "../../lib/users";

export async function GET({ request, locals }: APIContext) {
  const user = locals.user;
  if (!user) return new Response(null, { status: 401 });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return new Response("Missing id", { status: 400 });

  const db = locals.runtime.env.DB;
  const dbUser = await getUserByUid(db, user.uid);
  if (!dbUser) return new Response(null, { status: 401 });

  const row = await db
    .prepare(
      `SELECT output_url, type FROM generations
       WHERE id = ? AND user_id = ? AND status = 'completed'`
    )
    .bind(id, dbUser.id)
    .first<{ output_url: string; type: string }>();

  if (!row) return new Response(null, { status: 404 });

  const upstream = await fetch(row.output_url);
  if (!upstream.ok) return new Response(null, { status: 502 });

  const ext = row.type === "video" ? "mp4" : "jpg";
  const ct =
    upstream.headers.get("Content-Type") ||
    (row.type === "video" ? "video/mp4" : "image/jpeg");

  return new Response(upstream.body, {
    headers: {
      "Content-Type": ct,
      "Content-Disposition": `attachment; filename="pixiedust-${id.slice(0, 8)}.${ext}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
