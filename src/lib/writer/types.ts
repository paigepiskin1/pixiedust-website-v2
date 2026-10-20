// Shared shapes for the AI Writer. Everything here is admin metadata kept on
// the job; only the rendered article (see render.ts) ever reaches an item.
import type { ArticleType } from "./prompts";

export interface Brief {
  /** Topic / search intent: what the reader is trying to find out or do. */
  topic: string;
  primaryKeyword: string;
  keywords: string[];
  articleType: ArticleType;
  audience: string;
  /** Facts the admin requires in the article. Trusted: the admin is the source. */
  requiredFacts: string[];
  sourceUrls: string[];
  /** PixyDust tools the article covers, as fact ids (tool.shoots …). */
  tools: string[];
  outline: string;
  instructions: string;
  /** Section the draft will be filed under. */
  section: string;
}

export type BlockType = "p" | "h2" | "h3" | "ul" | "ol" | "quote";
export interface Block {
  type: BlockType;
  text: string;
  items: string[];
}

export interface Draft {
  title: string;
  seo_title: string;
  meta_description: string;
  slug: string;
  excerpt: string;
  tags: string[];
  category_hint: string;
  blocks: Block[];
  next_step: { text: string; link_id: string; anchor: string };
  claims: { text: string; kind: "product" | "general"; evidence: string[] }[];
  missing_evidence: string[];
  image: { concept: string; alt: string; filename: string };
}

export interface AuditResult {
  claims: { where: string; quote: string; verdict: "supported" | "unsupported" | "contradicted"; evidence: string[]; note: string }[];
  style: { where: string; quote: string; pattern: string; fix: string }[];
  brand: { where: string; quote: string; problem: string }[];
  summary: string;
}

export interface Issue {
  level: "error" | "warn";
  code: string;
  message: string;
  where?: string;
}

export interface SourceRecord {
  id: string; // S1, S2 …
  url: string;
  title: string;
  fetchedAt: string;
  chars: number;
  sha256: string;
  ok: boolean;
  error?: string;
  /** Extracted text, as given to the model. Kept so the evidence is auditable. */
  text?: string;
}

export interface Research {
  facts: { id: string; topic: string; statement: string; status: string }[];
  adminFacts: { id: string; statement: string }[];
  sources: SourceRecord[];
  categories: { id: string; title: string }[];
  /** Notes for the reviewer: blocked domains, failed fetches, thin evidence. */
  gaps: string[];
  gatheredAt: string;
}

export interface LinkTarget {
  /** Stable id: item-<blog_posts.id>, page-<name> or help-<id>. */
  id: string;
  kind: "item" | "page" | "help";
  title: string;
  url: string;
  summary: string;
}

export interface LinkSuggestion {
  where: string;
  anchor: string;
  target: string;
  reason: string;
  /** Review state. "replaced" keeps the anchor with another target. */
  state: "suggested" | "accepted" | "removed";
  /** Filled at validation time; null when the target no longer resolves. */
  url: string | null;
  title: string | null;
  problem: string | null;
  /** The link text shares no word with the destination: valid, but probably
   *  doesn't tell a reader where it goes. A hint for the reviewer. */
  weak?: boolean;
}

export interface ImageRecord {
  kind: "generated" | "upload";
  prompt: string;
  provider: string;
  model: string;
  input: Record<string, unknown>;
  providerJobId?: string;
  /** What the provider returned (SyncNode CDN URL). */
  originalUrl?: string;
  /** Our 1200×630 compressed copy, the one the item uses. */
  url?: string;
  filename?: string;
  bytes?: number;
  alt: string;
  moderation?: { safe: boolean; detail?: unknown };
  createdAt: string;
}

export type StageName = "research" | "write" | "audit" | "revise" | "links" | "image";
export type StageState = "pending" | "running" | "waiting" | "done" | "skipped" | "failed";
export interface StageInfo {
  state: StageState;
  attempts: number;
  error?: string;
  retryable?: boolean;
  startedAt?: string;
  finishedAt?: string;
  costUsd?: number;
  note?: string;
}
export type Stages = Record<StageName, StageInfo>;
export const STAGE_ORDER: StageName[] = ["research", "write", "audit", "revise", "links", "image"];

export interface Overlap {
  id: number;
  title: string;
  slug: string;
  status: string;
  score: number;
  reason: string;
}

/** The admin's edits in the review panel. Kept apart from the AI draft so a
 *  re-run never silently replaces them, and so the review shows both. */
export interface ReviewEdits {
  title?: string;
  seo_title?: string;
  meta_description?: string;
  slug?: string;
  excerpt?: string;
  tags?: string[];
  category?: string | null;
  alt?: string;
  related?: number[];
}
