// Shared generation finalization — polls SyncNode and writes completed/failed
// (and multi-step chain advances) into D1. Used by the studio status poll,
// SyncNode webhooks, waitUntil background finishers, and reconcile sweeps so
// results land in My creations even if the user leaves the studio page.
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
  input_json: string | null;
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
  | { status: "missing" };

type EnvLike = {
  DB: D1Database;
  SYNCNODE_API_KEY: string;
};

async function refundFail(env: EnvLike, gen: GenRow, error: string): Promise<AdvanceResult> {
  const db = env.DB;
  if (gen.credits_refunded === 0 && gen.credits_charged > 0) {
    await adjustBalance(db, gen.user_id, gen.credits_charged, {
      reason: "generation_refund",
      refType: "generation",
      refId: gen.id,
      note: "generation failed",
    });
  }
  await db
    .prepare("UPDATE generations SET status='failed', error=?, credits_refunded=?, updated_at=datetime('now') WHERE id=?")
    .bind(error, gen.credits_charged, gen.id)
    .run();
  return { status: "failed", error, refunded: true };
}

/** One SyncNode poll tick for a generation row. Safe to call repeatedly. */
export async function advanceGeneration(env: EnvLike, gen: GenRow, webhookUrl?: string): Promise<AdvanceResult> {
  if (gen.status === "completed") {
    return { status: "completed", outputs: gen.output_url ? [gen.output_url] : [] };
  }
  if (gen.status === "failed") {
    return { status: "failed", error: gen.error ?? "Generation failed", refunded: gen.credits_refunded > 0 };
  }
  if (!gen.provider_job_id) return { status: "processing" };

  const db = env.DB;
  const apiKey = env.SYNCNODE_API_KEY;

  // ─── Multi-step chain ───
  if (gen.chain_json) {
    const chain = JSON.parse(gen.chain_json) as Chain;
    const cur = chain.steps[chain.stepIndex];
    if (!cur?.jobId) return { status: "processing" };

    const poll = await pollStatus(apiKey, cur.provider, cur.jobId);
    if (poll.status === "failed") return refundFail(env, gen, `Step ${chain.stepIndex + 1} failed: ${poll.error ?? ""}`);
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
          webhookUrl,
        });
        next.jobId = jobId;
        next.status = "processing";
        chain.stepIndex += 1;
        await db
          .prepare("UPDATE generations SET provider_job_id=?, chain_json=?, input_json=?, updated_at=datetime('now') WHERE id=?")
          .bind(jobId, JSON.stringify(chain), JSON.stringify(nextInput), gen.id)
          .run();
        return { status: "processing", step: chain.stepIndex + 1, steps: chain.steps.length };
      } catch (err) {
        console.error("[generations] chain dispatch error:", err);
        const detail = String((err as Error).message || err || "Pipeline step failed");
        return refundFail(env, gen, `Step ${chain.stepIndex + 2} failed to start: ${detail}`);
      }
    }

    await db
      .prepare("UPDATE generations SET status='completed', output_url=?, chain_json=?, updated_at=datetime('now') WHERE id=?")
      .bind(cur.output, JSON.stringify(chain), gen.id)
      .run();
    return { status: "completed", outputs: cur.output ? [cur.output] : [] };
  }

  // ─── Single step ───
  const poll = await pollStatus(apiKey, gen.provider, gen.provider_job_id);
  if (poll.status === "completed") {
    await db
      .prepare("UPDATE generations SET status = 'completed', output_url = ?, updated_at = datetime('now') WHERE id = ?")
      .bind(poll.outputs[0] ?? null, gen.id)
      .run();
    return { status: "completed", outputs: poll.outputs };
  }
  if (poll.status === "failed") {
    return refundFail(env, gen, poll.error ?? "Generation failed");
  }
  return { status: "processing" };
}

export async function advanceGenerationById(env: EnvLike, id: string, webhookUrl?: string): Promise<AdvanceResult> {
  const gen = await env.DB.prepare("SELECT * FROM generations WHERE id = ?").bind(id).first<GenRow>();
  if (!gen) return { status: "missing" };
  return advanceGeneration(env, gen, webhookUrl);
}

export async function advanceGenerationByJobId(
  env: EnvLike,
  providerJobId: string,
  webhookUrl?: string
): Promise<AdvanceResult> {
  const gen = await env.DB
    .prepare("SELECT * FROM generations WHERE provider_job_id = ? ORDER BY updated_at DESC LIMIT 1")
    .bind(providerJobId)
    .first<GenRow>();
  if (!gen) return { status: "missing" };
  return advanceGeneration(env, gen, webhookUrl);
}

