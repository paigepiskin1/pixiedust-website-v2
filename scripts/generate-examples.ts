// Batch-generate example outputs for templates that lack a preview, and set each
// result as the template's example (preview_image/preview_video). Runs against the
// dev server. Signs in as the admin user (generation needs a user session) and uses
// the admin bearer token for set-preview.
//   ADMIN_API_TOKEN=... npx tsx scripts/generate-examples.ts [filterPrefix]
// Default filterPrefix = "old-" (the migrated legacy templates).
const BASE = process.env.BASE || "http://localhost:4321";
const TOKEN = process.env.ADMIN_API_TOKEN || "";
const FIREBASE_KEY = "AIzaSyDd_K8qbm6MOiTlXpFiH4OwqTnUNoKIjrA";
const EMAIL = "claude.admin@pixiedust.dev";
const PASS = "";
const PREFIX = process.argv[2] || "old-";

// Public stock inputs for file fields (already-hosted on Bunny).
const STOCK_IMAGE = "https://pixiecdn.b-cdn.net/gen_d80b0323-9f76-44ee-bb08-a6aed948e196_1779890226156.png";
const DEFAULT_PROMPT = "a stylish young woman, natural light, looking at the camera, photorealistic";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  // 1. Firebase sign-in -> ID token -> session cookie
  const fb = await (
    await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: EMAIL, password: PASS, returnSecureToken: true }),
    })
  ).json();
  if (!fb.idToken) throw new Error("Firebase sign-in failed: " + JSON.stringify(fb.error || fb));

  const sres = await fetch(`${BASE}/api/auth/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken: fb.idToken }),
  });
  const setCookies = (sres.headers as any).getSetCookie?.() ?? [sres.headers.get("set-cookie")].filter(Boolean);
  const cookie = setCookies.map((c: string) => c.split(";")[0]).join("; ");
  const authH = { "Content-Type": "application/json", Cookie: cookie, Authorization: `Bearer ${TOKEN}` };

  // 2. List templates to process. FORCE=1 regenerates a fresh example for EVERY
  // template (even ones whose preview was carried over from the old site);
  // otherwise only those still missing an example.
  const FORCE = process.env.FORCE === "1";
  const list = await (await fetch(`${BASE}/api/admin/templates`, { headers: { Authorization: `Bearer ${TOKEN}` } })).json();
  const todo = (list.templates as any[]).filter((t) => t.id.startsWith(PREFIX) && (FORCE || !t.has_example));
  console.log(`${todo.length} template(s) to process (prefix "${PREFIX}", force=${FORCE}).`);

  let done = 0, failed = 0;
  for (const t of todo) {
    const { template } = await (await fetch(`${BASE}/api/admin/templates/${t.id}`, { headers: { Authorization: `Bearer ${TOKEN}` } })).json();
    const fields = JSON.parse(template.fields_json || "[]");
    const inputs: Record<string, unknown> = {};
    for (const f of fields) {
      if (f.type === "file") inputs[f.key] = STOCK_IMAGE;
      else if (f.type === "select") inputs[f.key] = f.options?.[0]?.value ?? "";
      else if (f.type === "number") inputs[f.key] = f.default ?? f.min ?? 1;
      else inputs[f.key] = f.default || DEFAULT_PROMPT;
    }

    const g = await (await fetch(`${BASE}/api/generate`, { method: "POST", headers: authH, body: JSON.stringify({ templateId: t.id, inputs }) })).json();
    if (!g.id) { console.log(`  ✗ ${t.id}: ${g.error}${g.detail ? " — " + g.detail : ""}`); failed++; continue; }

    let url: string | null = null;
    let err: string | null = null;
    for (let i = 0; i < 45; i++) {
      await sleep(4000);
      const s = await (await fetch(`${BASE}/api/generate/status?id=${g.id}`, { headers: { Cookie: cookie } })).json();
      if (s.status === "completed") { url = s.outputs?.[0] ?? null; break; }
      if (s.status === "failed") { err = s.error; break; }
    }
    if (url) {
      await fetch(`${BASE}/api/admin/templates/set-preview`, { method: "POST", headers: authH, body: JSON.stringify({ id: t.id, url, type: template.type }) });
      console.log(`  ✓ ${t.id} -> ${url.slice(0, 48)}`);
      done++;
    } else {
      console.log(`  ✗ ${t.id}: ${err || "timeout"}`);
      failed++;
    }
  }
  console.log(`Done. set ${done}, failed ${failed}.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
