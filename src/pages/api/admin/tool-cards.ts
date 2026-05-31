export const prerender = false;
import type { APIContext } from "astro";
import { adminActor, auditAdmin } from "../../../lib/admin";
import { getSetting, setSetting } from "../../../lib/app-settings";
import { TOOL_CARDS_KEY, type ToolCardMap } from "../../../lib/tool-cards";
import { QUICK_TOOLS } from "../../../lib/content";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

const VALID_HREFS = new Set(QUICK_TOOLS.map((t) => t.href));

/** Set or clear the background media for a "Start a project" tool card.
 * Body: { href, url, type } to set, or { href, clear:true } to revert. */
export async function POST({ request, locals }: APIContext) {
  const env = locals.runtime.env;
  const actor = adminActor(request, locals, env.ADMIN_API_TOKEN);
  if (!actor) return json({ error: "Forbidden" }, 403);

  let body: { href?: string; url?: string; type?: string; clear?: boolean };
  try { body = (await request.json()) as typeof body; } catch { return json({ error: "Invalid body" }, 400); }
  if (!body.href || !VALID_HREFS.has(body.href)) return json({ error: "Unknown tool" }, 400);

  let map: ToolCardMap = {};
  try { map = JSON.parse((await getSetting(env.DB, TOOL_CARDS_KEY)) || "{}"); } catch { /* default {} */ }

  if (body.clear) {
    delete map[body.href];
  } else {
    if (!body.url) return json({ error: "url required" }, 400);
    map[body.href] = { url: body.url, type: body.type === "video" ? "video" : "image" };
  }

  await setSetting(env.DB, TOOL_CARDS_KEY, JSON.stringify(map));
  await auditAdmin(env.DB, actor, "tool_card.set", "tool_card", body.href, { clear: !!body.clear, type: body.type });
  return json({ ok: true, media: map[body.href] ?? null });
}
