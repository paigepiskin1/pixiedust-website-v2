export const prerender = false;
import type { APIContext } from "astro";
import { getTemplate, resolveInput, computeCost, isChain, allFields, resolveChainStep, applyFieldDefaults } from "../../../lib/templates";
import { getUserByUid } from "../../../lib/users";
import { debit, adjustBalance } from "../../../lib/credits";
import { submitGeneration } from "../../../lib/syncnode";
import { prepareByteplusAssets } from "../../../lib/byteplus-assets";
import { buildSeedanceMultimodalContent } from "../../../lib/seedance-content";
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

  // Opt-in multimodal Seedance: rebuild Ark `content[]` from prompt + up to 9
  // labeled image/video/audio refs (meta.multimodal). Template input_json only
  // needs a text stub; media parts are appended here.
  let useMultimodal = false;
  try {
    const m = template.meta ? JSON.parse(template.meta) : null;
    useMultimodal = !!(m && m.multimodal);
  } catch { /* meta isn't JSON */ }
  if (template.provider === "byteplus" && useMultimodal) {
    const prompt =
      typeof inputs.prompt === "string"
        ? inputs.prompt
        : typeof input.content === "object" &&
            Array.isArray((input as any).content) &&
            typeof (input as any).content[0]?.text === "string"
          ? (input as any).content[0].text
          : "";
    const built = buildSeedanceMultimodalContent(prompt, inputs.files ?? inputs.image);
    if (built.error) {
      await adjustBalance(db, userId, cost, { reason: "generation_refund", refType: "generation", refId: genId, note: "multimodal validate failed" });
      return json({ error: built.error + " — you weren't charged." }, 400);
    }
    input.content = built.content;
  }

  // Seedance video never takes Seedream image-only params.
  if (template.provider === "byteplus" && /seedance/i.test(template.model)) {
    delete input.output_format;
    delete input.response_format;
    delete input.aspect_ratio;
  }
  // Seedream 4.5 multi-ref docs: output_format "png" (jpeg was rejected), no response_format.
  if (template.provider === "byteplus" && /seedream-4/i.test(template.model)) {
    delete input.response_format;
    input.output_format = "png";
  }

  // BytePlus Seedream accepts mixed media refs — keep images in `image`, and
  // surface video/audio on their own keys so non-image URLs aren't stuffed into
  // the image array (which BytePlus rejects).
  if (
    template.provider === "byteplus" &&
    /seedream/i.test(template.model) &&
    Array.isArray(input.image)
  ) {
    const images: string[] = [];
    const videos: string[] = [];
    const audios: string[] = [];
    for (const u of input.image as unknown[]) {
      if (typeof u !== "string" || !u) continue;
      if (/\.(mp4|mov|webm)(\?|$)/i.test(u)) videos.push(u);
      else if (/\.(mp3|wav|m4a|aac|ogg|mpeg)(\?|$)/i.test(u)) audios.push(u);
      else images.push(u);
    }
    if (images.length) input.image = images;
    else delete input.image;
    if (videos.length) input.video = videos.length === 1 ? videos[0] : videos;
    if (audios.length) input.audio = audios.length === 1 ? audios[0] : audios;
  }

  // Prefer the explicit aspect selection; fall back to the template's first
  // defined aspect so aspect_ratio is never sent as an empty string.
  let effectiveAspect = body.aspect || template.aspects?.[0] || null;
  // "match" = keep the uploaded photo's aspect ratio. The value the model
  // expects differs: GPT-Image uses "auto"; Replicate nano-banana / seedream /
  // flux use "match_input_image"; BytePlus Seedream image omits the ratio field.
  if (effectiveAspect === "match" || effectiveAspect === "match_input_image") {
    if (/gpt-image/i.test(template.model)) effectiveAspect = "auto";
    else if (template.provider === "byteplus" && /seedream/i.test(template.model)) effectiveAspect = null;
    else effectiveAspect = "match_input_image";
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
  else if ("aspect_ratio" in input && (!input.aspect_ratio || input.aspect_ratio === "match" || input.aspect_ratio === "match_input_image")) {
    delete input.aspect_ratio;
  }
  // BytePlus video (Seedance) uses `ratio` instead of `aspect_ratio`.
  if (effectiveAspect && effectiveAspect !== "match" && "ratio" in input) input.ratio = effectiveAspect;
  if (template.type === "image" && "num_outputs" in input) input.num_outputs = qty;
  if (duration && "duration" in input) input.duration = duration;
  // Map the selected quality to the model's native resolution/size param. Quality
  // keys for resolution-capable models are the real values (e.g. "720p", "2K");
  // the regex guard prevents abstract tiers (std/pro/cinema) from leaking through.
  if (body.quality && "resolution" in input && /^(\d+p|\d+k)$/i.test(body.quality)) {
    input.resolution = body.quality;
  }
  // Seedream (Replicate / BytePlus image) uses `size`: "1K" | "2K" | "4K" (and WxH).
  if (body.quality && "size" in input && /^(1K|2K|4K)$/i.test(body.quality)) {
    input.size = body.quality.toUpperCase();
  }

  // Opt-in (template meta { "assetLibrary": true }): push each uploaded photo
  // into the BytePlus asset library and swap it for an asset://<id> reference,
  // which is how Ark authorizes real faces. Runs before the row is stored so
  // input_json records the final asset refs; on failure we refund + surface the
  // real reason (moderation / bad photo) instead of a generic error.
  let useAssetLib = false;
  try {
    const m = template.meta ? JSON.parse(template.meta) : null;
    useAssetLib = !!(m && m.assetLibrary);
  } catch { /* meta isn't JSON */ }
  if (template.provider === "byteplus" && useAssetLib) {
    try {
      await prepareByteplusAssets(env.SYNCNODE_API_KEY, db, input);
    } catch (err) {
      await adjustBalance(db, userId, cost, { reason: "generation_refund", refType: "generation", refId: genId, note: "asset prep failed" });
      return json({ error: String((err as Error).message || err) + " — you weren't charged." }, 502);
    }
  }

  await db
    .prepare(
      `INSERT INTO generations (id, user_id, template_id, kind, type, provider, model, input_json, status, credits_charged, quality, quantity)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`
    )
    .bind(genId, userId, template.id, template.kind, template.type, template.provider, template.model, JSON.stringify(input), cost, body.quality ?? null, qty)
    .run();

  // BytePlus Seedream (`/byteplus/image`) is synchronous at SyncNode and often
  // takes 30–90s. Waiting in this request hits Cloudflare's gateway timeout and
  // the studio only sees a bare 502. Run it under waitUntil and let the studio
  // poll /api/generate/status for the real completed/failed result.
  const isByteplusSeedream =
    template.provider === "byteplus" && /seedream/i.test(template.model);

  if (isByteplusSeedream) {
    await db
      .prepare("UPDATE generations SET status='processing', updated_at=datetime('now') WHERE id=?")
      .bind(genId)
      .run();

    const finalize = async () => {
      try {
        const submitted = await submitGeneration(env.SYNCNODE_API_KEY, {
          provider: template.provider,
          model: template.model,
          input,
        });
        if (submitted.status === "completed" && (submitted.outputs?.length ?? 0) > 0) {
          await db
            .prepare("UPDATE generations SET status='completed', provider_job_id=?, output_url=?, updated_at=datetime('now') WHERE id=?")
            .bind(submitted.jobId, submitted.outputs![0], genId)
            .run();
          return;
        }
        if (submitted.jobId) {
          await db
            .prepare("UPDATE generations SET status='processing', provider_job_id=?, updated_at=datetime('now') WHERE id=?")
            .bind(submitted.jobId, genId)
            .run();
          return;
        }
        throw new Error(submitted.error || "BytePlus image generation returned no output");
      } catch (err) {
        const detail = String((err as Error).message || err || "Could not start generation");
        await adjustBalance(db, userId, cost, { reason: "generation_refund", refType: "generation", refId: genId, note: "dispatch failed" });
        await db
          .prepare("UPDATE generations SET status='failed', error=?, credits_refunded=?, updated_at=datetime('now') WHERE id=?")
          .bind(detail, cost, genId)
          .run();
      }
    };

    const ctx = (locals.runtime as any).ctx;
    if (ctx?.waitUntil) ctx.waitUntil(finalize());
    else finalize().catch(() => {});

    return json({ id: genId, status: "processing", balance: deb.balance, cost });
  }

  try {
    const submitted = await submitGeneration(env.SYNCNODE_API_KEY, { provider: template.provider, model: template.model, input });
    if (submitted.status === "completed" && (submitted.outputs?.length ?? 0) > 0) {
      await db
        .prepare("UPDATE generations SET status='completed', provider_job_id=?, output_url=?, updated_at=datetime('now') WHERE id=?")
        .bind(submitted.jobId, submitted.outputs![0], genId)
        .run();
      return json({ id: genId, status: "completed", outputs: submitted.outputs, balance: deb.balance, cost });
    }
    await db
      .prepare("UPDATE generations SET status='processing', provider_job_id=?, updated_at=datetime('now') WHERE id=?")
      .bind(submitted.jobId, genId)
      .run();
    return json({ id: genId, status: "processing", balance: deb.balance, cost });
  } catch (err) {
    return fail(err);
  }
}
