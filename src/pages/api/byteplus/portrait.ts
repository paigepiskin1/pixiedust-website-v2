export const prerender = false;
import type { APIContext } from "astro";
import { createPortraitGroup, registerPortraitAsset } from "../../../lib/syncnode";
import { getSetting, setSetting } from "../../../lib/app-settings";

const PORTRAIT_GROUP_KEY = "byteplus_portrait_group";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

// Reuse a single Portrait Library group across the app (id cached in app_settings).
async function ensurePortraitGroup(apiKey: string, db: import("@cloudflare/workers-types").D1Database): Promise<string | null> {
  try {
    const cached = await getSetting(db, PORTRAIT_GROUP_KEY);
    if (cached) return cached;
    const gid = await createPortraitGroup(apiKey, "pixiedust-portraits");
    await setSetting(db, PORTRAIT_GROUP_KEY, gid);
    return gid;
  } catch (err) {
    console.error("[portrait] group ensure failed:", err);
    return null;
  }
}

/**
 * Register a just-uploaded image to the BytePlus Real-Human Portrait Library so a
 * real person can be used as a Seedance reference. Called once per upload (from
 * the studio) so registrations are spread out — this keeps generation fast and
 * avoids the rate-limit/timeout problems of registering many at generate time.
 *
 * Always returns a usable `ref`: the `asset://<id>` when the image registered as
 * a portrait, otherwise the raw URL (fine for non-person images).
 */
export async function POST({ request, locals }: APIContext) {
  if (!locals.user) return json({ error: "Sign in to upload." }, 401);
  const env = locals.runtime.env;

  let body: { url?: string };
  try {
    body = (await request.json()) as { url?: string };
  } catch {
    return json({ error: "Invalid body." }, 400);
  }
  const url = String(body.url ?? "");
  if (!/^https?:\/\//i.test(url)) return json({ error: "A valid image URL is required." }, 400);

  const groupId = await ensurePortraitGroup(env.SYNCNODE_API_KEY, env.DB);
  if (!groupId) return json({ ref: url, active: false });

  try {
    const r = await registerPortraitAsset(env.SYNCNODE_API_KEY, groupId, url);
    return json({ ref: r.active ? `asset://${r.assetId}` : url, active: r.active, reason: r.reason });
  } catch (err) {
    console.error("[portrait] register failed:", err);
    return json({ ref: url, active: false, reason: "error" });
  }
}
