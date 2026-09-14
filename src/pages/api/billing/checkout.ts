export const prerender = false;
import type { APIContext } from "astro";
import { getUserByUid } from "../../../lib/users";
import { createCheckoutSession, getOrCreateCustomer } from "../../../lib/stripe";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

export async function POST(ctx: APIContext) {
  // An API route must never fall through to the HTML error page. The client
  // calls res.json(), so an HTML body throws there and surfaces as a bogus
  // "Network error" that hides the real cause. Anything thrown below —
  // including getUserByUid, which runs before the inner try — comes back as
  // JSON with the actual message.
  try {
    return await handleCheckout(ctx);
  } catch (err) {
    return json({ error: `Checkout failed: ${(err as Error)?.message || String(err)}` }, 500);
  }
}

async function handleCheckout({ request, locals, url }: APIContext) {
  const user = locals.user;
  if (!user) return json({ error: "Sign in to purchase." }, 401);
  const env = locals.runtime.env;
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
    const customer = await getOrCreateCustomer(env.STRIPE_SECRET_KEY, db, dbUser);
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
        metadata: {
          user_id: String(dbUser.id),
          user_uid: dbUser.uid,
          kind: "custom",
          pack_id: "custom",
          credits: String(credits),
          dollars: String(dollars),
        },
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
        metadata: { user_id: dbUser.id, user_uid: dbUser.uid, kind: "pack", pack_id: pack.id, credits: pack.credits },
      };
    } else {
      const tier = await db
        .prepare("SELECT * FROM subscription_tiers WHERE id = ? AND is_active = 1 AND price_cents > 0")
        .bind(body.id)
        .first<{ id: string; name: string; price_cents: number; monthly_credits: number }>();
      if (!tier) return json({ error: "Plan not found." }, 404);

      const meta = { user_id: dbUser.id, user_uid: dbUser.uid, kind: "sub", tier_id: tier.id, credits: tier.monthly_credits };
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
              product_data: { name: `PixyDust ${tier.name}` },
            },
          },
        ],
        metadata: meta,
        subscription_data: { metadata: meta },
      };
    }

    let session;
    try {
      session = await createCheckoutSession(env.STRIPE_SECRET_KEY, params);
    } catch (err) {
      // Stripe customer ids are per-mode: one minted against the test key does
      // not exist under the live key, so a user who first transacted in test
      // mode is permanently unable to check out in production. Same shape if a
      // customer is deleted in the dashboard. Drop the stale id and mint a new
      // one rather than leaving that account bricked.
      const msg = (err as Error)?.message || String(err);
      if (!/no such customer/i.test(msg)) throw err;
      await db.prepare("UPDATE users SET stripe_customer_id = NULL WHERE id = ?").bind(dbUser.id).run();
      const fresh = await getOrCreateCustomer(env.STRIPE_SECRET_KEY, db, { ...dbUser, stripe_customer_id: null });
      session = await createCheckoutSession(env.STRIPE_SECRET_KEY, { ...params, customer: fresh });
    }
    return json({ url: session.url });
  } catch (err) {
    // 500, not 502: Cloudflare replaces a 502 body with its own Bad Gateway
    // page, so the real Stripe message never reached the client — which is what
    // made this fault look like a network error for so long.
    return json({ error: `Could not start checkout: ${(err as Error)?.message || String(err)}` }, 500);
  }
}
