const SYNCNODE_BASE = "https://run.syncnode.ai";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS });
    }

    const url = new URL(request.url);

    // POST /generate  { model, input }
    if (request.method === "POST" && url.pathname === "/generate") {
      const body = await request.json();
      const res = await fetch(`${SYNCNODE_BASE}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: env.SYNCNODE_API_KEY, ...body }),
      });
      const data = await res.json();
      return json(data, res.status);
    }

    // POST /generate-batch  { model, input, count? }
    // Submits `count` (default 4) jobs in parallel and returns all job_ids
    if (request.method === "POST" && url.pathname === "/generate-batch") {
      const { model, input, count = 4 } = await request.json();
      const results = await Promise.all(
        Array.from({ length: count }, () =>
          fetch(`${SYNCNODE_BASE}/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ apiKey: env.SYNCNODE_API_KEY, model, input }),
          }).then((r) => r.json())
        )
      );
      return json({ jobs: results });
    }

    // GET /status?job_id=...
    if (request.method === "GET" && url.pathname === "/status") {
      const jobId = url.searchParams.get("job_id");
      if (!jobId) return json({ error: "missing job_id" }, 400);
      const res = await fetch(`${SYNCNODE_BASE}/prediction-status?job_id=${jobId}`);
      const data = await res.json();
      return json(data, res.status);
    }

    return json({ error: "not found" }, 404);
  },
};
