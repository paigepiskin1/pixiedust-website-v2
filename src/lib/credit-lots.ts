// Credit expiry, per the Terms (§12.5):
//   • Add-On / top-up credits  → expire 90 days after purchase
//   • Subscription credits     → expire at the end of the billing period
//     (Stripe uses interval:"month" = a CALENDAR month, 28–31 days, so we
//     anchor to subscriptions.current_period_end — never a flat +30 days)
//   • Promo / signup / admin   → no expiry unless one is supplied
//
// Design notes:
//  * `users.balance` stays the authoritative number for the overdraw guard and
//    every existing read. `credit_lots` sits alongside it purely to answer
//    "which credits expire when", and the invariant is
//    balance == SUM(remaining) over unexpired lots.
//  * Expiry is LAZY (swept on balance read / spend). Cloudflare Pages has no
//    cron here, and a sweep-on-touch needs no scheduler.
//  * The sweep is SELF-HEALING: balance can be changed outside this module
//    (referrals.ts writes `balance` directly, signup uses a column default), so
//    any unattributed surplus is absorbed as a NON-expiring lot. That way an
//    untracked path can never cause a user to silently lose credits.
import type { D1Database } from "@cloudflare/workers-types";

export type LotSource = "addon" | "subscription" | "promo" | "legacy" | "refund";

/** SQLite's canonical UTC format, so string comparison against datetime('now')
 *  is always valid. (Never compare raw ISO "…T…Z" strings to datetime('now').) */
export function toSqlUtc(d: Date): string {
  return d.toISOString().slice(0, 19).replace("T", " ");
}

export function addDays(days: number, from: Date = new Date()): string {
  return toSqlUtc(new Date(from.getTime() + days * 86400_000));
}

/** Expiry for a subscription grant: the end of the current billing period.
 *  Falls back to one calendar month out if Stripe hasn't reported one yet. */
export async function subscriptionPeriodEnd(db: D1Database, userId: number): Promise<string> {
  const row = await db
    .prepare("SELECT current_period_end FROM subscriptions WHERE user_id = ? AND status = 'active'")
    .bind(userId)
    .first<{ current_period_end: string | null }>();
  const raw = row?.current_period_end;
  if (raw) {
    const t = new Date(raw);
    if (!Number.isNaN(t.getTime()) && t.getTime() > Date.now()) return toSqlUtc(t);
  }
  // No/stale period end — advance one CALENDAR month (matches interval:"month").
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() + 1);
  return toSqlUtc(d);
}

