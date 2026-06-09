export const prerender = false;
import type { APIContext } from "astro";
import { adminActor } from "../../../lib/admin";
import { retrieveSubscription } from "../../../lib/stripe";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

/** Re-sync every subscription's status + renewal date (current_period_end) from
 * Stripe. Backfills rows the webhook never captured. Admin-gated. */
export async function POST({ request, locals }: APIContext) {
  const env = locals.runtime.env;
  if (!adminActor(request, locals, env.ADMIN_API_TOKEN)) return json({ error: "Forbidden" }, 403);

  const { results } = await env.DB
    .prepare("SELECT stripe_subscription_id AS sid FROM subscriptions WHERE stripe_subscription_id IS NOT NULL")
    .all<{ sid: string }>();

  let updated = 0;
  const out: Array<{ sid: string; status?: string; renewal?: string | null; error?: string }> = [];
  for (const { sid } of results ?? []) {
    const info = await retrieveSubscription(env.STRIPE_SECRET_KEY, sid);
    if (!info) { out.push({ sid, error: "not found in Stripe" }); continue; }
    const renewal = info.currentPeriodEnd ? new Date(info.currentPeriodEnd * 1000).toISOString() : null;
    await env.DB
      .prepare("UPDATE subscriptions SET current_period_end = ?, status = ?, updated_at = datetime('now') WHERE stripe_subscription_id = ?")
      .bind(renewal, info.status, sid)
      .run();
    updated++;
    out.push({ sid, status: info.status, renewal: renewal ? renewal.slice(0, 10) : null });
  }

  return json({ ok: true, updated, subs: out });
}
