#!/usr/bin/env node
// Persist optional outfit-upload fields onto every photoshoot template in remote D1.
// Mirrors src/lib/templates.ts ensureOptionalOutfitUpload.
// Usage: node scripts/dev.mjs node scripts/patch-shoot-optional-outfit.mjs
import { readFileSync, existsSync, writeFileSync } from "node:fs";

const DB_ID = process.env.CF_D1_DATABASE_ID || "105e2276-0d51-430a-8c6f-b4f7ee699aaf";
const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID || "15149dc8d99998b6c96a67c2cf52ad7c";
const CF_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
if (!CF_TOKEN) {
  console.error("Missing CLOUDFLARE_API_TOKEN");
  process.exit(1);
}

const UPLOAD_VALUE =
  ", wearing the exact outfit shown in the uploaded outfit reference image. Match that outfit closely";

async function d1(sql, params) {
  const body = params ? { sql, params } : { sql };
  const r = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/d1/database/${DB_ID}/query`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${CF_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  const d = await r.json();
  if (!d.success) throw new Error(JSON.stringify(d.errors));
  return d.result?.[0]?.results ?? [];
}

function ensure(fields) {
  const next = Array.isArray(fields) ? fields.map((f) => ({ ...f, options: f.options ? f.options.map((o) => ({ ...o })) : f.options })) : [];
  const lookIdx = next.findIndex((f) => f.key === "look" && f.type === "select");
  const outfitIdx = next.findIndex((f) => f.key === "outfit" && f.type === "file");

  if (lookIdx >= 0) {
    const look = next[lookIdx];
    const opts = [...(look.options ?? [])];
    const hasUpload = opts.some((o) => /upload/i.test(o.label ?? "") || /uploaded outfit/i.test(o.value ?? ""));
    if (!hasUpload) {
      opts.push({ value: UPLOAD_VALUE, label: "Upload my own outfit" });
      next[lookIdx] = {
        ...look,
        options: opts,
        help: look.help || "Keep your clothes, pick a styled look, or upload your own outfit photo.",
      };
    }
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
    });
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
    console.log("skip bad json", row.id);
    continue;
  }
  const next = ensure(fields);
  const before = JSON.stringify(fields);
  const after = JSON.stringify(next);
  if (before === after) {
    console.log("= ", row.id);
    continue;
  }
  changed++;
  console.log("✓ ", row.id, row.title);
  const esc = after.replace(/'/g, "''");
  sqlLines.push(
    `UPDATE templates SET fields_json = '${esc}', updated_at = datetime('now') WHERE id = '${row.id.replace(/'/g, "''")}';`
  );
}

writeFileSync("/tmp/patch-shoot-outfit.sql", sqlLines.join("\n") + "\n");
console.log(`\n${changed} templates to update. Applying…`);

if (!changed) process.exit(0);

// Apply via wrangler file (handles large SQL better than one giant REST call)
import { spawnSync } from "node:child_process";
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
  ["wrangler", "d1", "execute", "pixiedust", "--remote", "--file", "/tmp/patch-shoot-outfit.sql"],
  { env: process.env, stdio: "inherit", shell: true }
);
process.exit(r.status ?? 1);
