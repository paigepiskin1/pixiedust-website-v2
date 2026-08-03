export const prerender = false;
import type { APIContext } from "astro";
import { getUserByUid } from "../../../lib/users";
import {
  buildSyncnodeWebhookUrl,
  reconcileUserGenerations,
  syncnodeWebhookKey,
} from "../../../lib/generations";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

/** Sweep the caller's open SyncNode jobs into completed/failed in D1. */
export async function POST({ locals, request }: APIContext) {
  const user = locals.user;
  if (!user) return json({ error: "Unauthorized" }, 401);

  const env = locals.runtime.env;
  const dbUser = await getUserByUid(env.DB, user.uid);
  if (!dbUser) return json({ error: "Unauthorized" }, 401);

  // At most once per minute per user (KV) — AppShell may call this often.
  const minute = Math.floor(Date.now() / 60000);
  const rlKey = `gen_reconcile:${dbUser.id}:${minute}`;
  const already = await env.SESSIONS.get(rlKey);
  if (already) return json({ ok: true, skipped: true });
  await env.SESSIONS.put(rlKey, "1", { expirationTtl: 70 });

  const key = await syncnodeWebhookKey(env.SYNCNODE_API_KEY);
  const webhookUrl = buildSyncnodeWebhookUrl(new URL(request.url).origin, key);
  const stats = await reconcileUserGenerations(env, dbUser.id, { webhookUrl });
  return json({ ok: true, ...stats });
}
