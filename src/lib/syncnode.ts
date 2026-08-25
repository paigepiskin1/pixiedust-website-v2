// Server-side SyncNode client. Routes by provider and normalizes the async
// job lifecycle (submit -> poll). Output files auto-host to the configured
// Bunny CDN by SyncNode; we just record the returned URL.
const BASE = "https://run.syncnode.ai";

export interface SubmitResult {
  jobId: string;
}

/**
 * Shape a resolved template input into the BytePlus (Ark / Dreamina·Seedance)
 * multimodal request body.
 *
 * Ark expects a `content` array that mixes a text item with typed media items
 * (`role: reference_image | first_frame | last_frame | reference_video | …`).
 * Templates that already provide a ready `content` array pass through unchanged.
 *
 * Omni-reference templates can't hand-write that array because the number of
 * references is chosen by the user at runtime, so they instead supply a flat
 * `prompt` string + a `reference_images` array of URLs (from a multi-file
 * upload field). We assemble the Ark `content` here: the prompt becomes the
 * text item and each URL becomes a `role: reference_image` item, in upload
 * order, so the prompt's `@Image1`, `@Image2`, … tags bind to the right image.
 */
export function shapeByteplusInput(input: Record<string, unknown>): Record<string, unknown> {
  // A template-authored `content` array is already in Ark form — don't touch it.
  if (Array.isArray(input.content)) return input;
  // Nothing to assemble unless the flat omni-reference shape is present.
  if (!("prompt" in input) && !("reference_images" in input)) return input;

  const { prompt, reference_images, ...rest } = input as Record<string, unknown> & {
    prompt?: unknown;
    reference_images?: unknown;
  };
  const refs = Array.isArray(reference_images)
    ? reference_images.filter((u): u is string => typeof u === "string" && u.length > 0)
    : [];

  const content: unknown[] = [{ type: "text", text: String(prompt ?? "") }];
  for (const url of refs) content.push({ type: "image_url", image_url: { url }, role: "reference_image" });

  return { ...rest, content };
}

// ── BytePlus Real-Human Portrait Library ─────────────────────────────────────
// Seedance blocks raw photos of real people. To use an actual person, register
// their photo to the Portrait Library to get an `asset://<id>` id, then pass
// that id (instead of the raw URL) as a reference_image. SyncNode proxies the
// AK/SK-signed library APIs; the account needs "Advanced Creation Rights".

