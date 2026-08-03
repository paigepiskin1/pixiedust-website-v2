// Server-side SyncNode client. Routes by provider and normalizes the async
// job lifecycle (submit -> poll). Output files auto-host to the configured
// Bunny CDN by SyncNode; we just record the returned URL.
const BASE = "https://run.syncnode.ai";

export interface SubmitResult {
  jobId: string;
}

export async function submitGeneration(
  apiKey: string,
  opts: {
    provider: string;
    model: string;
    input: Record<string, unknown>;
    /** HTTPS callback SyncNode should POST when the job finishes. */
    webhookUrl?: string;
  }
): Promise<SubmitResult> {
  const { provider, model, input, webhookUrl } = opts;
  // BytePlus (Ark / Dreamina·Seedance) takes its params at the top level
  // (content, resolution, ratio, duration, …) rather than nested under `input`.
  const isByteplus = provider === "byteplus";
  const url =
    provider === "fal"
      ? `${BASE}/fal/generate`
      : provider === "alibaba"
        ? `${BASE}/alibaba/generate`
        : isByteplus
          ? `${BASE}/byteplus/generate`
          : `${BASE}/generate`;

  const payload: Record<string, unknown> = isByteplus
    ? { apiKey, model, ...input }
    : { apiKey, model, input };

  // SyncNode markets async webhooks; send common field names so whichever the
  // gateway accepts gets registered. Unknown fields are ignored.
  if (webhookUrl) {
    payload.webhook_url = webhookUrl;
    payload.webhookUrl = webhookUrl;
    payload.callback_url = webhookUrl;
  }

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
