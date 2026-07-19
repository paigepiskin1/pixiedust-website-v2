export const prerender = false;
import type { APIContext } from "astro";
import { getUserByUid } from "../../../lib/users";
import { createCheckoutSession, getOrCreateCustomer } from "../../../lib/stripe";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

function strMeta(meta: Record<string, string | number | null | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (v === undefined || v === null) continue;
    out[k] = String(v);
  }
  return out;
}

export async function POST({ request, locals, url }: APIContext) {
  const user = locals.user;
  if (!user) return json({ error: "Sign in to purchase." }, 401);
  const env = locals.runtime.env;
  if (!env.STRIPE_SECRET_KEY) return json({ error: "Payments are temporarily unavailable." }, 503);
  const db = env.DB;
  const dbUser = await getUserByUid(db, user.uid);
  if (!dbUser) return json({ error: "Account not found." }, 401);

  let body: { kind?: "pack" | "sub" | "custom"; id?: string; dollars?: number };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "Invalid body" }, 400);
  }
  if (body.kind !== "pack" && body.kind !== "sub" && body.kind !== "custom") return json({ error: "Bad request" }, 400);
  if ((body.kind === "pack" || body.kind === "sub") && !body.id) return json({ error: "Bad request" }, 400);

  const origin = url.origin;
  const success_url = `${origin}/credits?status=success`;
  const cancel_url = `${origin}/credits?status=cancel`;

  // Custom top-ups use the Starter pack rate: 100 credits / $8 = 12.5 cr per $1.
  const CR_PER_DOLLAR = 12.5;

  try {
    // Reuse the user's Stripe customer so an attached card is offered + reused.
    // Retry once if a stored customer id is stale (e.g. test/live key mismatch).
    let customer = await getOrCreateCustomer(env.STRIPE_SECRET_KEY, db, dbUser);
    let params: Record<string, unknown>;

    if (body.kind === "custom") {
      const dollars = Math.round(Number(body.dollars));
      if (!Number.isFinite(dollars) || dollars < 5 || dollars > 100) {
        return json({ error: "Choose an amount between $5 and $100." }, 400);
      }
      const sub = await db
        .prepare("SELECT t.pack_discount_pct FROM subscriptions s JOIN subscription_tiers t ON t.id = s.tier_id WHERE s.user_id = ? AND s.status = 'active'")
        .bind(dbUser.id)
        .first<{ pack_discount_pct: number }>();
      const discount = Math.max(0, Math.min(90, Number(sub?.pack_discount_pct) || 0));
      // Subscribers get more credits for the same spend (mirrors pack discounts).
      const credits = Math.max(1, Math.round(dollars * CR_PER_DOLLAR * (100 / (100 - discount))));
      const amount = dollars * 100;

      params = {
        mode: "payment",
        customer,
        success_url,
        cancel_url,
        payment_intent_data: { setup_future_usage: "off_session" },
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: amount,
              product_data: { name: `Custom top-up — ${credits} credits` },
            },
          },
        ],
        metadata: strMeta({
          user_id: dbUser.id,
          user_uid: dbUser.uid,
          kind: "custom",
          pack_id: "custom",
          credits,
          dollars,
        }),
      };
    } else if (body.kind === "pack") {
      const pack = await db
        .prepare("SELECT * FROM credit_packs WHERE id = ? AND is_active = 1")
        .bind(body.id)
        .first<{ id: string; name: string; credits: number; price_cents: number; subscriber_price_cents: number | null }>();
      if (!pack) return json({ error: "Pack not found." }, 404);

      const hasSub = await db.prepare("SELECT 1 FROM subscriptions WHERE user_id = ? AND status = 'active'").bind(dbUser.id).first();
      const amount = hasSub && pack.subscriber_price_cents != null ? pack.subscriber_price_cents : pack.price_cents;

      params = {
        mode: "payment",
        customer,
        success_url,
        cancel_url,
        // Save the card used so it's available for future top-ups + subscriptions.
        payment_intent_data: { setup_future_usage: "off_session" },
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: amount,
              product_data: { name: `${pack.name} — ${pack.credits} credits` },
            },
          },
        ],
        metadata: strMeta({
          user_id: dbUser.id,
          user_uid: dbUser.uid,
          kind: "pack",
          pack_id: pack.id,
          credits: pack.credits,
        }),
      };
    } else {
      const tier = await db
        .prepare("SELECT * FROM subscription_tiers WHERE id = ? AND is_active = 1 AND price_cents > 0")
        .bind(body.id)
        .first<{ id: string; name: string; price_cents: number; monthly_credits: number }>();
      if (!tier) return json({ error: "Plan not found." }, 404);

      const meta = strMeta({
        user_id: dbUser.id,
        user_uid: dbUser.uid,
        kind: "sub",
        tier_id: tier.id,
        credits: tier.monthly_credits,
      });
      params = {
        mode: "subscription",
        customer,
        success_url,
        cancel_url,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: tier.price_cents,
              recurring: { interval: "month" },
              product_data: { name: `PixieDust ${tier.name}` },
            },
          },
        ],
        metadata: meta,
        subscription_data: { metadata: meta },
      };
    }

    try {
      const session = await createCheckoutSession(env.STRIPE_SECRET_KEY, params);
      return json({ url: session.url });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Stored customer may belong to the other Stripe mode — clear and retry once.
      if (/no such customer/i.test(msg) && dbUser.stripe_customer_id) {
        await db.prepare("UPDATE users SET stripe_customer_id = NULL WHERE id = ?").bind(dbUser.id).run();
        customer = await getOrCreateCustomer(env.STRIPE_SECRET_KEY, db, { ...dbUser, stripe_customer_id: null });
        params = { ...params, customer };
        const session = await createCheckoutSession(env.STRIPE_SECRET_KEY, params);
        return json({ url: session.url });
      }
      throw err;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not create checkout session.";
    console.error("[credits/checkout]", msg);
    return json({ error: msg || "Could not create checkout session. Please try again." }, 502);
  }
}
