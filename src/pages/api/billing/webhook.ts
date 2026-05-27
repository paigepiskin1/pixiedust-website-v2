export const prerender = false;
import type { APIContext } from "astro";
import { verifyWebhookSignature } from "../../../lib/stripe";
import { adjustBalance } from "../../../lib/credits";

function ok(msg = "ok") {
  return new Response(JSON.stringify({ received: true, msg }), { status: 200, headers: { "Content-Type": "application/json" } });
}

async function alreadyProcessed(db: import("@cloudflare/workers-types").D1Database, refId: string): Promise<boolean> {
  const row = await db.prepare("SELECT 1 FROM credit_ledger WHERE ref_id = ? LIMIT 1").bind(refId).first();
  return !!row;
}

export async function POST({ request, locals }: APIContext) {
  const env = locals.runtime.env;
  const payload = await request.text();
  const sig = request.headers.get("stripe-signature");

  const valid = await verifyWebhookSignature(payload, sig, env.STRIPE_WEBHOOK_SECRET);
  if (!valid) return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 400 });

  let event: any;
  try {
    event = JSON.parse(payload);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid payload" }), { status: 400 });
  }

  const db = env.DB;
  const obj = event.data?.object ?? {};

  try {
    if (event.type === "checkout.session.completed") {
      const meta = obj.metadata ?? {};
      const userId = Number(meta.user_id);
      const credits = Number(meta.credits) || 0;
      if (!userId) return ok("no user");
      if (await alreadyProcessed(db, obj.id)) return ok("duplicate");

      if (meta.kind === "pack") {
        await adjustBalance(db, userId, credits, { reason: "purchase", refType: "purchase", refId: obj.id, note: meta.pack_id });
      } else if (meta.kind === "sub") {
        await db
          .prepare(
            `INSERT INTO subscriptions (user_id, tier_id, status, stripe_customer_id, stripe_subscription_id)
             VALUES (?, ?, 'active', ?, ?)
             ON CONFLICT(user_id) DO UPDATE SET tier_id=excluded.tier_id, status='active',
               stripe_customer_id=excluded.stripe_customer_id, stripe_subscription_id=excluded.stripe_subscription_id,
               updated_at=datetime('now')`
          )
          .bind(userId, meta.tier_id, obj.customer ?? null, obj.subscription ?? null)
          .run();
        if (credits > 0) {
          await adjustBalance(db, userId, credits, { reason: "subscription_grant", refType: "subscription", refId: obj.id, note: meta.tier_id });
        }
      }
      return ok("processed");
    }

    if (event.type === "invoice.paid") {
      // Renewal cycles only — the first invoice is covered by checkout.session.completed.
      if (obj.billing_reason !== "subscription_cycle") return ok("not a renewal");
      const subId = obj.subscription;
      if (!subId || (await alreadyProcessed(db, obj.id))) return ok("skip");
      const sub = await db
        .prepare(
          `SELECT s.user_id, t.monthly_credits, t.id AS tier_id
           FROM subscriptions s JOIN subscription_tiers t ON t.id = s.tier_id
           WHERE s.stripe_subscription_id = ?`
        )
        .bind(subId)
        .first<{ user_id: number; monthly_credits: number; tier_id: string }>();
      if (sub && sub.monthly_credits > 0) {
        await adjustBalance(db, sub.user_id, sub.monthly_credits, { reason: "subscription_grant", refType: "subscription", refId: obj.id, note: sub.tier_id });
      }
      return ok("renewed");
    }

    if (event.type === "customer.subscription.deleted") {
      await db.prepare("UPDATE subscriptions SET status='canceled', updated_at=datetime('now') WHERE stripe_subscription_id = ?").bind(obj.id).run();
      return ok("canceled");
    }
  } catch (err) {
    // Return 500 so Stripe retries.
    return new Response(JSON.stringify({ error: String((err as Error).message || err) }), { status: 500 });
  }

  return ok("ignored");
}
