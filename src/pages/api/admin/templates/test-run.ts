/**
 * Admin-only: submit a test generation using raw template params (no saved template needed).
 * POST { provider, model, input_json, field_values: { key: value } }
 * Returns { jobId, provider }
 */
export const prerender = false;
import type { APIContext } from "astro";
import { adminActor } from "../../../../lib/admin";
import { submitGeneration } from "../../../../lib/syncnode";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

export async function POST({ request, locals }: APIContext) {
  const env = locals.runtime.env;
  if (!adminActor(request, locals, env.ADMIN_API_TOKEN)) return json({ error: "Forbidden" }, 403);

  let body: Record<string, any>;
  try { body = await request.json(); } catch { return json({ error: "Invalid body" }, 400); }

  const { provider = "replicate", model, input_json, field_values = {} } = body;
  if (!model) return json({ error: "model is required" }, 400);
  if (!input_json) return json({ error: "input_json is required" }, 400);

  // Substitute {{key}} placeholders with field_values
  let inputStr = typeof input_json === "string" ? input_json : JSON.stringify(input_json);
  for (const [k, v] of Object.entries(field_values as Record<string, string>)) {
    inputStr = inputStr.replace(new RegExp(`\\{\\{${k}(\\*?)\\}\\}`, "g"), String(v ?? ""));
  }

  let input: Record<string, unknown>;
  try { input = JSON.parse(inputStr); } catch { return json({ error: "input_json is invalid JSON after substitution" }, 400); }

  try {
    const { jobId } = await submitGeneration(env.SYNCNODE_API_KEY, { provider, model, input });
    return json({ ok: true, jobId, provider });
  } catch (err) {
    return json({ error: String((err as Error).message || err) }, 502);
  }
}
