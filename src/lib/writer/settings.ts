// AI Writer settings: which models run each stage, spending limits, approved
// source domains and the image look. Stored as one JSON value in app_settings
// so an admin can change providers without a deploy. Every read is merged over
// DEFAULTS, so a setting added later has a value on databases saved before it.
import type { D1Database } from "@cloudflare/workers-types";
import { getSetting, setSetting } from "../app-settings";

const KEY = "ai_writer_settings";

export interface ChatStageConfig {
  /** OpenRouter model id, called through SyncNode /chat-completion. */
  model: string;
  /** Reasoning effort passed to OpenRouter (low | medium | high). */
  effort: "low" | "medium" | "high";
  maxTokens: number;
}

export interface WriterSettings {
  write: ChatStageConfig;
  audit: ChatStageConfig;
  links: ChatStageConfig;
  /** Rewrite once when the audit finds unsupported claims or style problems. */
  autoRevise: boolean;
  image: {
    /** SyncNode route: replicate (/generate) or fal (/fal/generate). */
    provider: "replicate" | "fal";
    model: string;
    /** Extra model input merged under the prompt, as JSON. */
    input: Record<string, unknown>;
    /** Provider price per image, for estimates. */
    costUsd: number;
    /** House look appended to every image prompt. */
    guidelines: string;
  };
  limits: {
    /** Hard stop for one article, all stages and retries included. */
    perArticleUsd: number;
    /** Hard stop for the calendar month (UTC). */
    monthlyUsd: number;
  };
  /** Source URLs must be on one of these domains (subdomains included). */
  sourceDomains: string[];
}

export const DEFAULTS: WriterSettings = {
  write: { model: "anthropic/claude-opus-5.5", effort: "high", maxTokens: 16000 },
  audit: { model: "anthropic/claude-opus-5.5", effort: "medium", maxTokens: 8000 },
  links: { model: "anthropic/claude-opus-5.5", effort: "low", maxTokens: 3000 },
  autoRevise: true,
  image: {
    provider: "replicate",
    model: "bytedance/seedream-4",
    input: { size: "custom", width: 2400, height: 1260, max_images: 1, sequential_image_generation: "disabled" },
    costUsd: 0.03,
    guidelines:
      "Original editorial image for the PixyDust blog. One coherent scene, photographic or clean 3D, wide composition with the subject near the center so it survives a 1.91:1 crop. Dark, deep backgrounds with blue and cyan accent light where it suits the subject. No text, letters, numbers, logos, watermarks, signage, app screens, phone interfaces, user interfaces, collages, grids or split panels.",
  },
  limits: { perArticleUsd: 3, monthlyUsd: 30 },
  sourceDomains: ["pixydust.com", "pixiedustapp.com"],
};

/** OpenRouter list prices per million tokens, for estimates only. Actual cost
 *  comes back on every response (usage.cost) and is what the limits count. */
export const MODEL_PRICES: Record<string, { in: number; out: number }> = {
  "anthropic/claude-opus-5.5": { in: 4, out: 20 },
  "anthropic/claude-opus-5": { in: 5, out: 25 },
  "anthropic/claude-sonnet-5.5": { in: 2, out: 10 },
  "anthropic/claude-haiku-5.5": { in: 0.1, out: 0.5 },
};
/** SyncNode's documented per-call fee. */
export const GATEWAY_FEE_USD = 0.02;
export const MODERATION_FEE_USD = 0.005;

export async function getWriterSettings(db: D1Database): Promise<WriterSettings> {
  const raw = await getSetting(db, KEY).catch(() => null);
  let saved: Partial<WriterSettings> = {};
  try {
    saved = raw ? JSON.parse(raw) : {};
  } catch {
    saved = {};
  }
  return {
    ...DEFAULTS,
    ...saved,
    write: { ...DEFAULTS.write, ...(saved.write ?? {}) },
    audit: { ...DEFAULTS.audit, ...(saved.audit ?? {}) },
    links: { ...DEFAULTS.links, ...(saved.links ?? {}) },
    image: { ...DEFAULTS.image, ...(saved.image ?? {}) },
    limits: { ...DEFAULTS.limits, ...(saved.limits ?? {}) },
    sourceDomains: Array.isArray(saved.sourceDomains) ? saved.sourceDomains : DEFAULTS.sourceDomains,
  };
}

const clampNum = (v: unknown, lo: number, hi: number, dflt: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt;
};
const effortOf = (v: unknown, dflt: ChatStageConfig["effort"]) =>
  v === "low" || v === "medium" || v === "high" ? v : dflt;
const modelOf = (v: unknown, dflt: string) =>
  typeof v === "string" && /^[a-z0-9-]+\/[a-z0-9.:_-]+$/i.test(v.trim()) ? v.trim() : dflt;

/** Validate and store. Anything unreadable keeps its current value rather than
 *  being blanked, so a typo in one field can't switch a stage off. */
export async function saveWriterSettings(db: D1Database, input: Partial<WriterSettings>): Promise<WriterSettings> {
  const cur = await getWriterSettings(db);
  const stage = (k: "write" | "audit" | "links"): ChatStageConfig => ({
    model: modelOf(input[k]?.model, cur[k].model),
    effort: effortOf(input[k]?.effort, cur[k].effort),
    maxTokens: Math.round(clampNum(input[k]?.maxTokens, 500, 64000, cur[k].maxTokens)),
  });
  let imageInput = cur.image.input;
  if (input.image?.input && typeof input.image.input === "object" && !Array.isArray(input.image.input)) {
    imageInput = input.image.input;
  }
  const next: WriterSettings = {
    write: stage("write"),
    audit: stage("audit"),
    links: stage("links"),
    autoRevise: typeof input.autoRevise === "boolean" ? input.autoRevise : cur.autoRevise,
    image: {
      provider: input.image?.provider === "fal" ? "fal" : input.image?.provider === "replicate" ? "replicate" : cur.image.provider,
      model: modelOf(input.image?.model, cur.image.model),
      input: imageInput,
      costUsd: clampNum(input.image?.costUsd, 0, 5, cur.image.costUsd),
      guidelines: typeof input.image?.guidelines === "string" && input.image.guidelines.trim()
        ? input.image.guidelines.trim().slice(0, 2000)
        : cur.image.guidelines,
    },
    limits: {
      perArticleUsd: clampNum(input.limits?.perArticleUsd, 0.1, 50, cur.limits.perArticleUsd),
      monthlyUsd: clampNum(input.limits?.monthlyUsd, 1, 2000, cur.limits.monthlyUsd),
    },
    sourceDomains: Array.isArray(input.sourceDomains)
      ? [...new Set(input.sourceDomains.map((d) => String(d).trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "")).filter((d) => /^[a-z0-9.-]+\.[a-z]{2,}$/.test(d)))]
      : cur.sourceDomains,
  };
  await setSetting(db, KEY, JSON.stringify(next));
  return next;
}

/** Rough cost of one chat call, for the pre-flight limit check. */
export function estimateChatUsd(model: string, inTokens: number, outTokens: number): number {
  const p = MODEL_PRICES[model] ?? { in: 5, out: 25 };
  return (inTokens * p.in + outTokens * p.out) / 1e6 + GATEWAY_FEE_USD;
}
