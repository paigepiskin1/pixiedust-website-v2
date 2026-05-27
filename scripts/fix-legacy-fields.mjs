// One-time repair for migrated legacy templates whose input_json still carries
// un-converted field descriptors, which make the provider reject the request:
//   1. Raw legacy placeholders:  "{{select|Label|desc|opt1,opt2}}"
//   2. Embedded field objects:   {"type":"select","label":"…","options":[…]}
//   3. nano-banana-pro image_input must be an ARRAY, not a string.
// For (1)/(2) we replace the value with a clean "{{key}}" token and add a proper
// field to fields_json. Saves via the admin Template API. Idempotent.
//   node scripts/fix-legacy-fields.mjs
const BASE = process.env.BASE || "http://localhost:4321";
const TOKEN = process.env.ADMIN_API_TOKEN || "";
if (!TOKEN) { console.error("Required: ADMIN_API_TOKEN env var.  ADMIN_API_TOKEN=... node scripts/fix-legacy-fields.mjs"); process.exit(1); }
const H = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };
const FIELD_TYPES = ["select", "text", "textarea", "number", "toggle", "file"];

const list = await (await fetch(`${BASE}/api/admin/templates`, { headers: H })).json();
const ids = list.templates.map((t) => t.id).filter((id) => id.startsWith("old-"));

let fixed = 0;
for (const id of ids) {
  const { template: t } = await (await fetch(`${BASE}/api/admin/templates/${id}`, { headers: H })).json();
  let input;
  try { input = JSON.parse(t.input_json || "{}"); } catch { continue; }
  const fields = (() => { try { return JSON.parse(t.fields_json || "[]"); } catch { return []; } })();
  const haveKey = new Set(fields.map((f) => f.key));
  let changed = false;

  const addField = (key, def) => {
    if (haveKey.has(key)) return;
    haveKey.add(key);
    const opts = def.options
      ? def.options.map((o) => (typeof o === "string" ? { value: o, label: o } : o))
      : undefined;
    const field = { key, type: def.type || "text", label: def.label || key, required: !!def.required };
    if (def.description || def.help) field.help = (def.description || def.help).slice(0, 140);
    if (opts) { field.options = opts; field.default = opts[0]?.value; }
    fields.push(field);
  };

  for (const [k, v] of Object.entries(input)) {
    // (1) raw legacy placeholder string
    if (typeof v === "string") {
      const m = v.match(/^\{\{([a-zA-Z]\w*)\|(.*)\}\}$/s);
      if (m && FIELD_TYPES.includes(m[1])) {
        const [label = k, desc = "", optsRaw = ""] = m[2].split("|");
        addField(k, {
          type: m[1],
          label,
          description: desc,
          options: m[1] === "select" && optsRaw ? optsRaw.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
        });
        input[k] = `{{${k}}}`;
        changed = true;
      }
      continue;
    }
    // (2) embedded field-object
    if (v && typeof v === "object" && !Array.isArray(v) && FIELD_TYPES.includes(v.type)) {
      addField(k, v);
      input[k] = `{{${k}}}`;
      changed = true;
    }
  }

  // (3) nano-banana-pro wants an array for image_input
  if (/nano-banana-pro/.test(t.model || "") && typeof input.image_input === "string") {
    input.image_input = [input.image_input];
    changed = true;
  }

  if (!changed) continue;
  const body = { ...t, input_json: JSON.stringify(input), fields_json: JSON.stringify(fields) };
  const r = await fetch(`${BASE}/api/admin/templates`, { method: "POST", headers: H, body: JSON.stringify(body) });
  console.log(`${r.ok ? "✓" : "✗"} ${id}${r.ok ? "" : " — " + (await r.text())}`);
  if (r.ok) fixed++;
}
console.log(`\nRepaired ${fixed} template(s).`);
