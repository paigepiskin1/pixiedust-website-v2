export const prerender = false;
import type { APIContext } from "astro";
import { adminActor, auditAdmin } from "../../../lib/admin";
import { aiTemplate } from "../../../lib/ai";
import { fetchModelSchema } from "../../../lib/replicate-schema";
import { saveTemplate } from "../../../lib/template-write";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

// One-shot: describe a template in plain language (optionally pinning a model)
// and it's created. Designed for Claude Code ("create a film-noir preset").
export async function POST({ request, locals }: APIContext) {
  const env = locals.runtime.env;
  const actor = adminActor(request, locals, env.ADMIN_API_TOKEN);
  if (!actor) return json({ error: "Forbidden" }, 403);

  let body: { prompt?: string; model?: string; publish?: boolean };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "Invalid body" }, 400);
  }
  if (!body.prompt) return json({ error: "Provide a prompt describing the template." }, 400);

  try {
    const s = body.model ? await fetchModelSchema(env.REPLICATE_API_TOKEN, body.model) : undefined;
    const schema = s ? { model: s.modelRef, type: s.type, input: s.input, fields: s.fields } : undefined;
    const t = await aiTemplate(env.OPENROUTER_API_KEY, body.prompt, schema);
    if (body.model && !t.model) t.model = body.model;

    const d: Record<string, any> = {
      id: t.id,
      title: t.title,
      kind: t.kind,
      type: t.type,
      provider: t.model?.startsWith("fal-ai/") ? "fal" : "replicate",
      model: t.model,
      input_json: t.input_json,
      fields_json: t.fields_json,
      quality_json: { std: 1, pro: 1.5, cinema: 2.5 },
      aspects_json: t.aspects,
      quantities_json: t.quantities,
      tags_json: t.tags,
      credit_cost: t.credit_cost ?? (t.type === "video" ? 8 : 2),
      tone: t.tone ?? "lilac",
      accent: "var(--pd-lilac)",
      engine: t.engine ?? null,
      subtitle: t.subtitle ?? null,
      is_hidden: body.publish ? 0 : 1, // default hidden so it can be tested before going live
      sort_order: 0,
    };

    const res = await saveTemplate(env.DB, d);
    if (!res.ok) return json({ error: res.error, draft: d }, res.status ?? 400);
    await auditAdmin(env.DB, actor, "template.ai_create", "template", res.id ?? null, { prompt: body.prompt, model: t.model });
    return json({ ok: true, id: res.id, hidden: !body.publish, template: d });
  } catch (err) {
    return json({ error: "AI template failed: " + String((err as Error).message || err) }, 502);
  }
}
