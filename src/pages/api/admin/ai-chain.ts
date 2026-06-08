export const prerender = false;
import type { APIContext } from "astro";
import { adminActor } from "../../../lib/admin";
import { aiChain } from "../../../lib/ai";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

/** AI-build a multi-step (chained) template scaffold from a description. */
export async function POST({ request, locals }: APIContext) {
  const env = locals.runtime.env;
  if (!adminActor(request, locals, env.ADMIN_API_TOKEN)) return json({ error: "Forbidden" }, 403);

  let prompt: string | undefined;
  try {
    ({ prompt } = (await request.json()) as { prompt?: string });
  } catch {
    return json({ error: "Invalid body" }, 400);
  }
  if (!prompt || !prompt.trim()) return json({ error: "Describe the multi-step template you want first." }, 400);

  try {
    const t = await aiChain(env.OPENROUTER_API_KEY, prompt.trim());
    const steps = Array.isArray(t.steps_json) ? (t.steps_json as any[]) : [];
    const first = steps[0] ?? {};
    return json({
      id: t.id ?? "",
      title: t.title ?? "",
      kind: t.kind ?? "preset",
      type: t.type ?? "image",
      subtitle: t.subtitle ?? "",
      credit_cost: t.credit_cost ?? 5,
      tone: t.tone ?? "lilac",
      tags_json: JSON.stringify(t.tags ?? [], null, 2),
      fields_json: JSON.stringify(t.fields_json ?? [], null, 2),
      steps_json: JSON.stringify(t.steps_json ?? [], null, 2),
      // Mirror step 1 into the top-level payload so single-step test/save stays valid.
      model: first.model ?? "",
      input_json: JSON.stringify(first.input ?? {}, null, 2),
      stepCount: steps.length,
    });
  } catch (err) {
    return json({ error: "AI chain build failed: " + String((err as Error).message || err) }, 502);
  }
}
