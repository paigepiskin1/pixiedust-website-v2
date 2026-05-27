export const prerender = false;
import type { APIContext } from "astro";
import { readSession, SESSION_COOKIE } from "../../../lib/session";
import { getUserByUid, toPublicUser } from "../../../lib/users";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export async function GET({ locals, cookies }: APIContext) {
  try {
    const env = locals.runtime.env;
    const sid = cookies.get(SESSION_COOKIE)?.value;
    const uid = await readSession(env.SESSIONS, sid);
    if (!uid) return json({ user: null });
    const user = await getUserByUid(env.DB, uid);
    return json({ user: user ? toPublicUser(user) : null });
  } catch {
    return json({ user: null });
  }
}
