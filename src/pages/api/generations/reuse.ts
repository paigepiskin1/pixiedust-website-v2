export const prerender = false;
import type { APIContext } from "astro";
import { getReusePayload } from "../../../lib/reuse-inputs";
import { getUserByUid } from "../../../lib/users";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

/** Return saved prompt + reference images for prefilling a new generation (no processing). */
export async function GET({ url, locals }: APIContext) {
  const user = locals.user;
  if (!user) return json({ error: "Sign in to reuse inputs." }, 401);

  const id = url.searchParams.get("id");
  if (!id) return json({ error: "Missing id" }, 400);

  const dbUser = await getUserByUid(locals.runtime.env.DB, user.uid);
  if (!dbUser) return json({ error: "Account not found." }, 401);

  const payload = await getReusePayload(locals.runtime.env.DB, id, dbUser.id);
  if (!payload) return json({ error: "Not found" }, 404);

  return json(payload);
}
