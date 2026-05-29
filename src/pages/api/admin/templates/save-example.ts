/**
 * Admin-only: save a test generation result as an example in the generations table.
 * POST { template_id, url, type, provider?, model? }
 * Inserts a completed generation row so it appears in the template's Examples section.
 */
export const prerender = false;
import type { APIContext } from "astro";
import { adminActor } from "../../../../lib/admin";
import { getUserByUid } from "../../../../lib/users";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

function uuid(): string {
  return crypto.randomUUID();
}

export async function POST({ request, locals }: APIContext) {
  const env = locals.runtime.env;
  const actor = adminActor(request, locals, env.ADMIN_API_TOKEN);
  if (!actor) return json({ error: "Forbidden" }, 403);

  let body: { template_id?: string; url?: string; type?: string; provider?: string; model?: string };
  try { body = await request.json(); } catch { return json({ error: "Invalid body" }, 400); }

  const { template_id, url, type = "image", provider = "replicate", model = "" } = body;
  if (!template_id) return json({ error: "template_id required" }, 400);
  if (!url) return json({ error: "url required" }, 400);

  // Look up the admin's integer user id (generations.user_id is NOT NULL)
  const user = locals.user;
  const dbUser = user ? await getUserByUid(env.DB, user.uid) : null;
  if (!dbUser) return json({ error: "Admin user not found in DB" }, 400);

  const id = uuid();
  await env.DB.prepare(`
    INSERT INTO generations
      (id, user_id, template_id, type, provider, model, input_json, status, output_url, is_public, credits_charged)
    VALUES (?, ?, ?, ?, ?, ?, '{}', 'completed', ?, 0, 0)
  `).bind(id, dbUser.id, template_id, type, provider, model, url).run();

  return json({ ok: true, id });
}
