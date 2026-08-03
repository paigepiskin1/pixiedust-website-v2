#!/usr/bin/env node
// Persist keep_outfit checkbox + optional outfit fields onto every shoot template.
// Usage: node scripts/dev.mjs node scripts/patch-shoot-keep-outfit.mjs
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const DB_ID = process.env.CF_D1_DATABASE_ID || "105e2276-0d51-430a-8c6f-b4f7ee699aaf";
const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID || "15149dc8d99998b6c96a67c2cf52ad7c";
const CF_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
if (!CF_TOKEN) {
  console.error("Missing CLOUDFLARE_API_TOKEN");
  process.exit(1);
}

const UPLOAD_VALUE =
  ", wearing the exact outfit shown in the uploaded outfit reference image. Match that outfit closely";

async function d1(sql) {
  const r = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/d1/database/${DB_ID}/query`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${CF_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ sql }),
    }
  );
  const d = await r.json();
  if (!d.success) throw new Error(JSON.stringify(d.errors));
  return d.result?.[0]?.results ?? [];
}

function ensure(fields) {
  const next = Array.isArray(fields)
    ? fields.map((f) => ({ ...f, options: f.options ? f.options.map((o) => ({ ...o })) : f.options }))
    : [];
  const lookIdx = next.findIndex((f) => f.key === "look" && f.type === "select");
  const outfitIdx = next.findIndex((f) => f.key === "outfit" && f.type === "file");
  const keepIdx = next.findIndex((f) => f.key === "keep_outfit");

  if (lookIdx >= 0) {
    const look = next[lookIdx];
    const opts = [...(look.options ?? [])];
    const hasUpload = opts.some((o) => /upload/i.test(o.label ?? "") || /uploaded outfit/i.test(o.value ?? ""));
    if (!hasUpload) opts.push({ value: UPLOAD_VALUE, label: "Upload my own outfit" });
    next[lookIdx] = {
      ...look,
      options: opts,
      help: look.help || "Keep your clothes, pick a styled look, or upload your own outfit photo.",
      hideWhen: { field: "keep_outfit", truthy: true },
    };
    const gated = {
      key: "outfit",
      type: "file",
      label: "Outfit photo(s)",
      required: false,
      multiple: true,
      max: 4,
      accept: "image/*",
      help: "Flat lays or outfit photos — required when you pick Upload my own outfit.",
      showWhen: { field: "look", includes: "uploaded outfit" },
      hideWhen: { field: "keep_outfit", truthy: true },
    };
    if (outfitIdx >= 0) {
      const cur = next[outfitIdx];
      next[outfitIdx] = {
        ...cur,
        ...gated,
        label: cur.label || gated.label,
        help: cur.help || gated.help,
        required: false,
        multiple: true,
        max: Math.max(4, Number(cur.max) || 4),
        accept: cur.accept || "image/*",
        showWhen: gated.showWhen,
        hideWhen: gated.hideWhen,
      };
    } else next.push(gated);
  } else if (outfitIdx >= 0) {
    const cur = next[outfitIdx];
    next[outfitIdx] = {
      ...cur,
      required: false,
      multiple: true,
      max: Math.max(4, Number(cur.max) || 4),
      accept: cur.accept || "image/*",
      label: cur.label || "Change outfit (optional)",
      help: cur.help || "Optional — upload flat lays or outfit photos to wear instead of what's in your photos.",
      hideWhen: { field: "keep_outfit", truthy: true },
    };
    delete next[outfitIdx].showWhen;
  } else {
    next.push({
      key: "outfit",
      type: "file",
      label: "Change outfit (optional)",
      required: false,
      multiple: true,
      max: 4,
      accept: "image/*",
      help: "Optional — upload flat lays or outfit photos to wear instead of what's in your photos.",
      hideWhen: { field: "keep_outfit", truthy: true },
    });
  }

  const keepField = {
    key: "keep_outfit",
    type: "toggle",
    label: "Keep my original outfit",
    required: false,
    default: false,
    help: "Use the clothes in your photos — skip the template outfit and any uploads.",
  };
  if (keepIdx < 0) {
    const filesIdx = next.findIndex((f) => f.key === "files" || f.key === "person" || f.type === "file");
    next.splice(filesIdx >= 0 ? filesIdx + 1 : 0, 0, keepField);
  } else {
    next[keepIdx] = { ...keepField, ...next[keepIdx], type: "toggle", label: next[keepIdx].label || keepField.label };
  }
  return next;
}

const rows = await d1("SELECT id, title, fields_json FROM templates WHERE kind = 'shoot'");
console.log(`Patching ${rows.length} shoot templates…`);
const sqlLines = [];
let changed = 0;
for (const row of rows) {
  let fields;
  try {
    fields = JSON.parse(row.fields_json || "[]");
  } catch {
    console.log("skip", row.id);
    continue;
  }
  const next = ensure(fields);
  if (JSON.stringify(fields) === JSON.stringify(next)) {
    console.log("=", row.id);
    continue;
  }
  changed++;
  console.log("✓", row.id);
  const esc = JSON.stringify(next).replace(/'/g, "''");
  sqlLines.push(
    `UPDATE templates SET fields_json = '${esc}', updated_at = datetime('now') WHERE id = '${String(row.id).replace(/'/g, "''")}';`
  );
}
writeFileSync("/tmp/patch-keep-outfit.sql", sqlLines.join("\n") + "\n");
console.log(`${changed} to update`);
if (!changed) process.exit(0);

if (existsSync(".dev.vars")) {
  for (const line of readFileSync(".dev.vars", "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 1) continue;
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
}
const r = spawnSync(
  "npx",
  ["wrangler", "d1", "execute", "pixiedust", "--remote", "--file", "/tmp/patch-keep-outfit.sql"],
  { env: process.env, stdio: "inherit", shell: true }
);
process.exit(r.status ?? 1);
