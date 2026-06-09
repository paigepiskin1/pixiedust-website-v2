export const prerender = false;
import type { APIContext } from "astro";
import { adminActor, auditAdmin } from "../../../lib/admin";
import { getCategories, setCategories } from "../../../lib/categories";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

/** Manage the master category palette. Body: { action: "add"|"remove", name }. */
export async function POST({ request, locals }: APIContext) {
  const env = locals.runtime.env;
  const actor = adminActor(request, locals, env.ADMIN_API_TOKEN);
  if (!actor) return json({ error: "Forbidden" }, 403);

  let b: { action?: string; name?: string };
  try { b = (await request.json()) as typeof b; } catch { return json({ error: "Invalid body" }, 400); }

  const name = (b.name || "").trim().slice(0, 40);
  if (!name) return json({ error: "name required" }, 400);

  let cats = await getCategories(env.DB);
  if (b.action === "add") {
    if (!cats.some((c) => c.toLowerCase() === name.toLowerCase())) cats = [...cats, name];
  } else if (b.action === "remove") {
    cats = cats.filter((c) => c.toLowerCase() !== name.toLowerCase());
  } else {
    return json({ error: "unknown action" }, 400);
  }

  await setCategories(env.DB, cats);
  await auditAdmin(env.DB, actor, "category." + b.action, "category", name, null);
  return json({ ok: true, categories: cats });
}
