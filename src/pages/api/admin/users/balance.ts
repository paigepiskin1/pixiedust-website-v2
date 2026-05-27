export const prerender = false;
import type { APIContext } from "astro";
import { isAdmin, auditAdmin } from "../../../../lib/admin";
import { getUserByUid } from "../../../../lib/users";
import { adjustBalance } from "../../../../lib/credits";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

export async function POST({ request, locals }: APIContext) {
  if (!isAdmin(locals)) return json({ error: "Forbidden" }, 403);
  const env = locals.runtime.env;

  let body: { uid?: string; delta?: number; reason?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "Invalid body" }, 400);
  }
  const delta = Math.trunc(Number(body.delta));
  if (!body.uid || !delta) return json({ error: "uid and non-zero delta required" }, 400);

  const target = await getUserByUid(env.DB, body.uid);
  if (!target) return json({ error: "User not found" }, 404);

  const { balance } = await adjustBalance(env.DB, target.id, delta, {
    reason: "admin_adjust",
    note: body.reason || "admin adjustment",
    actor: locals.user!.uid,
  });
  await auditAdmin(env.DB, locals.user!.uid, "user.balance_adjust", "user", body.uid, { delta, reason: body.reason, balance });
  return json({ ok: true, balance });
}
