// Template data-access + the resolve/cost logic that turns an admin-defined
// template + user inputs into a provider payload for SyncNode.
import type { D1Database } from "@cloudflare/workers-types";
import type { Tone } from "./content";

export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "select"
  | "file"
  | "url"
  | "email"
  | "password"
  | "model"
  | "toggle";

export interface TemplateField {
  key: string;
  type: FieldType;
  label: string;
  help?: string;
  required?: boolean;
  default?: string | number | boolean;
  options?: {
    value: string;
    label: string;
    /** Optional preview card image in the studio UI. */
    image?: string;
    /** Optional backend reference image appended to model image inputs when selected. */
    ref?: string;
  }[];
  min?: number;
  max?: number;
  step?: number;
  accept?: string;
  placeholder?: string;
  multiple?: boolean;
  /** For select fields: "buttons" (default) or "dropdown". For file fields: "square" = compact square upload tile (used in side-by-side You/Friend pairs). */
  ui?: "buttons" | "dropdown" | "square";
  /** Optionally show this field only when another field's value matches. */
  showWhen?: { field: string; includes?: string; equals?: string };
  /** Optionally hide this field when another field is truthy (e.g. keep_outfit). */
  hideWhen?: { field: string; truthy?: boolean };
}

export interface TemplateStep {
  id: string;
  title: string;
  subtitle?: string;
  fields: TemplateField[];
  // Chain steps run their own model; input may reference {{stepId.output}}.
  provider?: string;
  model?: string;
  input?: Record<string, unknown>;
}

/** A template is a chained pipeline when every step declares its own model. */
export function isChain(t: Template): boolean {
  return !!t.steps && t.steps.length > 0 && t.steps.every((s) => !!s.model);
}

export interface Template {
  id: string;
  title: string;
  kind: string;
  type: "image" | "video";
  category: string | null;
  provider: string;
  model: string;
  input: Record<string, unknown>;
  fields: TemplateField[];
  steps: TemplateStep[] | null;
  creditCost: number;
  pricePerSecond: number | null;
  durations: number[] | null;
  quality: Record<string, number> | null;
  aspects: string[] | null;
  quantities: number[] | null;
  engine: string | null;
  eta: string | null;
  tags: string[];
  tone: Tone;
  accent: string | null;
  meta: string | null;
  subtitle: string | null;
  description: string | null;
  previewImage: string | null;
  previewVideo: string | null;
  isFeatured: boolean;
  isHidden: boolean;
  isAdminOnly: boolean;
  isAdult: boolean;
  sortOrder: number;
}

interface TemplateRow {
  id: string; title: string; kind: string; type: string; category: string | null;
  provider: string; model: string; input_json: string; fields_json: string; steps_json: string | null;
  credit_cost: number; price_per_second: number | null; durations_json: string | null; quality_json: string | null; aspects_json: string | null; quantities_json: string | null;
  engine: string | null; eta: string | null; tags_json: string; tone: string; accent: string | null;
  meta: string | null; subtitle: string | null; description: string | null;
  preview_image: string | null; preview_video: string | null;
  is_featured: number; is_hidden: number; is_admin_only: number; is_adult: number; sort_order: number;
}

