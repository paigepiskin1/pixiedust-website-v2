export const prerender = false;
import type { APIContext } from "astro";
import { adminActor } from "../../../lib/admin";
import { fetchModelSchema } from "../../../lib/replicate-schema";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

export async function POST({ request, locals }: APIContext) {
  const env = locals.runtime.env;
  if (!adminActor(request, locals, env.ADMIN_API_TOKEN)) return json({ error: "Forbidden" }, 403);
  let model: string | undefined;
  try {
    ({ model } = (await request.json()) as { model?: string });
  } catch {
    return json({ error: "Invalid body" }, 400);
  }
  if (!model) return json({ error: "Enter a model id (owner/name)." }, 400);

  try {
    const r = await fetchModelSchema(env.REPLICATE_API_TOKEN, model);
    return json({
      title: r.title,
      type: r.type,
      model: r.modelRef,
      input_json: JSON.stringify(r.input, null, 2),
      fields_json: JSON.stringify(r.fields, null, 2),
    });
  } catch (err) {
    return json({ error: String((err as Error).message || err) }, 502);
  }
}
