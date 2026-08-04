// Reconcile in-flight generations against SyncNode when the client stopped polling.
// Studio status updates are browser-driven; if a tab closes mid-run the upstream
// job can finish while D1 stays on `processing` — which is what /admin/content shows.
import type { D1Database } from "@cloudflare/workers-types";
import { adjustBalance } from "./credits";
import { advanceGeneration, type GenRow } from "./advance-generation";

export interface ReconcileResult {
  completed: number;
  failed: number;
  skipped: number;
}

const SELECT_COLS = `id, user_id, provider, provider_job_id, status, output_url, error,
                     credits_charged, credits_refunded, chain_json`;

async function settleAbandoned(db: D1Database, gen: GenRow): Promise<"failed" | "skipped"> {
  // Never made it to the provider (crash between debit and submit).
  // Only fail rows that are old enough — callers already filter by age.
  if (gen.credits_refunded === 0 && gen.credits_charged > 0) {
    await adjustBalance(db, gen.user_id, gen.credits_charged, {
      reason: "generation_refund",
      refType: "generation",
      refId: gen.id,
      note: "abandoned pending generation",
    });
  }
  await db
    .prepare(
      `UPDATE generations
       SET status='failed',
           error=?,
           credits_refunded=?,
           updated_at=datetime('now')
       WHERE id=? AND status IN ('pending', 'processing')`
    )
    .bind("Abandoned — never submitted to provider", gen.credits_charged, gen.id)
    .run();
  return "failed";
}

async function reconcileRows(db: D1Database, apiKey: string, rows: GenRow[]): Promise<ReconcileResult> {
  let completed = 0;
  let failed = 0;
  let skipped = 0;

  for (const gen of rows) {
    if (!gen.provider_job_id) {
      const r = await settleAbandoned(db, gen);
      if (r === "failed") failed++;
      else skipped++;
      continue;
    }
    try {
      const result = await advanceGeneration(db, apiKey, gen);
      if (result.status === "completed") completed++;
      else if (result.status === "failed") failed++;
      else skipped++;
    } catch {
      skipped++;
    }
  }

  return { completed, failed, skipped };
}

/**
 * Poll SyncNode for a user's pending/processing generations and write terminal
 * status (+ refunds) back to D1. Caps work per call so page loads stay snappy.
 */
export async function reconcileUserGenerations(
  db: D1Database,
  apiKey: string,
  userId: number,
  opts: { limit?: number; olderThanMinutes?: number } = {}
): Promise<ReconcileResult> {
  const limit = Math.max(1, Math.min(opts.limit ?? 20, 40));
  const olderThan = Math.max(0, opts.olderThanMinutes ?? 2);

  const { results } = await db
    .prepare(
      `SELECT ${SELECT_COLS}
       FROM generations
       WHERE user_id = ?
         AND status IN ('pending', 'processing')
         AND created_at < datetime('now', ?)
       ORDER BY created_at ASC
       LIMIT ?`
    )
    .bind(userId, `-${olderThan} minutes`, limit)
    .all<GenRow>();

  return reconcileRows(db, apiKey, results ?? []);
}

/**
 * System-wide reconcile for admin views — catches stuck gens across all users
 * when nobody's studio tab is still polling.
 */
export async function reconcileStuckGenerations(
  db: D1Database,
  apiKey: string,
  opts: { limit?: number; olderThanMinutes?: number } = {}
): Promise<ReconcileResult> {
  const limit = Math.max(1, Math.min(opts.limit ?? 30, 60));
  const olderThan = Math.max(0, opts.olderThanMinutes ?? 2);

  const { results } = await db
    .prepare(
      `SELECT ${SELECT_COLS}
       FROM generations
       WHERE status IN ('pending', 'processing')
         AND created_at < datetime('now', ?)
       ORDER BY created_at ASC
       LIMIT ?`
    )
    .bind(`-${olderThan} minutes`, limit)
    .all<GenRow>();

  return reconcileRows(db, apiKey, results ?? []);
}
