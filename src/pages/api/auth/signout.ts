export const prerender = false;
import type { APIContext } from "astro";
import { destroySession, SESSION_COOKIE } from "../../../lib/session";

export async function POST({ locals, cookies }: APIContext) {
  try {
    const sid = cookies.get(SESSION_COOKIE)?.value;
    await destroySession(locals.runtime.env.SESSIONS, sid);
  } catch {
    // best-effort
  }
  cookies.delete(SESSION_COOKIE, { path: "/" });
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
