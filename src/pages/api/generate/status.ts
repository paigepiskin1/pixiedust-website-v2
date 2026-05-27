export const prerender = false;
import type { APIContext } from "astro";
import { getUserByUid } from "../../../lib/users";
import { adjustBalance } from "../../../lib/credits";
import { pollStatus, submitGeneration } from "../../../lib/syncnode";
import { resolveChainStep } from "../../../lib/templates";

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
  chain_json: string | null;
}

interface ChainStep {
  id: string;
  provider: string;
  model: string;
  input: Record<string, unknown>;
  jobId: string | null;
  output: string | null;
  status: string;
}
interface Chain {
  stepIndex: number;
  userInputs: Record<string, unknown>;
  steps: ChainStep[];
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

  const refundFail = async (error: string) => {
    if (gen.credits_refunded === 0 && gen.credits_charged > 0) {
      await adjustBalance(db, dbUser.id, gen.credits_charged, { reason: "generation_refund", refType: "generation", refId: id, note: "generation failed" });
    }
    await db
      .prepare("UPDATE generations SET status='failed', error=?, credits_refunded=?, updated_at=datetime('now') WHERE id=?")
      .bind(error, gen.credits_charged, id)
      .run();
    return json({ id, status: "failed", error, refunded: true });
  };

  // ─── Multi-step chain state machine ───
  if (gen.chain_json) {
    const chain = JSON.parse(gen.chain_json) as Chain;
    const cur = chain.steps[chain.stepIndex];
    const poll = await pollStatus(env.SYNCNODE_API_KEY, cur.provider, cur.jobId!);
    if (poll.status === "failed") return refundFail(`Step ${chain.stepIndex + 1} failed: ${poll.error ?? ""}`);
    if (poll.status !== "completed") return json({ id, status: "processing", step: chain.stepIndex + 1, steps: chain.steps.length });

    cur.output = poll.outputs[0] ?? null;
    cur.status = "completed";

    if (chain.stepIndex < chain.steps.length - 1) {
      const outputs: Record<string, string> = {};
      for (const s of chain.steps) if (s.output) outputs[s.id] = s.output;
      const next = chain.steps[chain.stepIndex + 1];
      const nextInput = resolveChainStep(next.input, { user: chain.userInputs, outputs }) as Record<string, unknown>;
      try {
        const { jobId } = await submitGeneration(env.SYNCNODE_API_KEY, { provider: next.provider, model: next.model, input: nextInput });
        next.jobId = jobId;
        next.status = "processing";
        chain.stepIndex += 1;
        await db
          .prepare("UPDATE generations SET provider_job_id=?, chain_json=?, input_json=?, updated_at=datetime('now') WHERE id=?")
          .bind(jobId, JSON.stringify(chain), JSON.stringify(nextInput), id)
          .run();
        return json({ id, status: "processing", step: chain.stepIndex + 1, steps: chain.steps.length });
      } catch (err) {
        return refundFail(`Step ${chain.stepIndex + 2} dispatch failed: ${String((err as Error).message || err)}`);
      }
    }

    // last step done
    await db
      .prepare("UPDATE generations SET status='completed', output_url=?, chain_json=?, updated_at=datetime('now') WHERE id=?")
      .bind(cur.output, JSON.stringify(chain), id)
      .run();
    return json({ id, status: "completed", outputs: cur.output ? [cur.output] : [] });
  }

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
