export const prerender = false;
import type { APIContext } from "astro";
import {
  advanceGenerationByJobId,
  buildSyncnodeWebhookUrl,
  extractSyncnodeJobId,
  syncnodeWebhookKey,
} from "../../../lib/generations";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

/**
 * SyncNode completion callback. We treat the payload as a hint and always
 * re-check SyncNode via pollStatus before writing D1 — so a forged/partial
 * body can't mark a job complete with a bad URL.
 */
export async function POST({ request, locals, url }: APIContext) {
  const env = locals.runtime.env;
  const expected = await syncnodeWebhookKey(env.SYNCNODE_API_KEY);
  const got = url.searchParams.get("k") || "";
  if (!got || got !== expected) return json({ error: "Unauthorized" }, 401);

  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }

  const jobId = extractSyncnodeJobId(body) || url.searchParams.get("job_id");
  if (!jobId) {
    // Acknowledge so SyncNode doesn't retry forever on empty probes.
    return json({ ok: true, ignored: true });
  }

  const webhookUrl = buildSyncnodeWebhookUrl(new URL(request.url).origin, expected);
  const result = await advanceGenerationByJobId(env, jobId, webhookUrl);
  return json({ ok: true, jobId, result: result.status });
}

/** Health / SyncNode URL verification probes. */
export async function GET({ url, locals }: APIContext) {
  const env = locals.runtime.env;
  const expected = await syncnodeWebhookKey(env.SYNCNODE_API_KEY);
  const got = url.searchParams.get("k") || "";
  if (!got || got !== expected) return json({ error: "Unauthorized" }, 401);
  return json({ ok: true });
}
