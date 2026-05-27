// Per-tier rate limiting + concurrency for generation.
import type { D1Database, KVNamespace } from "@cloudflare/workers-types";

export interface Tier {
  id: string;
  rate_limit_per_min: number;
  concurrency: number;
}

// Generous defaults so users can queue several generations at once (async).
const FREE_FALLBACK: Tier = { id: "free", rate_limit_per_min: 30, concurrency: 10 };

export async function getUserTier(db: D1Database, userId: number): Promise<Tier> {
  const active = await db
    .prepare(
      `SELECT t.id, t.rate_limit_per_min, t.concurrency
       FROM subscriptions s JOIN subscription_tiers t ON t.id = s.tier_id
       WHERE s.user_id = ? AND s.status = 'active'`
    )
    .bind(userId)
    .first<Tier>();
  if (active) return active;
  const free = await db
    .prepare("SELECT id, rate_limit_per_min, concurrency FROM subscription_tiers WHERE id = 'free'")
    .first<Tier>();
  return free ?? FREE_FALLBACK;
}

/** Fixed-window per-minute limiter in KV. Returns false when the limit is hit. */
export async function checkRateLimit(kv: KVNamespace, userId: number, limit: number): Promise<boolean> {
  const minute = Math.floor(Date.now() / 60000);
  const key = `rl:${userId}:${minute}`;
  const current = Number(await kv.get(key)) || 0;
  if (current >= limit) return false;
  await kv.put(key, String(current + 1), { expirationTtl: 70 });
  return true;
}

export async function countActiveGenerations(db: D1Database, userId: number): Promise<number> {
  // Only count recent in-flight jobs so a stuck/never-polled generation can't
  // lock a user out of the concurrency slot forever.
  const row = await db
    .prepare("SELECT COUNT(*) AS n FROM generations WHERE user_id = ? AND status IN ('pending','processing') AND created_at > datetime('now','-15 minutes')")
    .bind(userId)
    .first<{ n: number }>();
  return row?.n ?? 0;
}
