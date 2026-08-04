export const prerender = false;
import type { APIContext } from "astro";
import { getUserByUid } from "../../../lib/users";
import { advanceGeneration, type GenRow } from "../../../lib/advance-generation";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
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

  const gen = await db
    .prepare(
      `SELECT id, user_id, provider, provider_job_id, status, output_url, error,
              credits_charged, credits_refunded, chain_json
       FROM generations WHERE id = ? AND user_id = ?`
    )
    .bind(id, dbUser.id)
    .first<GenRow>();
  if (!gen) return json({ error: "Not found" }, 404);

  if (gen.status === "completed") {
    return json({ id, status: "completed", outputs: gen.output_url ? [gen.output_url] : [] });
  }
  if (gen.status === "failed") {
    return json({ id, status: "failed", error: gen.error, refunded: gen.credits_refunded > 0 });
  }
  if (!gen.provider_job_id) return json({ id, status: gen.status });

  const result = await advanceGeneration(db, env.SYNCNODE_API_KEY, gen);
  if (result.status === "completed") {
    return json({ id, status: "completed", outputs: result.outputs });
  }
  if (result.status === "failed") {
    return json({ id, status: "failed", error: result.error, refunded: result.refunded });
  }
  if (result.status === "processing" && result.step != null) {
    return json({ id, status: "processing", step: result.step, steps: result.steps });
  }
  return json({ id, status: result.status === "pending" ? "pending" : "processing" });
}
