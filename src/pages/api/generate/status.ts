export const prerender = false;
import type { APIContext } from "astro";
import { getUserByUid } from "../../../lib/users";
import { adjustBalance } from "../../../lib/credits";
import { pollStatus } from "../../../lib/syncnode";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

interface GenRow {
  id: string;
  user_id: number;
  provider: string;
  provider_job_id: string | null;
  status: string;
  output_url: string | null;
  error: string | null;
  credits_charged: number;
  credits_refunded: number;
}

export async function GET({ url, locals }: APIContext) {
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

  if (gen.status === "completed") {
    return json({ id, status: "completed", outputs: gen.output_url ? [gen.output_url] : [] });
  }
  if (gen.status === "failed") {
    return json({ id, status: "failed", error: gen.error, refunded: gen.credits_refunded > 0 });
  }
  if (!gen.provider_job_id) return json({ id, status: gen.status });

  const poll = await pollStatus(env.SYNCNODE_API_KEY, gen.provider, gen.provider_job_id);

  if (poll.status === "completed") {
    await db
      .prepare("UPDATE generations SET status = 'completed', output_url = ?, updated_at = datetime('now') WHERE id = ?")
      .bind(poll.outputs[0] ?? null, id)
      .run();
    return json({ id, status: "completed", outputs: poll.outputs });
  }

  if (poll.status === "failed") {
    if (gen.credits_refunded === 0 && gen.credits_charged > 0) {
      await adjustBalance(db, dbUser.id, gen.credits_charged, {
        reason: "generation_refund",
        refType: "generation",
        refId: id,
        note: "generation failed",
      });
    }
    await db
      .prepare("UPDATE generations SET status = 'failed', error = ?, credits_refunded = ?, updated_at = datetime('now') WHERE id = ?")
      .bind(poll.error ?? "Generation failed", gen.credits_charged, id)
      .run();
    return json({ id, status: "failed", error: poll.error, refunded: true });
  }

  return json({ id, status: "processing" });
}
