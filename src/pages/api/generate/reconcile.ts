export const prerender = false;
import type { APIContext } from "astro";
import { getUserByUid } from "../../../lib/users";
import { reconcileUserGenerations } from "../../../lib/reconcile-generations";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

/** Reconcile this user's stuck pending/processing generations against SyncNode. */
export async function POST({ locals }: APIContext) {
  const user = locals.user;
  if (!user) return json({ error: "Unauthorized" }, 401);

  const env = locals.runtime.env;
  const dbUser = await getUserByUid(env.DB, user.uid);
  if (!dbUser) return json({ error: "Unauthorized" }, 401);
  if (!env.SYNCNODE_API_KEY) return json({ error: "Not configured" }, 500);

  const result = await reconcileUserGenerations(env.DB, env.SYNCNODE_API_KEY, dbUser.id, {
    limit: 30,
    olderThanMinutes: 1,
  });
  return json({ ok: true, ...result });
}
