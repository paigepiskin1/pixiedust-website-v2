export const prerender = false;
import type { APIContext } from "astro";
import { getUserByUid } from "../../../lib/users";
import { adjustBalance } from "../../../lib/credits";
import { pollStatus, submitGeneration, deletePortraitAsset } from "../../../lib/syncnode";
import { resolveChainStep } from "../../../lib/templates";

// When a generation completes we free its Portrait Library assets so the small
// shared pool doesn't fill up. Guards against the "asset not found" problems that
// made us disable this before:
//   • an asset still referenced by another IN-FLIGHT generation (e.g. quantity>1)
//     is kept until that job finishes too;
//   • the studio re-registers references (fresh asset://) whenever they're reused
//     for another generation, so a deleted id is never resubmitted.
// Runs in the background (waitUntil) so it never slows the status response.
async function cleanupPortraitAssets(
  env: { SYNCNODE_API_KEY: string; DB: import("@cloudflare/workers-types").D1Database },
  gen: { id: string; provider: string; input_json: string | null },
  userId: number
): Promise<void> {
  if (gen.provider !== "byteplus" || !gen.input_json) return;
  let assetIds: string[] = [];
  try {
    const refs = (JSON.parse(gen.input_json) as { reference_images?: unknown }).reference_images;
    assetIds = (Array.isArray(refs) ? refs : [])
      .filter((u): u is string => typeof u === "string" && u.startsWith("asset://"))
      .map((u) => u.slice("asset://".length));
  } catch {
    return;
  }
  if (!assetIds.length) return;
  // Keep any asset another active job of this user still points at.
  try {
    const others = await env.DB
      .prepare("SELECT input_json FROM generations WHERE user_id=? AND id!=? AND status IN ('pending','processing')")
      .bind(userId, gen.id)
      .all<{ input_json: string | null }>();
    const stillUsed = new Set<string>();
    for (const row of others.results ?? []) {
      const ij = row.input_json ?? "";
      for (const aid of assetIds) if (ij.includes(aid)) stillUsed.add(aid);
    }
    for (const aid of assetIds) if (!stillUsed.has(aid)) await deletePortraitAsset(env.SYNCNODE_API_KEY, aid);
  } catch {
    /* best effort — age-based eviction is the safety net */
  }
}

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
        console.error("[status] chain dispatch error:", err);
        const detail = String((err as Error).message || err || "Pipeline step failed");
        return refundFail(`Step ${chain.stepIndex + 2} failed to start: ${detail}`);
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
    // Free this job's portrait assets in the background (see cleanupPortraitAssets).
    const cleanup = cleanupPortraitAssets(env, gen, dbUser.id);
    const ctx = (locals.runtime as unknown as { ctx?: { waitUntil?: (p: Promise<unknown>) => void } }).ctx;
    if (ctx?.waitUntil) ctx.waitUntil(cleanup);
    else await cleanup;
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
    // Free this job's portrait assets in the background (client re-registers on retry).
    const cleanup = cleanupPortraitAssets(env, gen, dbUser.id);
    const ctx = (locals.runtime as unknown as { ctx?: { waitUntil?: (p: Promise<unknown>) => void } }).ctx;
    if (ctx?.waitUntil) ctx.waitUntil(cleanup);
    else await cleanup;
    return json({ id, status: "failed", error: poll.error, refunded: true });
  }

  return json({ id, status: "processing" });
}
