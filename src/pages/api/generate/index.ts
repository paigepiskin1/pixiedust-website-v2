export const prerender = false;
import type { APIContext } from "astro";
import { getTemplate, resolveInput, computeCost, isChain, allFields, resolveChainStep } from "../../../lib/templates";
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

  let body: { templateId?: string; inputs?: Record<string, unknown>; quality?: string; quantity?: number; aspect?: string; duration?: number };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  const template = body.templateId ? await getTemplate(db, body.templateId) : null;
  // Hidden templates are runnable by admins (for testing before publish).
  if (!template || (template.isHidden && !user.isAdmin)) return json({ error: "Template not found." }, 404);
  const inputs = body.inputs ?? {};

  // Validate required fields (covers single + multi-step via allFields).
  const missing = allFields(template).filter((f) => f.required && (inputs[f.key] == null || inputs[f.key] === ""));
  if (missing.length) return json({ error: `${missing[0].label} is required`, errors: missing.map((f) => `${f.label} is required`) }, 400);

  const qty = Math.max(1, Math.min(Number(body.quantity) || 1, 4));
  const duration = Number(body.duration) || undefined;
  const cost = computeCost(template, { quality: body.quality, quantity: qty, duration });

  // Limits
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

  const fail = async (err: unknown) => {
    await adjustBalance(db, userId, cost, { reason: "generation_refund", refType: "generation", refId: genId, note: "dispatch failed" });
    await db
      .prepare("UPDATE generations SET status='failed', error=?, credits_refunded=?, updated_at=datetime('now') WHERE id=?")
      .bind(String((err as Error).message || err), cost, genId)
      .run();
    return json({ error: "Could not start generation — credits refunded." }, 502);
  };

  // ─── Multi-step chain ───
  if (isChain(template)) {
    const steps = template.steps!.map((s) => ({
      id: s.id,
      provider: s.provider || template.provider,
      model: s.model!,
      input: s.input ?? {},
      jobId: null as string | null,
      output: null as string | null,
      status: "pending" as string,
    }));
    // Make workspace controls available to step inputs via {{duration}}/{{aspect}}/{{quantity}}.
    const chainInputs: Record<string, unknown> = { ...inputs };
    if (duration) chainInputs.duration = duration;
    if (body.aspect) chainInputs.aspect = body.aspect;
    chainInputs.quantity = qty;
    const chain = { stepIndex: 0, userInputs: chainInputs, steps };
    const step0Input = resolveChainStep(steps[0].input, { user: chainInputs, outputs: {} }) as Record<string, unknown>;

    await db
      .prepare(
        `INSERT INTO generations (id, user_id, template_id, kind, type, provider, model, input_json, status, credits_charged, quality, quantity, chain_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`
      )
      .bind(genId, userId, template.id, template.kind, template.type, steps[0].provider, steps[0].model, JSON.stringify(step0Input), cost, body.quality ?? null, qty, JSON.stringify(chain))
      .run();

    try {
      const { jobId } = await submitGeneration(env.SYNCNODE_API_KEY, { provider: steps[0].provider, model: steps[0].model, input: step0Input });
      steps[0].jobId = jobId;
      steps[0].status = "processing";
      await db
        .prepare("UPDATE generations SET status='processing', provider_job_id=?, chain_json=?, updated_at=datetime('now') WHERE id=?")
        .bind(jobId, JSON.stringify(chain), genId)
        .run();
      return json({ id: genId, status: "processing", balance: deb.balance, cost, steps: steps.length });
    } catch (err) {
      return fail(err);
    }
  }

  // ─── Single step ───
  const { input } = resolveInput(template, inputs);
  if (body.aspect && "aspect_ratio" in input) input.aspect_ratio = body.aspect;
  if (template.type === "image" && "num_outputs" in input) input.num_outputs = qty;
  if (duration && "duration" in input) input.duration = duration;

  await db
    .prepare(
      `INSERT INTO generations (id, user_id, template_id, kind, type, provider, model, input_json, status, credits_charged, quality, quantity)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`
    )
    .bind(genId, userId, template.id, template.kind, template.type, template.provider, template.model, JSON.stringify(input), cost, body.quality ?? null, qty)
    .run();

  try {
    const { jobId } = await submitGeneration(env.SYNCNODE_API_KEY, { provider: template.provider, model: template.model, input });
    await db
      .prepare("UPDATE generations SET status='processing', provider_job_id=?, updated_at=datetime('now') WHERE id=?")
      .bind(jobId, genId)
      .run();
    return json({ id: genId, status: "processing", balance: deb.balance, cost });
  } catch (err) {
    return fail(err);
  }
}
