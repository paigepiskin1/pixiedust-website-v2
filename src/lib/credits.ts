// Credit balance mutations — always go through here so every movement is
// recorded in credit_ledger (audit). Used by generation (Phase 6) + billing (Phase 9).
//
// Expiry (Terms §12.5) is layered on via credit_lots: the expiry date for a
// grant is derived from its ledger `reason`, so call sites did not have to
// change. Expired credits are swept lazily whenever a balance is read or spent
// — see credit-lots.ts for why there's no cron.
import type { D1Database } from "@cloudflare/workers-types";
import {
  addDays,
  allocateSpend,
  allocationFor,
  createLot,
  restoreAllocation,
  subscriptionPeriodEnd,
  sweepExpired,
  type Allocation,
  type LotSource,
} from "./credit-lots";

export type LedgerReason =
  | "signup_grant"
  | "purchase"
  | "generation_debit"
  | "generation_refund"
  | "admin_adjust"
  | "subscription_grant"
  | "credit_expired";

export interface LedgerOpts {
  reason: LedgerReason;
  refType?: string;
  refId?: string;
  note?: string;
  actor?: string; // "system" | admin uid
  /** Override the expiry derived from `reason` (e.g. a dated promo).
   *  `null` = never expires. Format: "YYYY-MM-DD HH:MM:SS" UTC. */
  expiresAt?: string | null;
  /** Override the lot's source label. */
  source?: LotSource;
}

/** Days an Add-On / top-up credit stays valid (Terms §12.5). */
export const ADDON_CREDIT_DAYS = 90;

/** Raw balance read — no sweep. For internal use after we've already swept. */
async function readBalance(db: D1Database, userId: number): Promise<number> {
  const row = await db.prepare("SELECT balance FROM users WHERE id = ?").bind(userId).first<{ balance: number }>();
  return row?.balance ?? 0;
}

/** Spendable balance: retires anything past its expiry first. */
export async function getBalance(db: D1Database, userId: number): Promise<number> {
  try {
    return await sweepExpired(db, userId);
  } catch {
    // Never fail a read because expiry bookkeeping hiccuped.
    return readBalance(db, userId);
  }
}

async function writeLedger(
  db: D1Database,
  userId: number,
  delta: number,
  balanceAfter: number,
  opts: LedgerOpts,
  lotsJson?: string | null
) {
  await db
    .prepare(
      `INSERT INTO credit_ledger (user_id, delta, balance_after, reason, ref_type, ref_id, note, actor, lots_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      userId,
      delta,
      balanceAfter,
      opts.reason,
      opts.refType ?? null,
      opts.refId ?? null,
      opts.note ?? null,
      opts.actor ?? "system",
      lotsJson ?? null
    )
    .run();
}

/** Expiry + source for a grant, derived from why it was granted. */
async function lotTermsFor(
  db: D1Database,
  userId: number,
  opts: LedgerOpts
): Promise<{ source: LotSource; expiresAt: string | null }> {
  if (opts.expiresAt !== undefined) {
    return { source: opts.source ?? "promo", expiresAt: opts.expiresAt };
  }
  switch (opts.reason) {
    case "purchase": // Add-On / top-up → 90 days from purchase
      return { source: opts.source ?? "addon", expiresAt: addDays(ADDON_CREDIT_DAYS) };
    case "subscription_grant": // end of the current billing period (calendar month)
      return { source: opts.source ?? "subscription", expiresAt: await subscriptionPeriodEnd(db, userId) };
    default: // signup, admin adjustments, referrals, anything else → no expiry
      return { source: opts.source ?? "promo", expiresAt: null };
  }
}

/** Add/remove credits unconditionally (purchases, grants, refunds, admin adjust). */
export async function adjustBalance(
  db: D1Database,
  userId: number,
  delta: number,
  opts: LedgerOpts
): Promise<{ balance: number }> {
  // Retire due credits before changing anything, so a grant can't be stacked on
  // a stale balance (and a negative adjust can't consume expired credits).
  await getBalance(db, userId);

  await db.prepare("UPDATE users SET balance = balance + ? WHERE id = ?").bind(delta, userId).run();
  const balance = await readBalance(db, userId);

  if (delta > 0) {
    if (opts.reason === "generation_refund" && opts.refType && opts.refId) {
      // Put refunded credits back into the exact lots they came from, so a
      // failed generation neither extends nor shortens the original expiry.
      const alloc = await allocationFor(db, userId, opts.refType, opts.refId);
      const leftover = alloc.length ? await restoreAllocation(db, alloc, delta) : delta;
      // Anything unplaceable (legacy debit with no recorded allocation) is
      // absorbed as non-expiring by the sweep — user-favourable, and these are
      // our own failures.
      if (leftover > 0) await createLot(db, userId, leftover, "refund", null, opts);
    } else {
      const { source, expiresAt } = await lotTermsFor(db, userId, opts);
      await createLot(db, userId, delta, source, expiresAt, opts);
    }
  } else if (delta < 0) {
    // Negative admin adjust: take it out of the longest-dated credits.
    await allocateSpend(db, userId, -delta).catch(() => []);
  }

  await writeLedger(db, userId, delta, balance, opts);
  return { balance };
}

/**
 * Debit for a generation. Atomic guard against overdraw via a conditional
 * UPDATE; returns ok:false (no change) if the balance is insufficient.
 */
export async function debit(
  db: D1Database,
  userId: number,
  amount: number,
  opts: LedgerOpts
): Promise<{ ok: boolean; balance: number }> {
  if (amount <= 0) {
    return { ok: true, balance: await getBalance(db, userId) };
  }
  // Expired credits must not be spendable — retire them before the guard.
  const spendable = await getBalance(db, userId);
  if (spendable < amount) {
    return { ok: false, balance: spendable };
  }

  const res = await db
    .prepare("UPDATE users SET balance = balance - ? WHERE id = ? AND balance >= ?")
    .bind(amount, userId, amount)
    .run();
  if (!res.meta.changes) {
    return { ok: false, balance: await readBalance(db, userId) };
  }
  const balance = await readBalance(db, userId);

  // Spend soonest-expiring credits first, and remember where they came from so
  // a refund can mirror it exactly.
  let alloc: Allocation = [];
  try {
    alloc = await allocateSpend(db, userId, amount);
  } catch {
    /* balance already moved; the sweep reconciles lots on the next touch */
  }
  await writeLedger(db, userId, -amount, balance, opts, alloc.length ? JSON.stringify(alloc) : null);
  return { ok: true, balance };
}
