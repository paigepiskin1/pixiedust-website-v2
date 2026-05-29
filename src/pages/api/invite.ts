/**
 * GET /api/invite — returns the signed-in user's invite code, share link, and
 * how many of their invites have been used. 401 if not signed in.
 */
export const prerender = false;
import type { APIContext } from "astro";
import { getInviteStats } from "../../lib/referrals";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

export async function GET({ locals, url }: APIContext) {
  const user = locals.user;
  if (!user) return json({ error: "Sign in to get your invite link" }, 401);

  const stats = await getInviteStats(locals.runtime.env.DB, user.uid);
  return json({ ...stats, link: `${url.origin}/?ref=${stats.code}` });
}