export async function createLot(
  db: D1Database,
  userId: number,
  amount: number,
  source: LotSource,
  expiresAt: string | null,
  ref?: { refType?: string; refId?: string; note?: string }
): Promise<void> {
  if (amount <= 0) return;
  await db
    .prepare(
      `INSERT INTO credit_lots (user_id, source, amount, remaining, expires_at, ref_type, ref_id, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(userId, source, amount, amount, expiresAt, ref?.refType ?? null, ref?.refId ?? null, ref?.note ?? null)
    .run();
}

interface LotRow {
  id: number;
  remaining: number;
  expires_at: string | null;
}

/**
 * Reconcile lots against `users.balance`, then retire anything past its expiry.
 * Returns the balance after sweeping. Safe to call often (it's a few indexed
 * reads when there is nothing to do).
 */
export async function sweepExpired(db: D1Database, userId: number): Promise<number> {
  const bal = (await db.prepare("SELECT balance FROM users WHERE id = ?").bind(userId).first<{ balance: number }>())?.balance ?? 0;

  // 1) Unexpired coverage vs. the real balance.
  const live = (await db
    .prepare(
      `SELECT COALESCE(SUM(remaining),0) AS s FROM credit_lots
       WHERE user_id = ? AND remaining > 0 AND (expires_at IS NULL OR expires_at > datetime('now'))`
    )
    .bind(userId)
    .first<{ s: number }>())?.s ?? 0;

  if (bal > live) {
    // Credits arrived through a path that doesn't create lots — absorb the
    // surplus as never-expiring so it can't be swept away.
    await createLot(db, userId, bal - live, "legacy", null, { note: "unattributed balance" });
  } else if (live > bal) {
    // Balance was reduced outside the lot system — trim the longest-dated lots
    // so the invariant holds (keeps soonest-expiring credits spendable first).
    let excess = live - bal;
    const { results } = await db
      .prepare(
        `SELECT id, remaining, expires_at FROM credit_lots
         WHERE user_id = ? AND remaining > 0 AND (expires_at IS NULL OR expires_at > datetime('now'))
         ORDER BY (expires_at IS NULL) DESC, expires_at DESC, id DESC`
      )
      .bind(userId)
      .all<LotRow>();
    for (const lot of results ?? []) {
      if (excess <= 0) break;
      const take = Math.min(excess, lot.remaining);
      await db.prepare("UPDATE credit_lots SET remaining = remaining - ? WHERE id = ?").bind(take, lot.id).run();
      excess -= take;
    }
  }

  // 2) Retire due lots and remove that value from the balance.
  const due = (await db
    .prepare(
      `SELECT COALESCE(SUM(remaining),0) AS s FROM credit_lots
       WHERE user_id = ? AND remaining > 0 AND expires_at IS NOT NULL AND expires_at <= datetime('now')`
    )
    .bind(userId)
    .first<{ s: number }>())?.s ?? 0;

  if (due <= 0) return bal;

  await db
    .prepare(
      `UPDATE credit_lots SET remaining = 0
       WHERE user_id = ? AND remaining > 0 AND expires_at IS NOT NULL AND expires_at <= datetime('now')`
    )
    .bind(userId)
    .run();
  // MAX(0, …) so a mismatch can never drive the balance negative.
  await db
    .prepare("UPDATE users SET balance = MAX(0, balance - ?) WHERE id = ?")
    .bind(due, userId)
    .run();
  const after = (await db.prepare("SELECT balance FROM users WHERE id = ?").bind(userId).first<{ balance: number }>())?.balance ?? 0;
  await db
    .prepare(
      `INSERT INTO credit_ledger (user_id, delta, balance_after, reason, ref_type, note, actor)
       VALUES (?, ?, ?, 'credit_expired', 'credit_lot', ?, 'system')`
    )
    .bind(userId, -due, after, `${due} credit(s) expired`)
    .run();
  return after;
}

export type Allocation = { lot: number; qty: number }[];

/** Consume `amount` from unexpired lots, soonest-expiring first (never-expiring
 *  last). Returns what came from where so a refund can put it back exactly. */
export async function allocateSpend(db: D1Database, userId: number, amount: number): Promise<Allocation> {
  if (amount <= 0) return [];
  const { results } = await db
    .prepare(
      `SELECT id, remaining, expires_at FROM credit_lots
       WHERE user_id = ? AND remaining > 0 AND (expires_at IS NULL OR expires_at > datetime('now'))
       ORDER BY (expires_at IS NULL) ASC, expires_at ASC, id ASC`
    )
    .bind(userId)
    .all<LotRow>();
  const alloc: Allocation = [];
  let left = amount;
  for (const lot of results ?? []) {
    if (left <= 0) break;
    const take = Math.min(left, lot.remaining);
    await db.prepare("UPDATE credit_lots SET remaining = remaining - ? WHERE id = ?").bind(take, lot.id).run();
    alloc.push({ lot: lot.id, qty: take });
    left -= take;
  }
  return alloc;
}

/** Put refunded credits back into the exact lots they were spent from, so a
 *  refund never silently extends (or shortens) an expiry. Returns what it
 *  could not place — the caller absorbs that via the normal sweep. */
export async function restoreAllocation(db: D1Database, alloc: Allocation, amount: number): Promise<number> {
  let left = amount;
  for (const a of alloc) {
    if (left <= 0) break;
    const take = Math.min(left, a.qty);
    await db.prepare("UPDATE credit_lots SET remaining = remaining + ? WHERE id = ?").bind(take, a.lot).run();
    left -= take;
  }
  return left;
}

/** The allocation recorded for an earlier debit, so its refund can mirror it. */
export async function allocationFor(db: D1Database, userId: number, refType: string, refId: string): Promise<Allocation> {
  const row = await db
    .prepare(
      `SELECT lots_json FROM credit_ledger
       WHERE user_id = ? AND ref_type = ? AND ref_id = ? AND delta < 0 AND lots_json IS NOT NULL
       ORDER BY id DESC LIMIT 1`
    )
    .bind(userId, refType, refId)
    .first<{ lots_json: string | null }>();
  if (!row?.lots_json) return [];
  try {
    const p = JSON.parse(row.lots_json);
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

/** Soonest upcoming expiry (for UI: "120 credits expire on …"). */
export async function nextExpiry(
  db: D1Database,
  userId: number
): Promise<{ amount: number; expiresAt: string } | null> {
  const row = await db
    .prepare(
      `SELECT expires_at, SUM(remaining) AS amount FROM credit_lots
       WHERE user_id = ? AND remaining > 0 AND expires_at IS NOT NULL AND expires_at > datetime('now')
       GROUP BY expires_at ORDER BY expires_at ASC LIMIT 1`
    )
    .bind(userId)
    .first<{ expires_at: string; amount: number }>();
  return row ? { amount: row.amount, expiresAt: row.expires_at } : null;
}
