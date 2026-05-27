export const prerender = false;
import type { APIContext } from "astro";
import { getUserByUid } from "../../../../lib/users";
import { detachPaymentMethod, paymentMethodBelongsTo } from "../../../../lib/stripe";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

export async function POST({ request, locals }: APIContext) {
  const user = locals.user;
  if (!user) return json({ error: "Sign in." }, 401);
  const env = locals.runtime.env;
  const dbUser = await getUserByUid(env.DB, user.uid);
  if (!dbUser || !dbUser.stripe_customer_id) return json({ error: "No payment methods." }, 400);

  let body: { id?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "Invalid body" }, 400);
  }
  if (!body.id) return json({ error: "Missing card id." }, 400);

  try {
    // Only let a user detach a card that belongs to their own customer.
    if (!(await paymentMethodBelongsTo(env.STRIPE_SECRET_KEY, body.id, dbUser.stripe_customer_id))) {
      return json({ error: "Card not found." }, 404);
    }
    await detachPaymentMethod(env.STRIPE_SECRET_KEY, body.id);
    return json({ ok: true });
  } catch (err) {
    return json({ error: String((err as Error).message || err) }, 502);
  }
}
