/**
 * Admin-only: poll a test generation job.
 * GET ?jobId=...&provider=...
 * Returns { status: "processing"|"completed"|"failed", output_url?, error? }
 */
export const prerender = false;
import type { APIContext } from "astro";
import { adminActor } from "../../../../lib/admin";
import { pollStatus } from "../../../../lib/syncnode";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

export async function GET({ request, url, locals }: APIContext) {
  const env = locals.runtime.env;
  if (!adminActor(request, locals, env.ADMIN_API_TOKEN)) return json({ error: "Forbidden" }, 403);

  const jobId   = url.searchParams.get("jobId") ?? "";
  const provider = url.searchParams.get("provider") ?? "replicate";
  if (!jobId) return json({ error: "jobId required" }, 400);

  try {
    const result = await pollStatus(env.SYNCNODE_API_KEY, provider, jobId);
    return json({
      status: result.status,
      output_url: result.outputs?.[0] ?? null,
      error: result.error ?? null,
    });
  } catch (err) {
    return json({ error: String((err as Error).message || err) }, 502);
  }
}
