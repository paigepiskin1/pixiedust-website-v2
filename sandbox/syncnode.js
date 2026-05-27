const WORKER_URL = "https://pixiedust-api.workers.dev"; // replace with your deployed worker URL

async function startImageGeneration(prompt, options = {}) {
  const { model = "black-forest-labs/flux-schnell", width = 1024, height = 1024, ...rest } = options;

  const res = await fetch(`${WORKER_URL}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, input: { prompt, width, height, ...rest } }),
  });

  if (!res.ok) throw new Error(`Generate failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function pollResult(jobId, { interval = 3000, timeout = 120000 } = {}) {
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, interval));

    const res = await fetch(`${WORKER_URL}/status?job_id=${jobId}`);
    if (!res.ok) throw new Error(`Poll failed: ${res.status}`);

    const data = await res.json();

    if (data.output) return data;
    if (data.replicate_status === "failed" || data.status === "failed")
      throw new Error(`Job failed: ${JSON.stringify(data)}`);
  }

  throw new Error(`Timed out waiting for job ${jobId}`);
}

export async function generateImage(prompt, options = {}) {
  const { job_id } = await startImageGeneration(prompt, options);
  return pollResult(job_id);
}
