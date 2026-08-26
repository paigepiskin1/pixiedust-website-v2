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
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  step?: number;
  accept?: string;
  placeholder?: string;
  multiple?: boolean;
  /** For select fields: "buttons" (default) or "dropdown". */
  ui?: "buttons" | "dropdown";
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
  const t: Template = {
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
  return expandOmniReferenceAccept(t);
}

/** True for Seedance Omni / multimodal reference-to-video templates. */
export function isOmniReferenceTemplate(t: Pick<Template, "id" | "title" | "model" | "input" | "meta" | "fields">): boolean {
  const hay = `${t.id} ${t.title} ${t.model} ${t.meta ?? ""}`.toLowerCase();
  if (/omni|seedance-?2|reference-?to-?video|reference_to_video/.test(hay)) return true;
  const inputStr = JSON.stringify(t.input ?? {}).toLowerCase();
  if (/audio_url|video_url|image_url|input_audios|input_videos|reference_audio|reference_video/.test(inputStr)) return true;
  return (t.fields ?? []).some((f) => /omni|reference/i.test(`${f.key} ${f.label}`) && f.type === "file");
}

const OMNI_ACCEPT = "image/*,video/*,audio/*";

/** Ensure Omni reference file fields accept image + video + audio. */
export function expandOmniReferenceAccept(t: Template): Template {
  if (!isOmniReferenceTemplate(t)) return t;
  const fields = (t.fields ?? []).map((f) => {
    if (f.type !== "file") return f;
    const keyLabel = `${f.key} ${f.label}`.toLowerCase();
    const isRef =
      /omni|reference|refs?|files?|images?|videos?|audios?|media/.test(keyLabel) ||
      !f.accept ||
      f.accept === "image/*";
    if (!isRef) return f;
    const accept = f.accept && f.accept.includes("audio") && f.accept.includes("video")
      ? f.accept
      : OMNI_ACCEPT;
    const help =
      f.help ||
      "Upload images, videos, or audio as Omni references (cite them in your prompt as @Image1, @Video1, @Audio1).";
    return { ...f, accept, help, multiple: f.multiple ?? true, max: f.max ?? 9 };
  });
  return { ...t, fields };
}

export type MediaKind = "image" | "video" | "audio" | "unknown";

export function classifyMediaUrl(url: string): MediaKind {
  const path = String(url || "").toLowerCase().split("?")[0];
  if (/\.(mp3|wav|m4a|aac|ogg|flac)$/.test(path)) return "audio";
  if (/\.(mp4|mov|webm|m4v)$/.test(path)) return "video";
  if (/\.(png|jpe?g|webp|gif|heic|avif)$/.test(path)) return "image";
  return "unknown";
}

/**
 * For Omni templates: split mixed reference uploads into image/video/audio
 * URL lists so {{image_urls}} / {{video_urls}} / {{audio_urls}} (and common
 * aliases) resolve correctly even when the user uploaded into one field.
 */
export function expandOmniMediaInputs(
  t: Template,
  inputs: Record<string, unknown>
): Record<string, unknown> {
  if (!isOmniReferenceTemplate(t)) return inputs;
  const out: Record<string, unknown> = { ...inputs };
  const collected: string[] = [];
  const take = (v: unknown) => {
    if (typeof v === "string" && /^https?:\/\//.test(v)) collected.push(v);
    else if (Array.isArray(v)) for (const x of v) if (typeof x === "string" && /^https?:\/\//.test(x)) collected.push(x);
  };
  for (const f of allFields(t)) {
    if (f.type === "file") take(out[f.key]);
  }
  // Also gather any already-split lists
  for (const k of ["image_urls", "video_urls", "audio_urls", "images", "videos", "audios", "input_images", "input_videos", "input_audios", "files", "references", "reference"]) {
    take(out[k]);
  }
  const uniq = [...new Set(collected)];
  const images: string[] = [];
  const videos: string[] = [];
  const audios: string[] = [];
  for (const u of uniq) {
    const kind = classifyMediaUrl(u);
    if (kind === "video") videos.push(u);
    else if (kind === "audio") audios.push(u);
    else images.push(u); // unknown → treat as image URL (most common)
  }
  if (images.length) {
    out.image_urls = images;
    out.images = images;
    out.input_images = images;
  }
  if (videos.length) {
    out.video_urls = videos;
    out.videos = videos;
    out.input_videos = videos;
  }
  if (audios.length) {
    out.audio_urls = audios;
    out.audios = audios;
    out.input_audios = audios;
  }
  return out;
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
    if (Array.isArray(v)) return v.map(subst);
    if (v && typeof v === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) out[k] = subst(val);
      return out;
    }
    return v;
  };

  return { input: subst(t.input) as Record<string, unknown>, errors };
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
}

/** Map a template to the catalog-card shape (uses `tag` for the pill). */
export function templateToCard(t: Template): CardShape {
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
    previewImage: t.previewImage ?? undefined,
    previewVideo: t.previewVideo ?? undefined,
  };
}

/** Map a template to the home-rail card shape (uses `type` for the pill). */
export function templateToRail(t: Template): CardShape {
  return { ...templateToCard(t), type: t.tags[0] ?? t.kind };
}
