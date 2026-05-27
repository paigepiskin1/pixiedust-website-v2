export const prerender = false;
import type { APIContext } from "astro";
import { adminActor } from "../../../../lib/admin";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

// Full template row (for Claude Code / admin tooling to read before editing).
export async function GET({ request, params, locals }: APIContext) {
  const env = locals.runtime.env;
  if (!adminActor(request, locals, env.ADMIN_API_TOKEN)) return json({ error: "Forbidden" }, 403);
  const row = await env.DB.prepare("SELECT * FROM templates WHERE id = ?").bind(params.id).first();
  if (!row) return json({ error: "Not found" }, 404);
  return json({ template: row });
}
