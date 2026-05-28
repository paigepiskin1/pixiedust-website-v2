import { readFileSync } from "fs";

const vars = Object.fromEntries(
  readFileSync(".dev.vars", "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => l.split("=").map((s) => s.trim()))
);
const apiKey = vars.SYNCNODE_API_KEY;
if (!apiKey) throw new Error("SYNCNODE_API_KEY not found in .dev.vars");

const BASE = "https://run.syncnode.ai";

async function checkJob(jobId, provider) {
  const q = `job_id=${encodeURIComponent(jobId)}&apiKey=${encodeURIComponent(apiKey)}`;
  const url =
    provider === "fal"
      ? `${BASE}/fal/status?${q}`
      : provider === "alibaba"
        ? `${BASE}/alibaba/status?${q}`
        : `${BASE}/prediction-status?${q}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
  const data = await res.json().catch(() => ({}));
  return { httpStatus: res.status, data };
}

const jobs = [
  { label: "old-emojiify", jobId: "8a49e5fe-d10b-4cb7-a3f4-91510e90584c", provider: "replicate" },
  { label: "old-face-swap", jobId: "9320a68e-4a12-48be-b1dc-da0997f49464", provider: "replicate" },
];

for (const { label, jobId, provider } of jobs) {
  const result = await checkJob(jobId, provider);
  console.log(`\n[${label}] provider=${provider}`);
  console.log(JSON.stringify(result.data, null, 2));
}
