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
  is_featured: number; is_hidden: number; is_adult: number; sort_order: number;
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
  limit?: number;
}

export async function listTemplates(db: D1Database, opts: ListOpts = {}): Promise<Template[]> {
  const where: string[] = [];
  const binds: unknown[] = [];
  if (!opts.includeHidden) where.push("is_hidden = 0");
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
    "SELECT * FROM templates WHERE is_hidden = 0 AND (" +
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
  return t.steps ? t.steps.flatMap((s) => s.fields) : t.fields;
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
    if (Array.isArray(v)) return v.map(sub);
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
    meta: t.meta ?? undefined,
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
