// Credit balance mutations — always go through here so every movement is
// recorded in credit_ledger (audit). Used by generation (Phase 6) + billing (Phase 9).
import type { D1Database } from "@cloudflare/workers-types";

export type LedgerReason =
  | "signup_grant"
  | "purchase"
  | "generation_debit"
  | "generation_refund"
  | "admin_adjust"
  | "subscription_grant";

export interface LedgerOpts {
  reason: LedgerReason;
  refType?: string;
  refId?: string;
  note?: string;
  actor?: string; // "system" | admin uid
}

export async function getBalance(db: D1Database, userId: number): Promise<number> {
  const row = await db.prepare("SELECT balance FROM users WHERE id = ?").bind(userId).first<{ balance: number }>();
  return row?.balance ?? 0;
}

async function writeLedger(db: D1Database, userId: number, delta: number, balanceAfter: number, opts: LedgerOpts) {
  await db
    .prepare(
      `INSERT INTO credit_ledger (user_id, delta, balance_after, reason, ref_type, ref_id, note, actor)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(userId, delta, balanceAfter, opts.reason, opts.refType ?? null, opts.refId ?? null, opts.note ?? null, opts.actor ?? "system")
    .run();
}

/** Add/remove credits unconditionally (purchases, grants, refunds, admin adjust). */
export async function adjustBalance(
  db: D1Database,
  userId: number,
  delta: number,
  opts: LedgerOpts
): Promise<{ balance: number }> {
  await db.prepare("UPDATE users SET balance = balance + ? WHERE id = ?").bind(delta, userId).run();
  const balance = await getBalance(db, userId);
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
  const res = await db
    .prepare("UPDATE users SET balance = balance - ? WHERE id = ? AND balance >= ?")
    .bind(amount, userId, amount)
    .run();
  if (!res.meta.changes) {
    return { ok: false, balance: await getBalance(db, userId) };
  }
  const balance = await getBalance(db, userId);
  await writeLedger(db, userId, -amount, balance, opts);
  return { ok: true, balance };
}