async function byteplusAsset(
  apiKey: string,
  action: string,
  params: Record<string, unknown>,
  attempt = 0
): Promise<Record<string, any>> {
  const res = await fetch(`${BASE}/byteplus/asset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey, action, params }),
  });
  // SyncNode rate-limits the asset endpoint; back off and retry on 429/5xx so a
  // multi-reference generation doesn't fail just from call bursts.
  if ((res.status === 429 || res.status >= 500) && attempt < 4) {
    await new Promise((r) => setTimeout(r, 1500 * 2 ** attempt)); // 1.5s, 3s, 6s, 12s
    return byteplusAsset(apiKey, action, params, attempt + 1);
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, any>;
  if (!res.ok) {
    const detail =
      (data?.ResponseMetadata?.Error?.Message as string) ||
      (typeof data.error === "string" && data.error) ||
      `BytePlus asset ${action} failed (${res.status})`;
    throw new Error(detail);
  }
  return data;
}

/** Create a portrait asset group and return its id. */
export async function createPortraitGroup(apiKey: string, name: string): Promise<string> {
  const d = await byteplusAsset(apiKey, "CreateAssetGroup", { Name: name, ProjectName: "default" });
  const id = d?.Result?.Id;
  if (!id) throw new Error("CreateAssetGroup returned no Id");
  return String(id);
}

/**
 * Register an image URL to the Portrait Library and poll until it is ready.
 * Returns the asset id plus whether it became `Active` (a valid real-human
 * portrait). Non-face images resolve as `active:false` (Failed or timed out),
 * so the caller can keep the raw URL for them.
 */
export async function registerPortraitAsset(
  apiKey: string,
  groupId: string,
  url: string,
  opts: { pollMs?: number; timeoutMs?: number } = {}
): Promise<{ assetId: string; active: boolean }> {
  const created = await byteplusAsset(apiKey, "CreateAsset", {
    GroupId: groupId,
    URL: url,
    AssetType: "Image",
    ProjectName: "default",
  });
  const assetId = created?.Result?.Id;
  if (!assetId) throw new Error("CreateAsset returned no Id");

  const pollMs = opts.pollMs ?? 2500;
  const deadline = Date.now() + (opts.timeoutMs ?? 30000);
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, pollMs));
    const got = await byteplusAsset(apiKey, "GetAsset", { Id: assetId, ProjectName: "default" });
    const status = got?.Result?.Status;
    if (status === "Active") return { assetId: String(assetId), active: true };
    if (status === "Failed") return { assetId: String(assetId), active: false };
  }
  return { assetId: String(assetId), active: false };
}

/** Best-effort delete of a portrait asset (used to minimize face retention). */
export async function deletePortraitAsset(apiKey: string, assetId: string): Promise<void> {
  try {
    await byteplusAsset(apiKey, "DeleteAsset", { Id: assetId, ProjectName: "default" });
  } catch {
    /* best effort — leaving a stray asset is not fatal */
  }
}

export async function submitGeneration(
  apiKey: string,
  opts: { provider: string; model: string; input: Record<string, unknown> }
): Promise<SubmitResult> {
  const { provider, model, input } = opts;
  // BytePlus (Ark / Dreamina·Seedance) takes its params at the top level
  // (content, resolution, ratio, duration, …) rather than nested under `input`.
  const isByteplus = provider === "byteplus";
  const shaped = isByteplus ? shapeByteplusInput(input) : input;
  const url =
    provider === "fal"
      ? `${BASE}/fal/generate`
      : provider === "alibaba"
        ? `${BASE}/alibaba/generate`
        : isByteplus
          ? `${BASE}/byteplus/generate`
          : `${BASE}/generate`;

  const payload = isByteplus ? { apiKey, model, ...shaped } : { apiKey, model, input };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, any>;
  if (!res.ok || !data.job_id) {
    const detail =
      (typeof data.error === "string" && data.error) ||
      (typeof data.detail === "string" && data.detail) ||
      (typeof data.message === "string" && data.message) ||
      (data.error && typeof data.error === "object"
        ? JSON.stringify(data.error)
        : "") ||
      `SyncNode submit failed (${res.status})`;
    throw new Error(detail);
  }
  return { jobId: data.job_id };
}

export type GenStatus = "processing" | "completed" | "failed";
export interface PollResult {
  status: GenStatus;
  outputs: string[];
  error?: string;
}

function looksLikeUrl(s: string): boolean {
  return /^https?:\/\//i.test(s) || /^data:/i.test(s);
}

function normalizeOutputs(out: unknown): string[] {
  if (!out) return [];
  // BytePlus/SyncNode often put failure messages in `output` as a plain string.
  // Only treat URL-like strings as media so error text isn't shown as a "video".
  if (typeof out === "string") return looksLikeUrl(out) ? [out] : [];
  if (Array.isArray(out)) return out.filter((x): x is string => typeof x === "string" && looksLikeUrl(x));
  if (typeof out === "object") {
    const o = out as Record<string, any>;
    if (typeof o.url === "string" && looksLikeUrl(o.url)) return [o.url];
    if (Array.isArray(o.images)) {
      return o.images.map((i: any) => i?.url ?? i).filter((x: any) => typeof x === "string" && looksLikeUrl(x));
    }
    if (o.output) return normalizeOutputs(o.output);
  }
  return [];
}

export async function pollStatus(apiKey: string, provider: string, jobId: string): Promise<PollResult> {
  const q = `job_id=${encodeURIComponent(jobId)}`;
  const url =
    provider === "fal"
      ? `${BASE}/fal/status?${q}`
      : provider === "alibaba"
        ? `${BASE}/alibaba/status?${q}`
        : provider === "byteplus"
          ? `${BASE}/byteplus/status?${q}`
          : `${BASE}/prediction-status?${q}`;

  // SyncNode requires the key on the query string for GET status endpoints.
  // We also send it as a header so migration to header-only auth is seamless
  // if their API adds support for it in future.
  const res = await fetch(`${url}&apiKey=${encodeURIComponent(apiKey)}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, any>;

  const rs = data.replicate_status || data.task_status || data.status;
  const succeeded = ["succeeded", "COMPLETED", "SUCCEEDED", "completed"].includes(rs);
  const failed = ["failed", "FAILED", "CANCELED", "CANCELLED", "cancelled", "canceled", "error"].includes(rs);
  const outputs = normalizeOutputs(data.output);
  const rawOut = data.output;
  const messageError =
    (typeof rawOut === "string" && !looksLikeUrl(rawOut) ? rawOut.trim() : "") ||
    (typeof data.error === "string" ? data.error.trim() : "") ||
    "";

  if (failed) {
    return { status: "failed", outputs: [], error: messageError || "Generation failed" };
  }
  // Some providers finish the job as "succeeded" but put a rejection message in
  // `output` instead of a media URL (BytePlus real-person blocks do this).
  if (!outputs.length && messageError && (succeeded || /real person|sensitive|moderation|safety|content policy|flagged/i.test(messageError))) {
    return { status: "failed", outputs: [], error: messageError };
  }
  if (succeeded || outputs.length) return { status: "completed", outputs };
  return { status: "processing", outputs: [] };
}
