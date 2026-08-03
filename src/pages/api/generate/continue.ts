export const prerender = false;
import type { APIContext } from "astro";
import {
  buildSyncnodeWebhookUrl,
  finishGenerationInBackground,
  syncnodeWebhookKey,
} from "../../../lib/generations";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

/**
 * Self-chaining finalizer. Each hop polls SyncNode for ~20s under waitUntil,
 * then GETs this endpoint again until the generation completes/fails.
 * Auth: shared `k` derived from SYNCNODE_API_KEY (same as webhook).
 */
export async function GET({ url, locals, request }: APIContext) {
  const env = locals.runtime.env;
  const expected = await syncnodeWebhookKey(env.SYNCNODE_API_KEY);
  const got = url.searchParams.get("k") || "";
  if (!got || got !== expected) return json({ error: "Unauthorized" }, 401);

  const id = url.searchParams.get("id");
  if (!id) return json({ error: "Missing id" }, 400);

  const hop = Math.max(0, Number(url.searchParams.get("hop") || "0") || 0);
  if (hop > 40) return json({ ok: true, stopped: "max_hops" });

  const origin = new URL(request.url).origin;
  const webhookUrl = buildSyncnodeWebhookUrl(origin, expected);
  const ctx = (locals.runtime as { ctx?: { waitUntil?: (p: Promise<unknown>) => void } }).ctx;
  const work = finishGenerationInBackground(env, id, {
    webhookUrl,
    origin,
    continueKey: expected,
    hop,
  }).catch((err) => console.error("[continue] error:", err));

  if (ctx?.waitUntil) ctx.waitUntil(work);
  else await work;

  return json({ ok: true, id, hop });
}