function parse<T>(s: string | null, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

export function rowToTemplate(r: TemplateRow): Template {
  return {
    id: r.id,
    title: r.title,
    kind: r.kind,
    type: (r.type as Template["type"]) || "image",
    category: r.category,
    provider: r.provider,
    model: r.model,
    input: parse<Record<string, unknown>>(r.input_json, {}),
    fields: parse<TemplateField[]>(r.fields_json, []),
    steps: r.steps_json ? parse<TemplateStep[]>(r.steps_json, []) : null,
    creditCost: r.credit_cost,
    pricePerSecond: r.price_per_second ?? null,
    durations: r.durations_json ? parse<number[]>(r.durations_json, []) : null,
    quality: r.quality_json ? parse<Record<string, number>>(r.quality_json, {}) : null,
    aspects: r.aspects_json ? parse<string[]>(r.aspects_json, []) : null,
    quantities: r.quantities_json ? parse<number[]>(r.quantities_json, []) : null,
    engine: r.engine,
    eta: r.eta,
    tags: parse<string[]>(r.tags_json, []),
    tone: (r.tone as Tone) || "lilac",
    accent: r.accent,
    meta: r.meta,
    subtitle: r.subtitle,
    description: r.description,
    previewImage: r.preview_image,
    previewVideo: r.preview_video,
    isFeatured: r.is_featured === 1,
    isHidden: r.is_hidden === 1,
    isAdminOnly: r.is_admin_only === 1,
    isAdult: r.is_adult === 1,
    sortOrder: r.sort_order,
  };
}

export interface ListOpts {
  kind?: string;
  kinds?: string[];
  category?: string;
  featured?: boolean;
  includeHidden?: boolean;
  isAdmin?: boolean;
  limit?: number;
}

export async function listTemplates(db: D1Database, opts: ListOpts = {}): Promise<Template[]> {
  const where: string[] = [];
  const binds: unknown[] = [];
  if (!opts.includeHidden) where.push("is_hidden = 0");
  if (!opts.isAdmin) where.push("is_admin_only = 0");
  if (opts.kind) {
    where.push("kind = ?");
    binds.push(opts.kind);
  }
  if (opts.kinds && opts.kinds.length) {
    where.push(`kind IN (${opts.kinds.map(() => "?").join(",")})`);
    binds.push(...opts.kinds);
  }
  if (opts.category && opts.category !== "All") {
    where.push("category = ?");
    binds.push(opts.category);
  }
  if (opts.featured) where.push("is_featured = 1");
  const sql =
    "SELECT * FROM templates" +
    (where.length ? " WHERE " + where.join(" AND ") : "") +
    " ORDER BY sort_order ASC, title ASC" +
    (opts.limit ? " LIMIT " + Math.max(1, Math.floor(opts.limit)) : "");
  const { results } = await db.prepare(sql).bind(...binds).all<TemplateRow>();
  return (results || []).map(rowToTemplate);
}

/** Free-text search across visible templates (title, subtitle, category, tags). */
export async function searchTemplates(db: D1Database, q: string, limit = 60): Promise<Template[]> {
  const term = `%${q.trim().toLowerCase()}%`;
  const sql =
    "SELECT * FROM templates WHERE is_hidden = 0 AND is_admin_only = 0 AND (" +
    "lower(title) LIKE ? OR lower(coalesce(subtitle,'')) LIKE ? OR lower(coalesce(category,'')) LIKE ? " +
    "OR lower(coalesce(tags_json,'')) LIKE ? OR lower(coalesce(description,'')) LIKE ?) " +
    "ORDER BY is_featured DESC, sort_order ASC, title ASC LIMIT " + Math.max(1, Math.floor(limit));
  const { results } = await db.prepare(sql).bind(term, term, term, term, term).all<TemplateRow>();
  return (results || []).map(rowToTemplate);
}

export async function getTemplate(db: D1Database, id: string): Promise<Template | null> {
  const row = await db.prepare("SELECT * FROM templates WHERE id = ?").bind(id).first<TemplateRow>();
  return row ? rowToTemplate(row) : null;
}

/** All fields across single-step or multi-step templates, by key. */
export function allFields(t: Template): TemplateField[] {
  // User-facing fields live at the top level (fields_json). Older chain
  // templates also carried per-step `fields`; merge those in (deduped) and
  // ignore steps that have none (the current chain builder omits step fields).
  const out: TemplateField[] = [...(t.fields ?? [])];
  if (t.steps) for (const s of t.steps) if (Array.isArray(s.fields)) out.push(...s.fields);
  const seen = new Set<string>();
  return out.filter((f) => f && f.key && !seen.has(f.key) && (seen.add(f.key), true));
}

export interface ResolveResult {
  input: Record<string, unknown>;
  errors: string[];
}

/** Merge user inputs into the template's {{key}} placeholders + validate. */
export function resolveInput(t: Template, inputs: Record<string, unknown>): ResolveResult {
  const fields = allFields(t);
  const byKey = new Map(fields.map((f) => [f.key, f]));
  const errors: string[] = [];

  for (const f of fields) {
    if (f.required) {
      const v = inputs[f.key];
      if (v === undefined || v === null || v === "") errors.push(`${f.label} is required`);
    }
  }

  const TOKEN = /\{\{(\w+)\*?\}\}/g;
  const subst = (v: unknown): unknown => {
    if (typeof v === "string") {
      const exact = v.match(/^\{\{(\w+)\*?\}\}$/);
      if (exact) {
        const f = byKey.get(exact[1]);
        const val = inputs[exact[1]];
        const resolved = val ?? f?.default ?? "";
        if (f?.type === "number") return Number(resolved);
        if (f?.type === "toggle") return Boolean(resolved);
        return resolved;
      }
      return v.replace(TOKEN, (_, key) => {
        const val = inputs[key];
        return val != null ? String(val) : String(byKey.get(key)?.default ?? "");
      });
    }
    // Flatten one level so ["{{files*}}", "https://…"] becomes a flat URL list
    // (image models expect string[] — not nested arrays from multi-file fields).
    if (Array.isArray(v)) {
      return v.flatMap((item) => {
        const r = subst(item);
        return Array.isArray(r) ? r : [r];
      });
    }
    if (v && typeof v === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) out[k] = subst(val);
      return out;
    }
    return v;
  };

  return { input: subst(t.input) as Record<string, unknown>, errors };
}

