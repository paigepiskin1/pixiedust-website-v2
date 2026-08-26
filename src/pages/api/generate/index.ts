export const prerender = false;
import type { APIContext } from "astro";
import { getTemplate, resolveInput, computeCost, isChain, allFields, resolveChainStep, applyFieldDefaults, resolveModel } from "../../../lib/templates";
import { getUserByUid } from "../../../lib/users";
import { debit, adjustBalance } from "../../../lib/credits";
import { submitGeneration } from "../../../lib/syncnode";
import { getUserTier, checkRateLimit, countActiveGenerations } from "../../../lib/limits";

// Per-model limits from the template meta ({ models: { <id>: { maxRefs, durations } } }).
// Used to clamp duration + trim references to what the chosen model actually allows.
function modelLimits(metaJson: string | null, model: string): { maxRefs?: number; durations?: number[] } {
  if (!metaJson) return {};
  try {
    const cfg = (JSON.parse(metaJson) as { models?: Record<string, any> }).models?.[model];
    if (!cfg) return {};
    return {
      maxRefs: typeof cfg.maxRefs === "number" ? cfg.maxRefs : undefined,
      durations: Array.isArray(cfg.durations) ? cfg.durations.map(Number) : undefined,
    };
  } catch {
    return {};
  }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

// Sanitize the client's reuse snapshot before persisting it (used by the gallery
// to reload a creation into the studio). Keeps only durable https reference URLs
// and bounds every field so a crafted payload can't bloat the row.
function buildReuseJson(reuse: unknown, maxRefs?: number): string | null {
  if (!reuse || typeof reuse !== "object") return null;
  const r = reuse as Record<string, unknown>;
  const refsRaw = Array.isArray(r.references) ? r.references : [];
  const references = refsRaw
    .filter((u): u is string => typeof u === "string" && /^https?:\/\//i.test(u) && u.length < 1024)
    .slice(0, maxRefs && maxRefs > 0 ? maxRefs : 40);
  const clip = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : null);
  const payload = {
    prompt: clip(r.prompt, 4000) ?? "",
    references,
    model: clip(r.model, 128),
    aspect: clip(r.aspect, 32),
    duration: r.duration == null ? null : String(r.duration).slice(0, 16),
    quality: clip(r.quality, 32),
  };
  try {
    return JSON.stringify(payload);
  } catch {
    return null;
  }
}

export async function POST({ request, locals }: APIContext) {
  const user = locals.user;
  if (!user) return json({ error: "Sign in to generate." }, 401);

  const env = locals.runtime.env;
  const db = env.DB;
  const dbUser = await getUserByUid(db, user.uid);
  if (!dbUser) return json({ error: "Account not found." }, 401);
  const userId = dbUser.id;

  let body: { templateId?: string; inputs?: Record<string, unknown>; quality?: string; quantity?: number; aspect?: string; duration?: number; reuse?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  const template = body.templateId ? await getTemplate(db, body.templateId) : null;
  // Hidden templates are runnable by admins (for testing before publish).
  if (!template || (template.isHidden && !user.isAdmin)) return json({ error: "Template not found." }, 404);
  // Apply field defaults before validation/resolve so optional prompts with a
  // baked-in `default` still reach the model when the user leaves them blank.
  const inputs = applyFieldDefaults(template, body.inputs ?? {});

  // Validate required fields (covers single + multi-step via allFields).
  const missing = allFields(template).filter((f) => f.required && (inputs[f.key] == null || inputs[f.key] === ""));
  if (missing.length) return json({ error: `${missing[0].label} is required`, errors: missing.map((f) => `${f.label} is required`) }, 400);

  const qty = Math.max(1, Math.min(Number(body.quantity) || 1, 4));
  // Resolve the chosen model (e.g. Seedance 2.0 vs 2.5) and clamp the requested
  // duration to what that model supports, so an out-of-range value can't slip
  // through (the client already restricts, this is the server-side safety net).
  const model = resolveModel(template, inputs);
  const limits = modelLimits(template.meta, model);
  let duration = Number(body.duration) || undefined;
  if (duration && limits.durations && limits.durations.length) {
    const maxD = Math.max(...limits.durations);
    if (duration > maxD) duration = maxD;
  }
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
    const detail = String((err as Error).message || err || "Could not start generation");
    await adjustBalance(db, userId, cost, { reason: "generation_refund", refType: "generation", refId: genId, note: "dispatch failed" });
    await db
      .prepare("UPDATE generations SET status='failed', error=?, credits_refunded=?, updated_at=datetime('now') WHERE id=?")
      .bind(detail, cost, genId)
      .run();
    // Pass the provider message through so the studio can show a useful reason
    // (e.g. BytePlus real-person blocks / "activate this model"). Use 400, NOT a
    // 5xx: Cloudflare's edge replaces gateway statuses (502/503/504) with its own
    // "error code: 502" page, which strips our JSON body — so the real reason
    // never reached the client and every dispatch failure looked like a bare 502.
    return json({ error: detail + " — credits refunded." }, 400);
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
    chainInputs.duration = duration || template.durations?.[0] || 5;
    chainInputs.aspect = body.aspect || template.aspects?.[0] || "16:9";
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
  // Prefer the explicit aspect selection; fall back to the template's first
  // defined aspect so aspect_ratio is never sent as an empty string.
  let effectiveAspect = body.aspect || template.aspects?.[0] || null;
  // "match" = keep the uploaded photo's aspect ratio. The value the model
  // expects differs: GPT-Image uses "auto"; nano-banana / seedream / flux use
  // "match_input_image".
  if (effectiveAspect === "match" || effectiveAspect === "match_input_image") {
    effectiveAspect = /gpt-image/i.test(template.model) ? "auto" : "match_input_image";
  }
  // openai/gpt-image-2 on Replicate only accepts 1:1 | 3:2 | 2:3 | auto.
  // Map common studio ratios to the nearest supported value so 4:5 / 9:16 / 16:9
  // don't 422 at submit (shown in the studio as a generic 502).
  if (effectiveAspect && /gpt-image/i.test(template.model)) {
    const gptAspect: Record<string, string> = {
      auto: "auto",
      "1:1": "1:1",
      "3:2": "3:2",
      "2:3": "2:3",
      "16:9": "3:2",
      "4:3": "3:2",
      "9:16": "2:3",
      "4:5": "2:3",
      "3:4": "2:3",
      "5:4": "1:1",
    };
    effectiveAspect = gptAspect[effectiveAspect] ?? "1:1";
  }
  if (effectiveAspect && "aspect_ratio" in input) input.aspect_ratio = effectiveAspect;
  // BytePlus (Ark) uses `ratio` instead of `aspect_ratio`.
  if (effectiveAspect && effectiveAspect !== "match" && "ratio" in input) input.ratio = effectiveAspect;
  if (template.type === "image" && "num_outputs" in input) input.num_outputs = qty;
  if (duration && "duration" in input) input.duration = duration;
  // Map the selected quality to the model's native resolution param. Quality
  // keys for resolution-capable models are the real values (e.g. "720p", "2K");
  // the regex guard prevents abstract tiers (std/pro/cinema) from leaking through.
  if (body.quality && "resolution" in input && /^(\d+p|\d+k)$/i.test(body.quality)) {
    input.resolution = body.quality;
  }

  // BytePlus real-person support: Seedance rejects raw photos of real people, so
  // register each reference to the Portrait Library and swap the raw URL for the
  // returned asset:// id. Images that aren't valid portraits (products, scenes)
  // fail registration and keep their raw URL, which Seedance accepts directly.
  // Real-person references were already registered to the Portrait Library at
  // upload time (POST /api/byteplus/portrait) and arrive here as `asset://` ids,
  // so generation stays fast. Just trim to the chosen model's reference cap.
  if (
    template.provider === "byteplus" &&
    Array.isArray(input.reference_images) &&
    limits.maxRefs &&
    (input.reference_images as unknown[]).length > limits.maxRefs
  ) {
    input.reference_images = (input.reference_images as unknown[]).slice(0, limits.maxRefs);
  }

  const reuseJson = buildReuseJson(body.reuse, limits.maxRefs);
  await db
    .prepare(
      `INSERT INTO generations (id, user_id, template_id, kind, type, provider, model, input_json, status, credits_charged, quality, quantity, reuse_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`
    )
      .bind(genId, userId, template.id, template.kind, template.type, template.provider, model, JSON.stringify(input), cost, body.quality ?? null, qty, reuseJson)
      .run();

  try {
    const { jobId } = await submitGeneration(env.SYNCNODE_API_KEY, { provider: template.provider, model, input });
    await db
      .prepare("UPDATE generations SET status='processing', provider_job_id=?, updated_at=datetime('now') WHERE id=?")
      .bind(jobId, genId)
      .run();
    return json({ id: genId, status: "processing", balance: deb.balance, cost });
  } catch (err) {
    return fail(err);
  }
}
