export const prerender = false;
import type { APIContext } from "astro";
import { getUserByUid, toPublicUser } from "../../lib/users";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

export async function POST({ request, locals }: APIContext) {
  const user = locals.user;
  if (!user) return json({ error: "Unauthorized" }, 401);
  const env = locals.runtime.env;
  const dbUser = await getUserByUid(env.DB, user.uid);
  if (!dbUser) return json({ error: "Unauthorized" }, 401);

  let body: { name?: string; username?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "Invalid body" }, 400);
  }

  const name = typeof body.name === "string" ? body.name.trim().slice(0, 60) : undefined;
  let username = typeof body.username === "string" ? body.username.trim().toLowerCase().slice(0, 40) : undefined;
  if (username !== undefined) {
    if (username && !/^[a-z0-9._-]{2,40}$/.test(username)) {
      return json({ error: "Handle can use letters, numbers, dot, dash, underscore (2–40 chars)." }, 400);
    }
    if (!username) username = undefined;
  }

  try {
    await env.DB.prepare("UPDATE users SET name = COALESCE(?, name), username = COALESCE(?, username) WHERE id = ?")
      .bind(name ?? null, username ?? null, dbUser.id)
      .run();
  } catch (err) {
    if (String(err).includes("UNIQUE")) return json({ error: "That handle is taken." }, 409);
    return json({ error: "Could not update profile." }, 500);
  }

  const updated = await getUserByUid(env.DB, user.uid);
  return json({ user: updated ? toPublicUser(updated) : null });
}