/**
 * Poll SyncNode for one Worker time-slice, then chain a fresh invocation if the
 * job is still open. Cloudflare waitUntil dies long before GPT Image (~2 min)
 * finishes, so we re-hit `/api/generate/continue` to keep finalizing after the
 * user leaves the page.
 */
export async function finishGenerationInBackground(
  env: EnvLike,
  id: string,
  opts?: {
    webhookUrl?: string;
    origin?: string;
    continueKey?: string;
    /** Wall time for THIS isolate slice (keep under CF waitUntil budget). */
    sliceMs?: number;
    intervalMs?: number;
    /** Hop counter — stop chaining after this many continue requests. */
    hop?: number;
    maxHops?: number;
  }
): Promise<void> {
  const sliceMs = opts?.sliceMs ?? 20_000;
  const intervalMs = opts?.intervalMs ?? 2500;
  const hop = opts?.hop ?? 0;
  const maxHops = opts?.maxHops ?? 40; // ~40 × 20s ≈ 13 min of coverage
  const start = Date.now();

  while (Date.now() - start < sliceMs) {
    const result = await advanceGenerationById(env, id, opts?.webhookUrl);
    if (result.status === "completed" || result.status === "failed" || result.status === "missing") return;
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  // Still open — wake a new Worker to continue (GET avoids CSRF origin checks).
  if (hop >= maxHops || !opts?.origin || !opts?.continueKey) return;
  const url = new URL("/api/generate/continue", opts.origin);
  url.searchParams.set("id", id);
  url.searchParams.set("k", opts.continueKey);
  url.searchParams.set("hop", String(hop + 1));
  try {
    await fetch(url.toString(), {
      method: "GET",
      headers: { "X-PD-Continue": "1" },
    });
  } catch (err) {
    console.error("[generations] continue chain failed:", err);
  }
}

/** Advance every open generation that still has a SyncNode job id. */
export async function reconcileOpenGenerations(
  env: EnvLike,
  opts?: { limit?: number; webhookUrl?: string }
): Promise<{ advanced: number; completed: number; failed: number }> {
  const limit = opts?.limit ?? 25;
  const { results } = await env.DB
    .prepare(
      `SELECT * FROM generations
       WHERE status IN ('pending','processing') AND provider_job_id IS NOT NULL
       ORDER BY updated_at ASC LIMIT ?`
    )
    .bind(limit)
    .all<GenRow>();

  let advanced = 0;
  let completed = 0;
  let failed = 0;
  for (const gen of results ?? []) {
    const r = await advanceGeneration(env, gen, opts?.webhookUrl);
    advanced += 1;
    if (r.status === "completed") completed += 1;
    if (r.status === "failed") failed += 1;
  }
  return { advanced, completed, failed };
}

/** Finalize all still-open generations for a user (gallery / app-shell sweep). */
export async function reconcileUserGenerations(
  env: EnvLike,
  userId: number,
  opts?: { limit?: number; webhookUrl?: string }
): Promise<{ advanced: number; completed: number; failed: number }> {
  const limit = opts?.limit ?? 8;
  const { results } = await env.DB
    .prepare(
      `SELECT * FROM generations
       WHERE user_id = ? AND status IN ('pending','processing') AND provider_job_id IS NOT NULL
       ORDER BY updated_at DESC LIMIT ?`
    )
    .bind(userId, limit)
    .all<GenRow>();

  let advanced = 0;
  let completed = 0;
  let failed = 0;
  for (const gen of results ?? []) {
    const r = await advanceGeneration(env, gen, opts?.webhookUrl);
    advanced += 1;
    if (r.status === "completed") completed += 1;
    if (r.status === "failed") failed += 1;
  }
  return { advanced, completed, failed };
}

/** Shared secret for SyncNode → PixieDust webhook calls (URL query `k=`). */
export async function syncnodeWebhookKey(apiKey: string): Promise<string> {
  const data = new TextEncoder().encode(`${apiKey}:pixiedust-syncnode-webhook`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 40);
}

export function buildSyncnodeWebhookUrl(origin: string, key: string): string {
  const base = origin.replace(/\/$/, "");
  return `${base}/api/generate/syncnode-webhook?k=${encodeURIComponent(key)}`;
}

/** Pull a SyncNode job id out of assorted webhook payload shapes. */
export function extractSyncnodeJobId(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  const candidates = [o.job_id, o.jobId, o.id, o.prediction_id, o.provider_job_id];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  const nested = o.data;
  if (nested && typeof nested === "object") {
    const d = nested as Record<string, unknown>;
    for (const c of [d.job_id, d.jobId, d.id]) {
      if (typeof c === "string" && c.trim()) return c.trim();
    }
  }
  return null;
}
