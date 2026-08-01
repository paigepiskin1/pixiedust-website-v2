/**
 * Admin-only: submit a test generation using raw template params (no saved template needed).
 * POST { provider, model, input_json, field_values: { key: value } }
 * Returns { jobId, provider }
 */
export const prerender = false;
import type { APIContext } from "astro";
import { adminActor } from "../../../../lib/admin";
import { submitGeneration } from "../../../../lib/syncnode";
import { prepareByteplusAssets } from "../../../../lib/byteplus-assets";

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

  // Parse first, then walk and substitute — so an exact-match placeholder keeps
  // the field's real type (arrays for multi-file {{files*}}, numbers, etc.).
  // Inline placeholders inside a longer string are stringified. Mirrors the
  // studio's resolveInput so the test matches real generation.
  let parsed: unknown;
  try {
    parsed = typeof input_json === "string" ? JSON.parse(input_json) : input_json;
  } catch {
    return json({ error: "input_json is invalid JSON" }, 400);
  }

  const fields = field_values as Record<string, unknown>;
  const sub = (v: unknown): unknown => {
    if (typeof v === "string") {
      const exact = v.match(/^\{\{(\w+)\*?\}\}$/);
      if (exact) {
        const val = fields[exact[1]];
        return val === undefined ? "" : val; // preserves arrays / numbers / strings
      }
      return v.replace(/\{\{(\w+)\*?\}\}/g, (_, k: string) => {
        const val = fields[k];
        return val == null ? "" : String(val);
      });
    }
    if (Array.isArray(v)) return v.map(sub);
    if (v && typeof v === "object") {
      const o: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) o[k] = sub(val);
      return o;
    }
    return v;
  };

  const input = sub(parsed) as Record<string, unknown>;

  // Drop params that resolved to an empty string (e.g. an unfilled {{aspect}}).
  // Sending "" makes some models hard-fail (e.g. nano-banana 502 on empty
  // aspect_ratio); omitting lets the model use its default instead.
  if (input && typeof input === "object") {
    for (const k of Object.keys(input)) if (input[k] === "") delete input[k];
  }

  try {
    // Mirror the real generate path: optionally register images in the BytePlus
    // asset library and swap them for asset://<id> refs before submitting.
    if (provider === "byteplus" && body.assetLibrary) {
      await prepareByteplusAssets(env.SYNCNODE_API_KEY, env.DB, input);
    }
    const { jobId } = await submitGeneration(env.SYNCNODE_API_KEY, { provider, model, input });
    return json({ ok: true, jobId, provider, input });
  } catch (err) {
    return json({ error: String((err as Error).message || err) }, 502);
  }
}
