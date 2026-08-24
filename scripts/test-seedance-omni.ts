/**
 * Validates the Seedance 2.0 · Omni Reference payload path end-to-end (logic
 * only, no network): template `input_json` + user inputs → resolveInput() →
 * generate-route aspect/duration/resolution mapping → shapeByteplusInput() →
 * the exact BytePlus Ark request body.
 *
 * Run: npx tsx scripts/test-seedance-omni.ts
 */
import assert from "node:assert/strict";
import { resolveInput, type Template } from "../src/lib/templates";
import { shapeByteplusInput } from "../src/lib/syncnode";

// Mirror of migrations/0015_seedance_2_omni_reference.sql (input_json + fields_json).
const input_json = {
  prompt: "{{prompt}}",
  reference_images: "{{references*}}",
  resolution: "720p",
  ratio: "16:9",
  duration: 5,
  generate_audio: true,
  watermark: false,
};
const fields = [
  { key: "references", type: "file", label: "Reference images", required: true, multiple: true, max: 8 },
  { key: "prompt", type: "textarea", label: "Prompt", required: true },
];

const template = { input: input_json, fields, steps: null } as unknown as Template;

let passed = 0;
const ok = (name: string) => { passed++; console.log(`  ✓ ${name}`); };

// ── 1. Happy path: 3 references + tagged prompt ────────────────────────────────
{
  const promptText = "@Image1 as the hero in @Image2's city, in the style of @Image3. Slow dolly-in.";
  const refs = ["https://cdn.example/a.jpg", "https://cdn.example/b.jpg", "https://cdn.example/c.jpg"];
  const { input, errors } = resolveInput(template, { prompt: promptText, references: refs });
  assert.deepEqual(errors, [], "no validation errors expected");

  // resolveInput keeps the flat shape; the array placeholder resolves to the URL list.
  assert.equal(input.prompt, promptText);
  assert.deepEqual(input.reference_images, refs);
  assert.equal(input.resolution, "720p");
  assert.equal(input.ratio, "16:9");
  assert.equal(input.generate_audio, true);
  assert.equal(input.watermark, false);
  ok("resolveInput fills prompt + reference_images array");

  // Simulate the /api/generate mapping of workspace controls onto the input.
  input.ratio = "9:16";        // aspect control
  input.duration = 8;          // duration control
  input.resolution = "480p";   // quality→resolution control

  const shaped = shapeByteplusInput(input);
  assert.deepEqual(shaped.content, [
    { type: "text", text: promptText },
    { type: "image_url", image_url: { url: refs[0] }, role: "reference_image" },
    { type: "image_url", image_url: { url: refs[1] }, role: "reference_image" },
    { type: "image_url", image_url: { url: refs[2] }, role: "reference_image" },
  ], "content assembled: text item first, then one reference_image per upload, in order");
  assert.equal("prompt" in shaped, false, "flat prompt removed after assembly");
  assert.equal("reference_images" in shaped, false, "flat reference_images removed after assembly");
  assert.equal(shaped.ratio, "9:16");
  assert.equal(shaped.duration, 8);
  assert.equal(shaped.resolution, "480p");
  assert.equal(shaped.generate_audio, true);
  assert.equal(shaped.watermark, false);
  ok("shapeByteplusInput → Ark content array + top-level params");

  // @ImageN tags in the prompt line up with content order (N = Nth reference_image).
  const refItems = (shaped.content as any[]).filter((c) => c.role === "reference_image");
  assert.equal(refItems[0].image_url.url, refs[0], "@Image1 → first uploaded reference");
  assert.equal(refItems[2].image_url.url, refs[2], "@Image3 → third uploaded reference");
  ok("@ImageN tag order matches upload order");
}

// ── 2. Max 8 references honored by the field cap (schema-level) ────────────────
{
  const f = fields.find((x) => x.key === "references")!;
  assert.equal((f as any).max, 8, "references field caps at 8 uploads");
  assert.equal((f as any).multiple, true);
  ok("references field is multiple with max 8");
}

// ── 3. Passthrough: a template that already supplies a `content` array ─────────
{
  const pre = { content: [{ type: "text", text: "hi" }], ratio: "1:1", duration: 5 };
  const shaped = shapeByteplusInput({ ...pre });
  assert.deepEqual(shaped, pre, "ready content array passes through untouched");
  ok("existing Ark content array is not rewritten");
}

// ── 4. Empty/missing references → text-only content, keys cleaned up ───────────
{
  const shaped = shapeByteplusInput({ prompt: "just text", reference_images: "", ratio: "16:9" });
  assert.deepEqual(shaped.content, [{ type: "text", text: "just text" }]);
  assert.equal("reference_images" in shaped, false);
  assert.equal("prompt" in shaped, false);
  ok("no references → single text content item");
}

// ── 5. Required-field validation ──────────────────────────────────────────────
{
  const { errors } = resolveInput(template, { references: ["https://cdn.example/a.jpg"] });
  assert.ok(errors.some((e) => /prompt is required/i.test(e)), "missing prompt flagged");
  const { errors: e2 } = resolveInput(template, { prompt: "x" });
  assert.ok(e2.some((e) => /reference images is required/i.test(e)), "missing references flagged");
  ok("required prompt + references enforced");
}

console.log(`\nAll ${passed} checks passed.`);
