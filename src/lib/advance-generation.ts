// Single place that advances a generation against SyncNode and writes D1.
// Used by the studio status poll, background waitUntil, and reconcile sweeps.
import type { D1Database } from "@cloudflare/workers-types";
import { adjustBalance } from "./credits";
import { pollStatus, submitGeneration } from "./syncnode";
import { resolveChainStep } from "./templates";

export interface GenRow {
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

export type AdvanceResult =
  | { status: "completed"; outputs: string[] }
  | { status: "failed"; error: string; refunded: boolean }
  | { status: "processing"; step?: number; steps?: number }
  | { status: "pending" };

async function markFailed(
  db: D1Database,
  gen: GenRow,
  error: string
): Promise<AdvanceResult> {
  let refunded = false;
  if (gen.credits_refunded === 0 && gen.credits_charged > 0) {
    await adjustBalance(db, gen.user_id, gen.credits_charged, {
      reason: "generation_refund",
      refType: "generation",
      refId: gen.id,
      note: "generation failed",
    });
    refunded = true;
  }
  await db
    .prepare(
      `UPDATE generations
       SET status='failed', error=?, credits_refunded=?, updated_at=datetime('now')
       WHERE id=? AND status IN ('pending', 'processing')`
    )
    .bind(error, gen.credits_charged, gen.id)
    .run();
  return { status: "failed", error, refunded };
}

/** One poll tick: complete, fail, advance a chain step, or stay processing. */
export async function advanceGeneration(
  db: D1Database,
  apiKey: string,
  gen: GenRow
): Promise<AdvanceResult> {
  if (gen.status === "completed") {
    return { status: "completed", outputs: gen.output_url ? [gen.output_url] : [] };
  }
  if (gen.status === "failed") {
    return { status: "failed", error: gen.error ?? "Generation failed", refunded: gen.credits_refunded > 0 };
  }
  if (!gen.provider_job_id) {
    return { status: gen.status === "pending" ? "pending" : "processing" };
  }

  // ─── Multi-step chain ───
  if (gen.chain_json) {
    const chain = JSON.parse(gen.chain_json) as Chain;
    const cur = chain.steps[chain.stepIndex];
    if (!cur?.jobId) return { status: "processing", step: chain.stepIndex + 1, steps: chain.steps.length };

    const poll = await pollStatus(apiKey, cur.provider, cur.jobId);
    if (poll.status === "failed") {
      return markFailed(db, gen, `Step ${chain.stepIndex + 1} failed: ${poll.error ?? ""}`);
    }
    if (poll.status !== "completed") {
      return { status: "processing", step: chain.stepIndex + 1, steps: chain.steps.length };
    }

    cur.output = poll.outputs[0] ?? null;
    cur.status = "completed";

    if (chain.stepIndex < chain.steps.length - 1) {
      const outputs: Record<string, string> = {};
      for (const s of chain.steps) if (s.output) outputs[s.id] = s.output;
      const next = chain.steps[chain.stepIndex + 1];
      const nextInput = resolveChainStep(next.input, { user: chain.userInputs, outputs }) as Record<string, unknown>;
      try {
        const { jobId } = await submitGeneration(apiKey, {
          provider: next.provider,
          model: next.model,
          input: nextInput,
        });
        next.jobId = jobId;
        next.status = "processing";
        chain.stepIndex += 1;
        await db
          .prepare(
            "UPDATE generations SET provider_job_id=?, chain_json=?, input_json=?, updated_at=datetime('now') WHERE id=?"
          )
          .bind(jobId, JSON.stringify(chain), JSON.stringify(nextInput), gen.id)
          .run();
        return { status: "processing", step: chain.stepIndex + 1, steps: chain.steps.length };
      } catch (err) {
        const detail = String((err as Error).message || err || "Pipeline step failed");
        return markFailed(db, gen, `Step ${chain.stepIndex + 2} failed to start: ${detail}`);
      }
    }

    await db
      .prepare(
        "UPDATE generations SET status='completed', output_url=?, chain_json=?, updated_at=datetime('now') WHERE id=?"
      )
      .bind(cur.output, JSON.stringify(chain), gen.id)
      .run();
    return { status: "completed", outputs: cur.output ? [cur.output] : [] };
  }

  // ─── Single step ───
  const poll = await pollStatus(apiKey, gen.provider, gen.provider_job_id);
  if (poll.status === "completed") {
    await db
      .prepare(
        `UPDATE generations
         SET status='completed', output_url=?, updated_at=datetime('now')
         WHERE id=? AND status IN ('pending', 'processing')`
      )
      .bind(poll.outputs[0] ?? null, gen.id)
      .run();
    return { status: "completed", outputs: poll.outputs };
  }
  if (poll.status === "failed") {
    return markFailed(db, gen, poll.error ?? "Generation failed");
  }
  return { status: "processing" };
}

/**
 * Keep polling a single generation in the background (waitUntil) until it
 * reaches a terminal state or we hit the attempt cap.
 */
export async function finalizeGenerationInBackground(
  db: D1Database,
  apiKey: string,
  genId: string,
  opts: { maxAttempts?: number; intervalMs?: number } = {}
): Promise<void> {
  const maxAttempts = opts.maxAttempts ?? 90; // ~6 min at 4s
  const intervalMs = opts.intervalMs ?? 4000;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, intervalMs));
    const gen = await db
      .prepare(
        `SELECT id, user_id, provider, provider_job_id, status, output_url, error,
                credits_charged, credits_refunded, chain_json
         FROM generations WHERE id = ?`
      )
      .bind(genId)
      .first<GenRow>();
    if (!gen) return;
    if (gen.status === "completed" || gen.status === "failed") return;
    try {
      const result = await advanceGeneration(db, apiKey, gen);
      if (result.status === "completed" || result.status === "failed") return;
    } catch (err) {
      console.error("[advance] background tick failed:", genId, err);
    }
  }
}
