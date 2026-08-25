export const prerender = false;
import type { APIContext } from "astro";
import { getTemplate, resolveInput, computeCost, isChain, allFields, resolveChainStep, applyFieldDefaults } from "../../../lib/templates";
import { getUserByUid } from "../../../lib/users";
import { debit, adjustBalance } from "../../../lib/credits";
import { submitGeneration, createPortraitGroup, registerPortraitAsset } from "../../../lib/syncnode";
import { getUserTier, checkRateLimit, countActiveGenerations } from "../../../lib/limits";
import { getSetting, setSetting } from "../../../lib/app-settings";

const PORTRAIT_GROUP_KEY = "byteplus_portrait_group";

// Reuse a single Portrait Library group across the app (created lazily, id cached
// in app_settings) so we don't spawn a new group per generation.
async function ensurePortraitGroup(apiKey: string, db: import("@cloudflare/workers-types").D1Database): Promise<string | null> {
  try {
    const cached = await getSetting(db, PORTRAIT_GROUP_KEY);
    if (cached) return cached;
    const gid = await createPortraitGroup(apiKey, "pixiedust-portraits");
    await setSetting(db, PORTRAIT_GROUP_KEY, gid);
    return gid;
  } catch (err) {
    console.error("[generate] portrait group ensure failed:", err);
    return null;
  }
}

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
  // Apply field defaults before validation/resolve so optional prompts with a
  // baked-in `default` still reach the model when the user leaves them blank.
  const inputs = applyFieldDefaults(template, body.inputs ?? {});

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
    const detail = String((err as Error).message || err || "Could not start generation");
    await adjustBalance(db, userId, cost, { reason: "generation_refund", refType: "generation", refId: genId, note: "dispatch failed" });
    await db
      .prepare("UPDATE generations SET status='failed', error=?, credits_refunded=?, updated_at=datetime('now') WHERE id=?")
      .bind(detail, cost, genId)
      .run();
    // Pass the provider message through so the studio can show a useful reason
    // (e.g. BytePlus real-person blocks) instead of a generic network error.
    return json({ error: detail + " — credits refunded." }, 502);
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
  if (template.provider === "byteplus" && Array.isArray(input.reference_images) && input.reference_images.length) {
    const groupId = await ensurePortraitGroup(env.SYNCNODE_API_KEY, db);
    if (groupId) {
      input.reference_images = await Promise.all(
        (input.reference_images as unknown[]).map(async (u) => {
          if (typeof u !== "string" || !/^https?:\/\//i.test(u)) return u;
          try {
            const r = await registerPortraitAsset(env.SYNCNODE_API_KEY, groupId, u);
            return r.active ? `asset://${r.assetId}` : u;
          } catch (err) {
            console.error("[generate] portrait register failed:", err);
            return u;
          }
        })
      );
    }
  }

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
