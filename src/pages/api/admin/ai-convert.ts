export const prerender = false;
import type { APIContext } from "astro";
import { isAdmin } from "../../../lib/admin";
import { aiConvert } from "../../../lib/ai";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

export async function POST({ request, locals }: APIContext) {
  if (!isAdmin(locals)) return json({ error: "Forbidden" }, 403);
  const env = locals.runtime.env;
  let raw: string | undefined;
  try {
    ({ raw } = (await request.json()) as { raw?: string });
  } catch {
    return json({ error: "Invalid body" }, 400);
  }
  if (!raw || !raw.trim()) return json({ error: "Paste some params or a description first." }, 400);

  try {
    const r = await aiConvert(env.OPENROUTER_API_KEY, raw);
    return json({
      input_json: JSON.stringify(r.input, null, 2),
      fields_json: JSON.stringify(r.fields, null, 2),
    });
  } catch (err) {
    return json({ error: "AI convert failed: " + String((err as Error).message || err) }, 502);
  }
}
