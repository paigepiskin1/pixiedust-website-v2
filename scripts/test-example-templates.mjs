/**
 * Batch-test every template that has an example/preview by running it through
 * the admin test-run endpoint (single-step) with synthetic inputs, then polling
 * to completion. Reports pass/fail per template.
 *
 * Run: node scripts/dev.mjs node scripts/test-example-templates.mjs
 * Env: CLOUDFLARE_API_TOKEN, ADMIN_API_TOKEN (from .dev.vars)
 */
const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID || "15149dc8d99998b6c96a67c2cf52ad7c";
const DB_ID = process.env.CF_D1_DATABASE_ID || "105e2276-0d51-430a-8c6f-b4f7ee699aaf";
const CF_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const ADMIN = process.env.ADMIN_API_TOKEN;
const BASE = process.env.TEST_BASE || "https://sys.pixiedustapp.com";
const STOCK = "https://pixiecdn.b-cdn.net/gen_d80b0323-9f76-44ee-bb08-a6aed948e196_1779890226156.png";
const CONCURRENCY = 5;
const POLL_MAX = 40; // × 3s ≈ 2 min

if (!CF_TOKEN || !ADMIN) {
  console.error("Missing CLOUDFLARE_API_TOKEN or ADMIN_API_TOKEN. Run via: node scripts/dev.mjs node scripts/test-example-templates.mjs");
  process.exit(1);
}

async function d1(sql) {
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/d1/database/${DB_ID}/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${CF_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ sql }),
  });
  const d = await r.json();
  if (!d.success) throw new Error(JSON.stringify(d.errors));
  return d.result?.[0]?.results ?? [];
}

const firstOf = (raw) => { try { const a = JSON.parse(raw || "[]"); return Array.isArray(a) ? a[0] : undefined; } catch { return undefined; } };

function synthFieldValues(fieldsJson, aspectsJson, durationsJson, inputJson) {
  const fv = {};
  let fields = [];
  try { fields = JSON.parse(fieldsJson || "[]"); } catch {}
  for (const f of fields) {
    const k = f.key, t = f.type || "text";
    if (t === "file" || t === "url") fv[k] = f.multiple ? [STOCK] : STOCK;
    else if (t === "number") fv[k] = f.default ?? f.min ?? 1;
    else if (t === "select") fv[k] = f.options?.[0]?.value ?? f.options?.[0] ?? "";
    else if (t === "toggle") fv[k] = f.default ?? true;
    else fv[k] = f.default || "a golden retriever puppy in a sunny park";
  }
  // Controls the test panel injects from template config.
  if (/\{\{aspect\b/.test(inputJson)) fv.aspect = firstOf(aspectsJson) ?? "1:1";
  if (/\{\{duration\b/.test(inputJson)) fv.duration = firstOf(durationsJson) ?? 5;
  if (/\{\{quantity\b/.test(inputJson)) fv.quantity = 1;
  return fv;
}

async function testOne(t) {
  if (t.steps_json) return { id: t.id, model: t.model, result: "SKIP (multi-step chain)" };
  const field_values = synthFieldValues(t.fields_json, t.aspects_json, t.durations_json, t.input_json || "");
  let sub;
  try {
    const r = await fetch(`${BASE}/api/admin/templates/test-run`, {
      method: "POST",
      headers: { Authorization: `Bearer ${ADMIN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ provider: t.provider, model: t.model, input_json: t.input_json, field_values }),
    });
    sub = await r.json();
    if (!r.ok || !sub.jobId) return { id: t.id, model: t.model, result: `SUBMIT FAIL (${r.status}): ${sub.error || "no jobId"}` };
  } catch (e) {
    return { id: t.id, model: t.model, result: `SUBMIT ERROR: ${e.message}` };
  }
  for (let i = 0; i < POLL_MAX; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    try {
      const s = await (await fetch(`${BASE}/api/admin/templates/test-status?jobId=${encodeURIComponent(sub.jobId)}&provider=${encodeURIComponent(sub.provider)}`, { headers: { Authorization: `Bearer ${ADMIN}` } })).json();
      if (s.status === "completed") return { id: t.id, model: t.model, result: "✅ OK" };
      if (s.status === "failed") return { id: t.id, model: t.model, result: `❌ GEN FAIL: ${s.error || "unknown"}` };
    } catch {}
  }
  return { id: t.id, model: t.model, result: "⏳ TIMEOUT (still processing)" };
}

async function run() {
  const rows = await d1(
    "SELECT id, provider, model, type, fields_json, input_json, steps_json, aspects_json, durations_json FROM templates WHERE is_hidden=0 AND (preview_image IS NOT NULL OR preview_video IS NOT NULL) ORDER BY id"
  );
  console.log(`Testing ${rows.length} templates with examples…\n`);
  const results = [];
  let idx = 0;
  async function worker() {
    while (idx < rows.length) {
      const t = rows[idx++];
      const res = await testOne(t);
      results.push(res);
      console.log(`  ${res.result.padEnd(34)} ${res.id}  [${res.model}]`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  const fails = results.filter((r) => !r.result.startsWith("✅") && !r.result.startsWith("SKIP"));
  console.log(`\n──────── SUMMARY ────────`);
  console.log(`OK: ${results.filter((r) => r.result.startsWith("✅")).length} · SKIP(chain): ${results.filter((r) => r.result.startsWith("SKIP")).length} · PROBLEMS: ${fails.length}`);
  if (fails.length) {
    console.log(`\nPROBLEMS:`);
    for (const f of fails) console.log(`  ${f.result}  ${f.id} [${f.model}]`);
  }
}
run().catch((e) => { console.error(e); process.exit(1); });
