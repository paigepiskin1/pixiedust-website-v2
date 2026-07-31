// Reconcile in-flight generations against SyncNode when the client stopped polling.
// Gallery/studio status updates are browser-driven; if a tab closes mid-run the
// upstream job can finish while D1 stays on `processing`.
import type { D1Database } from "@cloudflare/workers-types";
import { adjustBalance } from "./credits";
import { pollStatus } from "./syncnode";

interface GenRow {
  id: string;
  provider: string;
  provider_job_id: string | null;
  status: string;
  credits_charged: number;
  credits_refunded: number;
  chain_json: string | null;
}

export interface ReconcileResult {
  completed: number;
  failed: number;
  skipped: number;
}

/**
 * Poll SyncNode for a user's pending/processing generations and write terminal
 * status (+ refunds) back to D1. Skips multi-step chains (those need the status
 * route's step dispatcher). Caps work per call so gallery loads stay snappy.
 */
export async function reconcileUserGenerations(
  db: D1Database,
  apiKey: string,
  userId: number,
  opts: { limit?: number; olderThanMinutes?: number } = {}
): Promise<ReconcileResult> {
  const limit = Math.max(1, Math.min(opts.limit ?? 20, 40));
  // Only touch gens that have had a chance to finish / aren't actively polled.
  const olderThan = Math.max(0, opts.olderThanMinutes ?? 2);

  const { results } = await db
    .prepare(
      `SELECT id, provider, provider_job_id, status, credits_charged, credits_refunded, chain_json
       FROM generations
       WHERE user_id = ?
         AND status IN ('pending', 'processing')
         AND created_at < datetime('now', ?)
       ORDER BY created_at ASC
       LIMIT ?`
    )
    .bind(userId, `-${olderThan} minutes`, limit)
    .all<GenRow>();

  let completed = 0;
  let failed = 0;
  let skipped = 0;

  for (const gen of results ?? []) {
    // Multi-step chains advance via /api/generate/status — don't half-apply here.
    if (gen.chain_json) {
      skipped++;
      continue;
    }

    if (!gen.provider_job_id) {
      // Never made it to the provider (crash between debit and submit).
      if (gen.credits_refunded === 0 && gen.credits_charged > 0) {
        await adjustBalance(db, userId, gen.credits_charged, {
          reason: "generation_refund",
          refType: "generation",
          refId: gen.id,
          note: "abandoned pending generation",
        });
      }
      await db
        .prepare(
          `UPDATE generations
           SET status = 'failed',
               error = ?,
               credits_refunded = ?,
               updated_at = datetime('now')
           WHERE id = ? AND status IN ('pending', 'processing')`
        )
        .bind("Abandoned — never submitted to provider", gen.credits_charged, gen.id)
        .run();
      failed++;
      continue;
    }

    try {
      const poll = await pollStatus(apiKey, gen.provider, gen.provider_job_id);
      if (poll.status === "completed") {
        await db
          .prepare(
            `UPDATE generations
             SET status = 'completed',
                 output_url = ?,
                 updated_at = datetime('now')
             WHERE id = ? AND status IN ('pending', 'processing')`
          )
          .bind(poll.outputs[0] ?? null, gen.id)
          .run();
        completed++;
      } else if (poll.status === "failed") {
        if (gen.credits_refunded === 0 && gen.credits_charged > 0) {
          await adjustBalance(db, userId, gen.credits_charged, {
            reason: "generation_refund",
            refType: "generation",
            refId: gen.id,
            note: "generation failed",
          });
        }
        await db
          .prepare(
            `UPDATE generations
             SET status = 'failed',
                 error = ?,
                 credits_refunded = ?,
                 updated_at = datetime('now')
             WHERE id = ? AND status IN ('pending', 'processing')`
          )
          .bind(poll.error ?? "Generation failed", gen.credits_charged, gen.id)
          .run();
        failed++;
      } else {
        skipped++;
      }
    } catch {
      skipped++;
    }
  }

  return { completed, failed, skipped };
}
