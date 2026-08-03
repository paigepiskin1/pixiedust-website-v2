export const prerender = false;
import type { APIContext } from "astro";
import { getUserByUid } from "../../../lib/users";
import {
  advanceGeneration,
  buildSyncnodeWebhookUrl,
  syncnodeWebhookKey,
  type GenRow,
} from "../../../lib/generations";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export async function GET({ url, locals, request }: APIContext) {
  const user = locals.user;
  if (!user) return json({ error: "Unauthorized" }, 401);

  const env = locals.runtime.env;
  const db = env.DB;
  const dbUser = await getUserByUid(db, user.uid);
  if (!dbUser) return json({ error: "Unauthorized" }, 401);

  const id = url.searchParams.get("id");
  if (!id) return json({ error: "Missing id" }, 400);

  const gen = await db.prepare("SELECT * FROM generations WHERE id = ? AND user_id = ?").bind(id, dbUser.id).first<GenRow>();
  if (!gen) return json({ error: "Not found" }, 404);

  const key = await syncnodeWebhookKey(env.SYNCNODE_API_KEY);
  const webhookUrl = buildSyncnodeWebhookUrl(new URL(request.url).origin, key);
  const result = await advanceGeneration(env, gen, webhookUrl);

  if (result.status === "completed") {
    return json({ id, status: "completed", outputs: result.outputs });
  }
  if (result.status === "failed") {
    return json({ id, status: "failed", error: result.error, refunded: result.refunded });
  }
  if (result.status === "processing" && result.step != null) {
    return json({ id, status: "processing", step: result.step, steps: result.steps });
  }
  return json({ id, status: "processing" });
}