function imageInputKey(input: Record<string, unknown>): "input_images" | "image_input" | null {
  if ("input_images" in input) return "input_images";
  if ("image_input" in input) return "image_input";
  return null;
}

function cleanImageUrls(cur: unknown): string[] {
  return (Array.isArray(cur) ? cur : cur ? [cur] : [])
    .flatMap((x) => (Array.isArray(x) ? x : [x]))
    .filter((x): x is string => typeof x === "string" && /^https?:\/\//i.test(x));
}

export const UPLOAD_OUTFIT_LOOK_VALUE =
  ", wearing the exact outfit shown in the uploaded outfit reference image. Match that outfit closely";

const OPTIONAL_OUTFIT_FIELD: TemplateField = {
  key: "outfit",
  type: "file",
  label: "Change outfit (optional)",
  required: false,
  multiple: true,
  max: 4,
  accept: "image/*",
  help: "Optional — upload flat lays or outfit photos to wear instead of what's in your photos.",
};

const KEEP_OUTFIT_FIELD: TemplateField = {
  key: "keep_outfit",
  type: "toggle",
  label: "Keep my original outfit",
  required: false,
  default: false,
  help: "Use the clothes in your photos — skip the template outfit and any uploads.",
};

/** Collect uploaded outfit CDN URLs (single string or multi-file array). */
export function collectOutfitUrls(inputs: Record<string, unknown>): string[] {
  const v = inputs.outfit;
  if (Array.isArray(v)) return cleanImageUrls(v);
  if (typeof v === "string" && /^https?:\/\//i.test(v)) return [v];
  return [];
}

/** True when the user checked "Keep my original outfit". */
export function isKeepOriginalOutfit(inputs: Record<string, unknown>): boolean {
  const v = inputs.keep_outfit;
  return v === true || v === "true" || v === 1 || v === "1" || v === "on";
}

/** True when the selected look asks the user to upload their own outfit photo,
 *  or when an always-optional outfit field has files (no gated look select). */
export function isUploadLook(t: Template, inputs: Record<string, unknown>): boolean {
  if (isKeepOriginalOutfit(inputs)) return false;
  const urls = collectOutfitUrls(inputs);
  const lookField = allFields(t).find((f) => f.key === "look" && f.type === "select");
  if (!lookField?.options?.length) return urls.length > 0;

  const selected = String(inputs.look ?? lookField.default ?? "");
  if (/uploaded outfit/i.test(selected)) return true;
  const opt = lookField.options.find((o) => o.value === selected);
  if (/upload/i.test(opt?.label ?? "")) return true;
  // Look select without an Upload option: treat optional outfit files as upload.
  const hasUploadOpt = lookField.options.some(
    (o) => /upload/i.test(o.label ?? "") || /uploaded outfit/i.test(o.value ?? "")
  );
  return !hasUploadOpt && urls.length > 0;
}

/**
 * Ensure every photoshoot template exposes:
 * - "Keep my original outfit" checkbox
 * - optional outfit upload (or Upload option on existing look selects)
 */
export function ensureOptionalOutfitUpload(t: Template): Template {
  if (t.kind !== "shoot") return t;
  const fields: TemplateField[] = (t.fields ?? []).map((f) => ({
    ...f,
    options: f.options ? f.options.map((o) => ({ ...o })) : undefined,
  }));
  const lookIdx = fields.findIndex((f) => f.key === "look" && f.type === "select");
  const outfitIdx = fields.findIndex((f) => f.key === "outfit" && f.type === "file");
  const keepIdx = fields.findIndex((f) => f.key === "keep_outfit");

  if (lookIdx >= 0) {
    const look = fields[lookIdx];
    const opts = [...(look.options ?? [])];
    const hasUpload = opts.some((o) => /upload/i.test(o.label ?? "") || /uploaded outfit/i.test(o.value ?? ""));
    if (!hasUpload) {
      opts.push({ value: UPLOAD_OUTFIT_LOOK_VALUE, label: "Upload my own outfit" });
      fields[lookIdx] = {
        ...look,
        options: opts,
        help: look.help || "Keep your clothes, pick a styled look, or upload your own outfit photo.",
      };
    }
    fields[lookIdx] = {
      ...fields[lookIdx],
      hideWhen: { field: "keep_outfit", truthy: true },
    };
    const gated: TemplateField = {
      ...OPTIONAL_OUTFIT_FIELD,
      label: "Outfit photo(s)",
      help: "Flat lays or outfit photos — required when you pick Upload my own outfit.",
      showWhen: { field: "look", includes: "uploaded outfit" },
      hideWhen: { field: "keep_outfit", truthy: true },
    };
    if (outfitIdx >= 0) {
      const cur = fields[outfitIdx];
      fields[outfitIdx] = {
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
    } else {
      fields.push(gated);
    }
  } else if (outfitIdx >= 0) {
    const cur = fields[outfitIdx];
    fields[outfitIdx] = {
      ...cur,
      required: false,
      multiple: true,
      max: Math.max(4, Number(cur.max) || 4),
      accept: cur.accept || "image/*",
      label: cur.label || OPTIONAL_OUTFIT_FIELD.label,
      help: cur.help || OPTIONAL_OUTFIT_FIELD.help,
      showWhen: undefined,
      hideWhen: { field: "keep_outfit", truthy: true },
    };
  } else {
    fields.push({ ...OPTIONAL_OUTFIT_FIELD, hideWhen: { field: "keep_outfit", truthy: true } });
  }

  if (keepIdx < 0) {
    // Insert keep checkbox after the primary photo upload(s) — prefer after
    // "friend" so With Friends You/Friend squares stay adjacent.
    const friendIdx = fields.findIndex((f) => f.key === "friend" && f.type === "file");
    const personIdx = fields.findIndex((f) => f.key === "person" && f.type === "file");
    const filesIdx = fields.findIndex((f) => f.key === "files" || f.type === "file");
    const anchor = friendIdx >= 0 ? friendIdx : personIdx >= 0 ? personIdx : filesIdx;
    const insertAt = anchor >= 0 ? anchor + 1 : 0;
    fields.splice(insertAt, 0, { ...KEEP_OUTFIT_FIELD });
  } else {
    fields[keepIdx] = {
      ...KEEP_OUTFIT_FIELD,
      ...fields[keepIdx],
      type: "toggle",
      label: fields[keepIdx].label || KEEP_OUTFIT_FIELD.label,
      help: fields[keepIdx].help || KEEP_OUTFIT_FIELD.help,
      default: fields[keepIdx].default ?? false,
    };
  }

  return { ...t, fields };
}

/** Force prompt/look inputs to preserve the subject's original clothes. */
export function applyKeepOriginalOutfitPrompt(prompt: string): string {
  const note =
    " Keep my exact original outfit from the reference photos — do not change my clothes or styling.";
  if (/exact original outfit from the reference/i.test(prompt)) return prompt;
  // Neutralize common "wearing …" clauses so baked-in template outfits don't win.
  let out = prompt.replace(
    /,?\s*wearing (the exact outfit shown in the uploaded outfit reference image\. Match that outfit closely|[^.]{8,220})/gi,
    ", wearing the same outfit as in my reference photos"
  );
  out = out.replace(/\.\s*$/, "") + "." + note;
  return out;
}

/** Inject outfit-match wording into the prompt when upload refs are in play and
 *  the look token did not already supply it. */
export function injectOutfitPromptHint(prompt: string, inputs: Record<string, unknown>): string {
  if (isKeepOriginalOutfit(inputs)) return applyKeepOriginalOutfitPrompt(prompt);
  if (!collectOutfitUrls(inputs).length) return prompt;
  if (/uploaded outfit reference/i.test(prompt)) return prompt;
  const hint = UPLOAD_OUTFIT_LOOK_VALUE;
  if (/\bof me\b/i.test(prompt)) return prompt.replace(/\bof me\b/i, `of me${hint}`);
  return `${prompt}${hint}`;
}

/**
 * Attach look/outfit reference images for the model:
 * - preset male/female options → backend `ref`/`image`
 * - "Upload my own outfit" / optional outfit files → user outfit URL(s)
 * - keep_outfit checkbox → strip outfit refs and force original clothes
 * Also strips empty placeholders from image arrays and hints the prompt.
 */
export function appendSelectedOptionRefs(
  t: Template,
  inputs: Record<string, unknown>,
  input: Record<string, unknown>
): Record<string, unknown> {
  const imageKey = imageInputKey(input);
  if (!imageKey) return input;

  const list = cleanImageUrls(input[imageKey]);
  const outfitUrls = collectOutfitUrls(inputs);
  // Drop stray user outfit URLs if the template inlined {{outfit}} while the
  // user picked keep/original or a preset look — we re-add only for upload.
  const withoutOutfit = outfitUrls.length ? list.filter((u) => !outfitUrls.includes(u)) : list;

  if (isKeepOriginalOutfit(inputs)) {
    let next: Record<string, unknown> = { ...input, [imageKey]: withoutOutfit };
    if (typeof next.prompt === "string") {
      next = { ...next, prompt: applyKeepOriginalOutfitPrompt(next.prompt) };
    }
    return next;
  }

  const lookField = allFields(t).find((f) => f.key === "look" && f.type === "select");
  const selected = String(inputs.look ?? lookField?.default ?? "");
  const opt = lookField?.options?.find((o) => o.value === selected);
  const upload = isUploadLook(t, inputs);

  const out = [...withoutOutfit];
  if (upload) {
    for (const u of outfitUrls) if (!out.includes(u)) out.push(u);
  } else if (selected.trim()) {
    const ref = opt?.ref || opt?.image;
    if (typeof ref === "string" && /^https?:\/\//i.test(ref) && !out.includes(ref)) out.push(ref);
  }

  let next: Record<string, unknown> = { ...input, [imageKey]: out };
  if (upload && typeof next.prompt === "string") {
    next = { ...next, prompt: injectOutfitPromptHint(next.prompt, inputs) };
  }
  return next;
}

/**
 * Server-side cost. Video templates with price_per_second bill per second of
 * duration; otherwise the flat credit_cost. Then x quantity x quality multiplier.
 */
export function computeCost(t: Template, opts: { quality?: string; quantity?: number; duration?: number } = {}): number {
  const qty = Math.max(1, opts.quantity ?? 1);
  const mult = opts.quality && t.quality ? t.quality[opts.quality] ?? 1 : 1;
  const base = t.pricePerSecond && t.pricePerSecond > 0 && opts.duration ? t.pricePerSecond * opts.duration : t.creditCost;
  return Math.ceil(base * qty * mult);
}

/**
 * Fill missing/empty user inputs from each field's `default`. Used so optional
 * prompts can stay blank in the UI while the template still sends a baked-in
 * prompt to the model (works for single-step and multi-step chains).
 */
export function applyFieldDefaults(
  t: Template,
  inputs: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...inputs };
  for (const f of allFields(t)) {
    if (f.default == null || f.default === "") continue;
    const v = out[f.key];
    if (v == null || v === "") out[f.key] = f.default;
  }
  return out;
}

/**
 * Resolve a single chain step's input. Substitutes `{{key}}` from user inputs
 * and `{{stepId.output}}` from prior step outputs. Used by the multi-step pipeline.
 */
export function resolveChainStep(
  inputObj: unknown,
  ctx: { user: Record<string, unknown>; outputs: Record<string, string> }
): unknown {
  const sub = (v: unknown): unknown => {
    if (typeof v === "string") {
      const exact = v.match(/^\{\{([\w.]+)\*?\}\}$/);
      if (exact) {
        const tok = exact[1];
        if (tok.includes(".")) return ctx.outputs[tok.split(".")[0]] ?? "";
        return ctx.user[tok] ?? "";
      }
      return v.replace(/\{\{([\w.]+)\*?\}\}/g, (_, tok: string) => {
        if (tok.includes(".")) return ctx.outputs[tok.split(".")[0]] ?? "";
        const u = ctx.user[tok];
        return u != null ? String(u) : "";
      });
    }
    // Flatten one level: a multi-file placeholder ({{photos*}}) resolves to an
    // array, so an array like ["{{photos*}}", "{{step1.output}}"] becomes a flat
    // list of URLs (what image models expect) instead of a nested array.
    if (Array.isArray(v)) return v.flatMap((item) => { const r = sub(item); return Array.isArray(r) ? r : [r]; });
    if (v && typeof v === "object") {
      const o: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) o[k] = sub(val);
      return o;
    }
    return v;
  };
  return sub(inputObj);
}

/** Workspace URL for a template. */
export function templateHref(id: string): string {
  return `/studio/${id}`;
}

interface CardShape {
  name: string;
  sub?: string;
  tag?: string;
  type?: string;
  meta?: string;
  tone: Tone;
  accent: string;
  cr?: number;
  c?: string;
  href: string;
  previewImage?: string;
  previewVideo?: string;
  previewImages?: string[];
}

/** Parse structured template.meta JSON when present. */
export function parseTemplateMeta(meta: string | null | undefined): Record<string, unknown> | null {
  if (!meta || !/^\s*[[{]/.test(meta)) return null;
  try {
    const p = JSON.parse(meta);
    return p && typeof p === "object" ? (p as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Map a template to the catalog-card shape (uses `tag` for the pill). */
export function templateToCard(t: Template): CardShape {
  const metaObj = parseTemplateMeta(t.meta);
  const fromMeta = Array.isArray(metaObj?.previewImages)
    ? (metaObj!.previewImages as unknown[]).filter((u): u is string => typeof u === "string" && /^https?:\/\//i.test(u))
    : [];
  const previewImages = fromMeta.length ? fromMeta : undefined;
  return {
    name: t.title,
    sub: t.subtitle ?? undefined,
    tag: t.tags[0] ?? undefined,
    // `meta` is a short card label — skip it when it holds structured JSON
    // (e.g. studio howItWorks) so raw JSON never leaks onto a card.
    meta: t.meta && !/^\s*[[{]/.test(t.meta) ? t.meta : undefined,
    tone: t.tone,
    accent: t.accent ?? "var(--pd-lilac)",
    cr: t.creditCost,
    c: t.category ?? undefined,
    href: templateHref(t.id),
    previewImage: previewImages?.[0] ?? t.previewImage ?? undefined,
    previewVideo: t.previewVideo ?? undefined,
    previewImages,
  };
}

/** Map a template to the home-rail card shape (uses `type` for the pill). */
export function templateToRail(t: Template): CardShape {
  return { ...templateToCard(t), type: t.tags[0] ?? t.kind };
}
