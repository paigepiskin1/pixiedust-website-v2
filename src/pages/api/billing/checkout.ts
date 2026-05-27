export const prerender = false;
import type { APIContext } from "astro";
import { getUserByUid } from "../../../lib/users";
import { createCheckoutSession } from "../../../lib/stripe";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

export async function POST({ request, locals, url }: APIContext) {
  const user = locals.user;
  if (!user) return json({ error: "Sign in to purchase." }, 401);
  const env = locals.runtime.env;
  const db = env.DB;
  const dbUser = await getUserByUid(db, user.uid);
  if (!dbUser) return json({ error: "Account not found." }, 401);

  let body: { kind?: "pack" | "sub"; id?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "Invalid body" }, 400);
  }
  if (!body.id || (body.kind !== "pack" && body.kind !== "sub")) return json({ error: "Bad request" }, 400);

  const origin = url.origin;
  const success_url = `${origin}/credits?status=success`;
  const cancel_url = `${origin}/credits?status=cancel`;

  try {
    let params: Record<string, unknown>;

    if (body.kind === "pack") {
      const pack = await db
        .prepare("SELECT * FROM credit_packs WHERE id = ? AND is_active = 1")
        .bind(body.id)
        .first<{ id: string; name: string; credits: number; price_cents: number; subscriber_price_cents: number | null }>();
      if (!pack) return json({ error: "Pack not found." }, 404);

      const hasSub = await db.prepare("SELECT 1 FROM subscriptions WHERE user_id = ? AND status = 'active'").bind(dbUser.id).first();
      const amount = hasSub && pack.subscriber_price_cents != null ? pack.subscriber_price_cents : pack.price_cents;

      params = {
        mode: "payment",
        customer_email: dbUser.email ?? undefined,
        success_url,
        cancel_url,
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
        customer_email: dbUser.email ?? undefined,
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

    const session = await createCheckoutSession(env.STRIPE_SECRET_KEY, params);
    return json({ url: session.url });
  } catch (err) {
    return json({ error: String((err as Error).message || err) }, 502);
  }
}
