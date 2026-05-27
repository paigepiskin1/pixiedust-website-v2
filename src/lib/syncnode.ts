// Server-side SyncNode client. Routes by provider and normalizes the async
// job lifecycle (submit -> poll). Output files auto-host to the configured
// Bunny CDN by SyncNode; we just record the returned URL.
const BASE = "https://run.syncnode.ai";

export interface SubmitResult {
  jobId: string;
}

export async function submitGeneration(
  apiKey: string,
  opts: { provider: string; model: string; input: Record<string, unknown> }
): Promise<SubmitResult> {
  const { provider, model, input } = opts;
  const url =
    provider === "fal" ? `${BASE}/fal/generate` : provider === "alibaba" ? `${BASE}/alibaba/generate` : `${BASE}/generate`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey, model, input }),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, any>;
  if (!res.ok || !data.job_id) {
    throw new Error(data.error || data.detail || `SyncNode submit failed (${res.status})`);
  }
  return { jobId: data.job_id };
}

export type GenStatus = "processing" | "completed" | "failed";
export interface PollResult {
  status: GenStatus;
  outputs: string[];
  error?: string;
}

function normalizeOutputs(out: unknown): string[] {
  if (!out) return [];
  if (typeof out === "string") return [out];
  if (Array.isArray(out)) return out.filter((x): x is string => typeof x === "string");
  if (typeof out === "object") {
    const o = out as Record<string, any>;
    if (typeof o.url === "string") return [o.url];
    if (Array.isArray(o.images)) return o.images.map((i: any) => i?.url ?? i).filter((x: any) => typeof x === "string");
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
        : `${BASE}/prediction-status?${q}`;

  // status endpoints accept the api key on the query string for GET
  const res = await fetch(`${url}&apiKey=${encodeURIComponent(apiKey)}`);
  const data = (await res.json().catch(() => ({}))) as Record<string, any>;

  const rs = data.replicate_status || data.task_status || data.status;
  const succeeded = ["succeeded", "COMPLETED", "SUCCEEDED", "completed"].includes(rs);
  const failed = ["failed", "FAILED", "CANCELED", "error"].includes(rs);
  const outputs = normalizeOutputs(data.output);

  if (succeeded || (outputs.length && !failed)) return { status: "completed", outputs };
  if (failed) {
    const error = typeof data.output === "string" ? data.output : data.error || "Generation failed";
    return { status: "failed", outputs: [], error };
  }
  return { status: "processing", outputs: [] };
}
