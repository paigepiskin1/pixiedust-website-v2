import { createServer } from "http";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// Parse .env without any dependency
const envPath = join(dirname(fileURLToPath(import.meta.url)), ".env");
try {
  readFileSync(envPath, "utf-8").split("\n").forEach((line) => {
    const [key, ...rest] = line.split("=");
    if (key?.trim()) process.env[key.trim()] = rest.join("=").trim();
  });
} catch {}

const API_KEY = process.env.SYNCNODE_API_KEY;
const SYNCNODE = "https://run.syncnode.ai";
const PORT = 3001;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function send(res, data, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json", ...CORS });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve) => {
    let buf = "";
    req.on("data", (c) => (buf += c));
    req.on("end", () => resolve(buf));
  });
}

createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  // POST /generate  { model, input }
  if (req.method === "POST" && url.pathname === "/generate") {
    const body = JSON.parse(await readBody(req));
    const up = await fetch(`${SYNCNODE}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: API_KEY, ...body }),
    });
    send(res, await up.json(), up.status);
    return;
  }

  // GET /status?job_id=...
  if (req.method === "GET" && url.pathname === "/status") {
    const jobId = url.searchParams.get("job_id");
    if (!jobId) { send(res, { error: "missing job_id" }, 400); return; }
    const up = await fetch(`${SYNCNODE}/prediction-status?job_id=${jobId}`);
    send(res, await up.json(), up.status);
    return;
  }

  send(res, { error: "not found" }, 404);
}).listen(PORT, () => console.log(`Proxy → http://localhost:${PORT}`));
