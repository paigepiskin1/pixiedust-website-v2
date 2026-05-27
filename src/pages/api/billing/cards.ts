export const prerender = false;
import type { APIContext } from "astro";
import { getUserByUid } from "../../../lib/users";
import { getOrCreateCustomer, listPaymentMethods, setDefaultPaymentMethod } from "../../../lib/stripe";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

// List the signed-in user's saved cards.
export async function GET({ locals }: APIContext) {
  const user = locals.user;
  if (!user) return json({ error: "Sign in." }, 401);
  const env = locals.runtime.env;
  const dbUser = await getUserByUid(env.DB, user.uid);
  if (!dbUser) return json({ error: "Account not found." }, 401);
  if (!dbUser.stripe_customer_id) return json({ cards: [] });
  try {
    let cards = await listPaymentMethods(env.STRIPE_SECRET_KEY, dbUser.stripe_customer_id);
    // Ensure a default exists so subscriptions + top-ups have a card to use.
    if (cards.length && !cards.some((c) => c.isDefault)) {
      await setDefaultPaymentMethod(env.STRIPE_SECRET_KEY, dbUser.stripe_customer_id, cards[0].id);
      cards = cards.map((c, i) => ({ ...c, isDefault: i === 0 }));
    }
    return json({ cards });
  } catch {
    return json({ error: "Could not load your saved cards. Please try again." }, 502);
  }
}

// Start a Stripe-hosted setup session so the user can attach a card. Card entry
// happens on Stripe (never on our server). On return the card is saved to the
// customer and becomes the default for future charges.
export async function POST({ locals, url }: APIContext) {
  const user = locals.user;
  if (!user) return json({ error: "Sign in." }, 401);
  const env = locals.runtime.env;
  const dbUser = await getUserByUid(env.DB, user.uid);
  if (!dbUser) return json({ error: "Account not found." }, 401);
  try {
    const customer = await getOrCreateCustomer(env.STRIPE_SECRET_KEY, env.DB, dbUser);
    const { createCheckoutSession } = await import("../../../lib/stripe");
    const session = await createCheckoutSession(env.STRIPE_SECRET_KEY, {
      mode: "setup",
      customer,
      currency: "usd",
      success_url: `${url.origin}/account?card=added`,
      cancel_url: `${url.origin}/account?card=cancel`,
      // Make the newly-saved card the customer's default for invoices + off-session.
      setup_intent_data: { metadata: { user_id: dbUser.id, set_default: "1" } },
    });
    return json({ url: session.url });
  } catch {
    return json({ error: "Could not start card setup. Please try again." }, 502);
  }
}
