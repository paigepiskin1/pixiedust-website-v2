import type { D1Database } from "@cloudflare/workers-types";
import { allFields, getTemplate, type Template } from "./templates";

/** Saved at generation time — original form values + workspace controls. */
export interface StoredUserInputs {
  inputs: Record<string, unknown>;
  aspect?: string;
  duration?: number;
  quality?: string;
}

export interface ReusePayload {
  templateId: string | null;
  /** Where to send the user to edit inputs before generating. */
  href: string;
  inputs: Record<string, unknown>;
  aspect?: string;
  duration?: number;
  quality?: string;
}

const PROMPT_KEYS = ["prompt", "caption", "text", "motion", "style"];
const IMAGE_KEYS = [
  "image_input",
  "images",
  "input_images",
  "image",
  "photo",
  "person",
  "file",
  "files",
  "first_frame_image",
  "start_image",
  "target_image",
  "character_image",
  "reference",
];

function parseJson<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

function isUrl(v: unknown): v is string {
  return typeof v === "string" && /^https?:\/\//.test(v);
}

function isUrlList(v: unknown): v is string[] {
  return Array.isArray(v) && v.length > 0 && v.every(isUrl);
}

/** Map a template id to the page where the user edits inputs. */
export function reuseHref(templateId: string | null): string {
  if (!templateId) return "/";
  if (/^beauty-studio/i.test(templateId)) return "/beauty";
  if (/^hair-studio/i.test(templateId)) return "/hair";
  if (/^(avatar-studio|tattoo-studio)/i.test(templateId)) return "/avatar";
  return `/studio/${templateId}`;
}

/** Best-effort reverse map from resolved provider payload → form field keys. */
export function extractInputsFromResolved(
  template: Template,
  resolved: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const fields = allFields(template);

  for (const f of fields) {
    if (f.type === "file") {
      const direct = resolved[f.key];
      if (isUrl(direct) || isUrlList(direct)) {
        out[f.key] = direct;
        continue;
      }
      for (const k of [f.key, ...IMAGE_KEYS]) {
        const v = resolved[k];
        if (isUrl(v) || isUrlList(v)) {
          out[f.key] = f.multiple && isUrl(v) ? [v] : v;
          break;
        }
      }
      continue;
    }

    const direct = resolved[f.key];
    if (direct != null && direct !== "") {
      out[f.key] = direct;
      continue;
    }

    if (f.key === "prompt" || f.type === "textarea") {
      for (const k of PROMPT_KEYS) {
        const v = resolved[k];
        if (typeof v === "string" && v.trim()) {
          out[f.key] = v;
          break;
        }
      }
    }
  }

  return out;
}

interface GenerationRow {
  id: string;
  template_id: string | null;
  input_json: string;
  chain_json: string | null;
  user_inputs_json: string | null;
  quality: string | null;
}

export async function getReusePayload(db: D1Database, genId: string, userId: number): Promise<ReusePayload | null> {
  const row = await db
    .prepare(
      `SELECT id, template_id, input_json, chain_json, user_inputs_json, quality
       FROM generations WHERE id = ? AND user_id = ?`
    )
    .bind(genId, userId)
    .first<GenerationRow>();
  if (!row) return null;

  const stored = parseJson<StoredUserInputs | null>(row.user_inputs_json, null);
  if (stored?.inputs && Object.keys(stored.inputs).length) {
    return {
      templateId: row.template_id,
      href: reuseHref(row.template_id),
      inputs: stored.inputs,
      aspect: stored.aspect,
      duration: stored.duration,
      quality: stored.quality ?? row.quality ?? undefined,
    };
  }

  const chain = parseJson<{ userInputs?: Record<string, unknown> } | null>(row.chain_json, null);
  if (chain?.userInputs && Object.keys(chain.userInputs).length) {
    const { aspect, duration, quantity, ...inputs } = chain.userInputs;
    return {
      templateId: row.template_id,
      href: reuseHref(row.template_id),
      inputs,
      aspect: typeof aspect === "string" ? aspect : undefined,
      duration: typeof duration === "number" ? duration : Number(duration) || undefined,
      quality: row.quality ?? undefined,
    };
  }

  const resolved = parseJson<Record<string, unknown>>(row.input_json, {});
  const template = row.template_id ? await getTemplate(db, row.template_id) : null;
  const inputs = template ? extractInputsFromResolved(template, resolved) : legacyExtract(resolved);

  return {
    templateId: row.template_id,
    href: reuseHref(row.template_id),
    inputs,
    quality: row.quality ?? undefined,
  };
}

/** Fallback when template was deleted or mapping failed. */
function legacyExtract(resolved: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of PROMPT_KEYS) {
    if (typeof resolved[k] === "string" && resolved[k]) {
      out.prompt = resolved[k];
      break;
    }
  }
  for (const k of IMAGE_KEYS) {
    const v = resolved[k];
    if (isUrl(v)) {
      out.file = v;
      break;
    }
    if (isUrlList(v)) {
      out.files = v;
      break;
    }
  }
  return out;
}
