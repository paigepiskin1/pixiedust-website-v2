export const prerender = false;
import type { APIContext } from "astro";
import { getTemplate, resolveInput, computeCost } from "../../../lib/templates";
import { getUserByUid } from "../../../lib/users";
import { debit, adjustBalance } from "../../../lib/credits";
import { submitGeneration } from "../../../lib/syncnode";
import { getUserTier, checkRateLimit, countActiveGenerations } from "../../../lib/limits";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

export async function POST({ request, locals }: APIContext) {
  const user = locals.user;
  if (!user) return json({ error: "Sign in to generate." }, 401);

  const env = locals.runtime.env;
  const db = env.DB;
  const dbUser = await getUserByUid(db, user.uid);
  if (!dbUser) return json({ error: "Account not found." }, 401);
  const userId = dbUser.id;

  let body: { templateId?: string; inputs?: Record<string, unknown>; quality?: string; quantity?: number; aspect?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  const template = body.templateId ? await getTemplate(db, body.templateId) : null;
  if (!template || template.isHidden) return json({ error: "Template not found." }, 404);

  const { input, errors } = resolveInput(template, body.inputs ?? {});
  if (errors.length) return json({ error: errors[0], errors }, 400);

  // Apply workspace controls onto the resolved provider input.
  const qty = Math.max(1, Math.min(Number(body.quantity) || 1, 4));
  if (body.aspect && "aspect_ratio" in input) input.aspect_ratio = body.aspect;
  if (template.type === "image" && "num_outputs" in input) input.num_outputs = qty;

  const cost = computeCost(template, { quality: body.quality, quantity: qty });

  const tier = await getUserTier(db, userId);
  if ((await countActiveGenerations(db, userId)) >= tier.concurrency) {
    return json({ error: `Your plan allows ${tier.concurrency} generations at once.` }, 429);
  }
  if (!(await checkRateLimit(env.SESSIONS, userId, tier.rate_limit_per_min))) {
    return json({ error: "Slow down — rate limit reached. Try again in a minute." }, 429);
  }

  const genId = crypto.randomUUID();
  const deb = await debit(db, userId, cost, { reason: "generation_debit", refType: "generation", refId: genId });
  if (!deb.ok) return json({ error: "Not enough credits.", needCredits: true }, 402);

  await db
    .prepare(
      `INSERT INTO generations (id, user_id, template_id, kind, type, provider, model, input_json, status, credits_charged, quality, quantity)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`
    )
    .bind(genId, userId, template.id, template.kind, template.type, template.provider, template.model, JSON.stringify(input), cost, body.quality ?? null, qty)
    .run();

  try {
    const { jobId } = await submitGeneration(env.SYNCNODE_API_KEY, {
      provider: template.provider,
      model: template.model,
      input,
    });
    await db
      .prepare("UPDATE generations SET status = 'processing', provider_job_id = ?, updated_at = datetime('now') WHERE id = ?")
      .bind(jobId, genId)
      .run();
    return json({ id: genId, status: "processing", balance: deb.balance, cost });
  } catch (err) {
    // Dispatch failed — refund and mark failed.
    await adjustBalance(db, userId, cost, { reason: "generation_refund", refType: "generation", refId: genId, note: "dispatch failed" });
    await db
      .prepare("UPDATE generations SET status = 'failed', error = ?, credits_refunded = ?, updated_at = datetime('now') WHERE id = ?")
      .bind(String((err as Error).message || err), cost, genId)
      .run();
    return json({ error: "Could not start generation — credits refunded.", detail: String((err as Error).message || err) }, 502);
  }
}
