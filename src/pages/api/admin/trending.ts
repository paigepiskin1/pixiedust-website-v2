export const prerender = false;
import type { APIContext } from "astro";
import { adminActor, auditAdmin } from "../../../lib/admin";
import { getSetting, setSetting } from "../../../lib/app-settings";
import { TRENDING_KEY, type TrendingPick } from "../../../lib/trending";
import { getTemplate } from "../../../lib/templates";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

async function load(db: import("@cloudflare/workers-types").D1Database): Promise<TrendingPick[]> {
  try { const p = JSON.parse((await getSetting(db, TRENDING_KEY)) || "[]"); return Array.isArray(p) ? p : []; } catch { return []; }
}

/** Manage the curated "Trending this week" home rail.
 * Body actions: add_template {id} | add_custom {title,sub?,href,url,mediaType} |
 * remove {index} | move {index,dir:-1|1} | clear */
export async function POST({ request, locals }: APIContext) {
  const env = locals.runtime.env;
  const actor = adminActor(request, locals, env.ADMIN_API_TOKEN);
  if (!actor) return json({ error: "Forbidden" }, 403);

  let b: any;
  try { b = await request.json(); } catch { return json({ error: "Invalid body" }, 400); }

  let picks = await load(env.DB);

  switch (b.action) {
    case "add_template": {
      if (!b.id) return json({ error: "id required" }, 400);
      const t = await getTemplate(env.DB, String(b.id));
      if (!t) return json({ error: "Template not found" }, 404);
      if (picks.some((p) => p.kind === "template" && p.id === b.id)) return json({ error: "Already in the rail" }, 400);
      picks.push({ kind: "template", id: String(b.id) });
      break;
    }
    case "add_custom": {
      if (!b.title || !b.url) return json({ error: "title and url required" }, 400);
      picks.push({
        kind: "custom",
        title: String(b.title).slice(0, 80),
        sub: b.sub ? String(b.sub).slice(0, 120) : undefined,
        href: b.href ? String(b.href).slice(0, 300) : "#",
        url: String(b.url),
        mediaType: b.mediaType === "video" ? "video" : "image",
      });
      break;
    }
    case "remove": {
      const i = Number(b.index);
      if (!Number.isInteger(i) || i < 0 || i >= picks.length) return json({ error: "bad index" }, 400);
      picks.splice(i, 1);
      break;
    }
    case "move": {
      const i = Number(b.index), j = i + (Number(b.dir) < 0 ? -1 : 1);
      if (!Number.isInteger(i) || i < 0 || i >= picks.length || j < 0 || j >= picks.length) return json({ error: "bad move" }, 400);
      [picks[i], picks[j]] = [picks[j], picks[i]];
      break;
    }
    case "clear":
      picks = [];
      break;
    default:
      return json({ error: "unknown action" }, 400);
  }

  await setSetting(env.DB, TRENDING_KEY, JSON.stringify(picks));
  await auditAdmin(env.DB, actor, "trending.set", "trending", b.action, { count: picks.length });
  return json({ ok: true, count: picks.length });
}
