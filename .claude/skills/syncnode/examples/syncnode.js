// Minimal SyncNode client for Node.js (>=18) or any modern runtime with fetch.
// No dependencies. Drop into your project and import the functions you need.
//
//   import { createClient } from "./syncnode.js";
//   const sn = createClient({ apiKey: process.env.SYNCNODE_API_KEY });
//   const result = await sn.chat({ model: "openai/gpt-4o-mini", messages: [...] });

const BASE = "https://run.syncnode.ai";
const MODERATE_BASE = "https://moderate.syncnode.ai";

export function createClient({ apiKey, uid, accessToken } = {}) {
  // Accept either `apiKey` (preferred) or `uid` (legacy alias) for the constructor
  const key = apiKey || uid;
  if (!key) throw new Error("createClient: apiKey is required");

  const post = async (path, body, { needsAuth = false } = {}) => {
    const headers = { "Content-Type": "application/json" };
    if (needsAuth) {
      if (!accessToken) throw new Error(`${path} requires accessToken`);
      headers.Authorization = `Bearer ${accessToken}`;
    }
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ apiKey: key, ...body }),
    });
    const text = await res.text();
    let data; try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!res.ok || data?.error) {
      throw new Error(data?.error || `${path} failed: HTTP ${res.status}`);
    }
    return data;
  };

  const get = async (path, params = {}, { needsAuth = false } = {}) => {
    const url = new URL(`${BASE}${path}`);
    url.searchParams.set("apiKey", key);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const headers = {};
    if (needsAuth) {
      if (!accessToken) throw new Error(`${path} requires accessToken`);
      headers.Authorization = `Bearer ${accessToken}`;
    }
    const res = await fetch(url.toString(), { headers });
    const data = await res.json();
    if (!res.ok || data?.error) throw new Error(data?.error || `HTTP ${res.status}`);
    return data;
  };

  // ---- Public, synchronous endpoints ----

  const chat = (opts) => post("/chat-completion", opts);          // OpenRouter
  const chatgpt = (opts) => post("/chatgpt-completion", opts);    // OpenAI direct
  const balance = () => get("/balance");

  // ---- Public, async endpoints ----

  const generate = (opts) => post("/generate", opts);                          // Replicate
  const fal = (opts) => post("/fal/generate", opts);                           // FAL
  const alibaba = (opts) => post("/alibaba/generate", opts);                   // DashScope
  const faceSwap = (opts) => post("/face-swap/run", opts);

  // Status pollers
  const predictionStatus = (job_id) => get("/prediction-status", { job_id });
  const falStatus = (job_id) => get("/fal/status", { job_id });
  const alibabaStatus = (job_id) => get("/alibaba/status", { job_id });
  const faceSwapStatus = (job_id) => get("/face-swap/status", { job_id });

  // ---- Authenticated endpoints ----

  const tasks = (page = 1, size = 10) =>
    get("/tasks", { page, size }, { needsAuth: true });

  // ---- Helper: poll until done ----

  /**
   * Poll any async endpoint until it finishes or fails.
   * statusFn: one of predictionStatus, falStatus, alibabaStatus, faceSwapStatus
   */
  const waitForCompletion = async (statusFn, job_id, { intervalMs = 2000, timeoutMs = 5 * 60 * 1000 } = {}) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const status = await statusFn(job_id);
      const done = ["completed", "succeeded"].includes((status.replicate_status || "").toLowerCase())
        || ["COMPLETED", "SUCCEEDED"].includes((status.task_status || "").toUpperCase());
      const failed = (status.replicate_status === "failed")
        || ["FAILED", "CANCELED"].includes((status.task_status || "").toUpperCase());
      if (done) return status;
      if (failed) throw new Error(`Task failed: ${status.output || "unknown error"}`);
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    throw new Error(`Timed out waiting for job ${job_id}`);
  };

  // ---- Moderation (different base URL) ----

  const moderate = async (body) => {
    const url = new URL(MODERATE_BASE);
    url.searchParams.set("apiKey", key);
    url.searchParams.set("what", "moderation");
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: key, ...body }),
    });
    if (!res.ok) throw new Error(`Moderation failed: HTTP ${res.status}`);
    return res.json();
  };

  return {
    chat, chatgpt, balance,
    generate, fal, alibaba, faceSwap,
    predictionStatus, falStatus, alibabaStatus, faceSwapStatus,
    tasks,
    moderate,
    waitForCompletion,
  };
}

// ---- Example: generate an image with FAL and wait for the result ----

if (import.meta.url === `file://${process.argv[1]}`) {
  const sn = createClient({ apiKey: process.env.SYNCNODE_API_KEY });

  const submit = await sn.fal({
    model: "fal-ai/recraft/v4.1/text-to-image",
    input: {
      prompt: "Tilt-shift miniature of a Portuguese fishing village at golden hour",
      image_size: "landscape_16_9",
    },
  });
  console.log("Submitted:", submit.job_id);

  const result = await sn.waitForCompletion(sn.falStatus, submit.job_id);
  console.log("Done:", result.output);
}
