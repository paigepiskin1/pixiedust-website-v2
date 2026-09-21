export const prerender = false;
import type { APIContext } from "astro";
import { inspectProductLink } from "../../../lib/product-link";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

/** 8 inspects per minute per user (KV). */
async function rateLimit(
  kv: import("@cloudflare/workers-types").KVNamespace,
  uid: string
): Promise<boolean> {
  const minute = Math.floor(Date.now() / 60000);
  const key = `product_link_rl:${uid}:${minute}`;
  const current = Number(await kv.get(key)) || 0;
  if (current >= 8) return false;
  await kv.put(key, String(current + 1), { expirationTtl: 70 });
  return true;
}

export async function POST({ request, locals }: APIContext) {
  const user = locals.user;
  if (!user) return json({ error: "Sign in to paste a product link." }, 401);

  const env = locals.runtime.env;
  if (!(await rateLimit(env.SESSIONS, user.uid))) {
    return json({ error: "Too many link checks — wait a minute and try again." }, 429);
  }

  let url: string | undefined;
  try {
    ({ url } = (await request.json()) as { url?: string });
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }
  if (!url || typeof url !== "string") return json({ error: "Paste a product link first." }, 400);

  try {
    const result = await inspectProductLink(env, user.uid, url);
    return json({
      ok: true,
      pageUrl: result.pageUrl,
      images: result.images.map((i) => ({ url: i.url, sourceUrl: i.sourceUrl })),
      details: result.details,
    });
  } catch (err) {
    const msg = String((err as Error)?.message || err);
    // Don't leak internal fetch details
    const safe =
      /https|host|redirect|long|valid|empty|image|product|reach|respond|large|error \(\d+\)|securely|supported|small/i.test(
        msg
      )
        ? msg
        : "Couldn’t read that product link.";
    return json({ error: safe }, 400);
  }
}
