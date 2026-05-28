/**
 * Re-tests the three previously failing templates:
 *   - old-emojiify (kontext-emoji-maker) — was using wrong param name
 *   - old-f1-racing-trend (gpt-image-2)  — was timeout
 *   - old-face-swap                       — was timeout
 */
import fs from "fs";

const BASE = "http://localhost:4321";
const FIREBASE_KEY = "AIzaSyDd_K8qbm6MOiTlXpFiH4OwqTnUNoKIjrA";
const EMAIL = "claude.admin@pixiedust.dev";
const PASSWORD = "PixieClaude!a9Rt2026";

const TEST_IMG = "https://pixiecdn.b-cdn.net/gen_d80b0323-9f76-44ee-bb08-a6aed948e196_1779903685242.png";
const TEST_IMG_2 = "https://pixiecdn.b-cdn.net/gen_d80b0323-9f76-44ee-bb08-a6aed948e196_1779903751526.png";

const TESTS = [
  {
    id: "old-emojiify",
    label: "kontext-emoji-maker",
    inputs: { file: TEST_IMG },
    aspect: "1:1",
    maxWait: 180,
  },
  {
    id: "old-f1-racing-trend",
    label: "gpt-image-2",
    inputs: { files: [TEST_IMG] },
    aspect: "1:1",
    maxWait: 360,
  },
  {
    id: "old-face-swap",
    label: "face-swap-with-ideogram",
    inputs: { target_image: TEST_IMG, character_image: TEST_IMG_2 },
    maxWait: 420,
  },
];

async function signIn() {
  console.log("Signing in…");
  const r = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD, returnSecureToken: true }),
    }
  );
  const d = await r.json();
  if (!d.idToken) throw new Error("Firebase sign-in failed: " + JSON.stringify(d));
  const sr = await fetch(`${BASE}/api/auth/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken: d.idToken }),
  });
  const cookie = sr.headers.get("set-cookie") || "";
  const match = cookie.match(/pd_session=[^;]+/);
  if (!match) throw new Error("Session cookie not set");
  console.log("Signed in ✓\n");
  return match[0];
}

async function generate(cookie, templateId, inputs, aspect) {
  const r = await fetch(`${BASE}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ templateId, inputs, quantity: 1, aspect: aspect || "1:1" }),
  });
  return [r.status, await r.json()];
}

async function poll(cookie, id, maxWaitSecs = 180) {
  const deadline = Date.now() + maxWaitSecs * 1000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 5000));
    const r = await fetch(`${BASE}/api/generate/status?id=${id}`, {
      headers: { Cookie: cookie },
    });
    const d = await r.json();
    if (d.status === "completed") return { ok: true, outputs: d.outputs };
    if (d.status === "failed") return { ok: false, error: d.error };
    process.stdout.write(".");
  }
  return { ok: false, error: "timeout" };
}

const results = [];

async function runTest(cookie, test) {
  process.stdout.write(`\n[${test.label}] ${test.id} … `);
  const [status, data] = await generate(cookie, test.id, test.inputs, test.aspect);
  if (status !== 200) {
    const msg = `SUBMIT FAILED (${status}): ${data.error || JSON.stringify(data)}`;
    results.push({ label: test.label, id: test.id, ok: false, msg });
    process.stdout.write("✗ " + msg);
    return;
  }
  const result = await poll(cookie, data.id, test.maxWait || 180);
  if (result.ok) {
    results.push({ label: test.label, id: test.id, ok: true, output: result.outputs?.[0] });
    process.stdout.write(" ✓");
  } else {
    results.push({ label: test.label, id: test.id, ok: false, msg: result.error });
    process.stdout.write(` ✗ ${result.error}`);
  }
}

(async () => {
  const cookie = await signIn();
  for (const test of TESTS) {
    await runTest(cookie, test);
  }
  console.log("\n\n═══════════ RESULTS ═══════════");
  for (const r of results) {
    const icon = r.ok ? "✅" : "❌";
    console.log(`${icon} ${r.label.padEnd(35)} ${r.id}`);
    if (!r.ok) console.log(`   └─ ${r.msg}`);
    if (r.ok && r.output) console.log(`   └─ ${r.output}`);
  }
  const passed = results.filter((r) => r.ok).length;
  console.log(`\n${passed}/${results.length} passed`);
})();
