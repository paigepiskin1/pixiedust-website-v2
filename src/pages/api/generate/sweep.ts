export const prerender = false;
import type { APIContext } from "astro";
import {
  buildSyncnodeWebhookUrl,
  reconcileOpenGenerations,
  syncnodeWebhookKey,
} from "../../../lib/generations";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

/**
 * System-wide recovery sweep — pull finished/failed SyncNode jobs into D1.
 * GET with `k=` (same secret as webhook). Safe to hit from cron or manually.
 */
export async function GET({ url, locals, request }: APIContext) {
  const env = locals.runtime.env;
  const expected = await syncnodeWebhookKey(env.SYNCNODE_API_KEY);
  const got = url.searchParams.get("k") || "";
  if (!got || got !== expected) return json({ error: "Unauthorized" }, 401);

  const webhookUrl = buildSyncnodeWebhookUrl(new URL(request.url).origin, expected);
  const stats = await reconcileOpenGenerations(env, {
    limit: Math.min(50, Math.max(1, Number(url.searchParams.get("limit") || "25") || 25)),
    webhookUrl,
  });
  return json({ ok: true, ...stats });
}
