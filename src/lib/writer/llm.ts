// Chat calls for the AI Writer, routed through SyncNode's /chat-completion
// (OpenRouter behind it). Credentials never leave the server: the SyncNode key
// is read from the Worker env, and SyncNode holds the OpenRouter key.
//
// The response carries OpenRouter's own cost accounting (usage.cost), which is
// what spending limits count; the token-price table is only for estimates.
import { GATEWAY_FEE_USD, estimateChatUsd, type ChatStageConfig } from "./settings";

const ENDPOINT = "https://run.syncnode.ai/chat-completion";

export interface ChatRequest {
  stage: ChatStageConfig;
  system: string;
  user: string;
  /** JSON Schema for structured output. The model is held to it. */
  schema?: { name: string; schema: Record<string, unknown> };
}

export interface ChatUsage {
  promptTokens: number;
  completionTokens: number;
  reasoningTokens: number;
  costUsd: number;
  gatewayUsd: number;
  ms: number;
}

export interface ChatResult<T = unknown> {
  text: string;
  json: T | null;
  usage: ChatUsage;
}

/** A failed call, with what it cost so far (a call that ran out of tokens is
 *  still billed) and whether trying again could plausibly succeed. */
export class ChatError extends Error {
  constructor(message: string, readonly usage: ChatUsage, readonly retryable: boolean) {
    super(message);
  }
}

function parseJson(text: string): unknown {
  let t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start >= 0 && end > start) t = t.slice(start, end + 1);
  return JSON.parse(t);
}

export async function chat<T = unknown>(apiKey: string, req: ChatRequest): Promise<ChatResult<T>> {
  if (!apiKey) throw new ChatError("SYNCNODE_API_KEY is not set on the server.", emptyUsage(0), false);
  const t0 = Date.now();
  const body: Record<string, unknown> = {
    apiKey,
    model: req.stage.model,
    max_tokens: req.stage.maxTokens,
    reasoning: { effort: req.stage.effort },
    usage: { include: true },
    messages: [
      { role: "system", content: req.system },
      { role: "user", content: req.user },
    ],
  };
  if (req.schema) {
    body.response_format = { type: "json_schema", json_schema: { name: req.schema.name, strict: true, schema: req.schema.schema } };
  }

  let res: Response;
  try {
    res = await fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  } catch (err) {
    throw new ChatError(`Could not reach SyncNode: ${(err as Error).message}`, emptyUsage(Date.now() - t0), true);
  }
  const raw = await res.text();
  const ms = Date.now() - t0;
  let data: any = null;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new ChatError(`SyncNode returned ${res.status}: ${raw.slice(0, 300)}`, emptyUsage(ms), res.status >= 500 || res.status === 429);
  }

  const pred = data?.prediction ?? data;
  const out = pred?.output ?? {};
  const u = out.usage ?? {};
  const promptTokens = Number(u.prompt_tokens) || 0;
  const completionTokens = Number(u.completion_tokens) || 0;
  const usage: ChatUsage = {
    promptTokens,
    completionTokens,
    reasoningTokens: Number(u.completion_tokens_details?.reasoning_tokens) || 0,
    // Prefer the provider's reported cost; fall back to list prices when a
    // response omits it, so spend is never recorded as zero by accident.
    costUsd: typeof u.cost === "number"
      ? u.cost
      : promptTokens || completionTokens
        ? estimateChatUsd(req.stage.model, promptTokens, completionTokens) - GATEWAY_FEE_USD
        : 0,
    // SyncNode's response has reported cost 0 for calls its docs price at
    // $0.02, so count the documented fee unless it reports a real one.
    gatewayUsd: typeof pred?.cost === "number" && pred.cost > 0 ? pred.cost : GATEWAY_FEE_USD,
    ms,
  };

  if (!res.ok || pred?.status === "failed" || data?.error) {
    const msg =
      (typeof data?.error === "string" && data.error) ||
      data?.error?.message ||
      (typeof pred?.error === "string" && pred.error) ||
      out?.error?.message ||
      `SyncNode returned ${res.status}`;
    throw new ChatError(String(msg), usage, res.status >= 500 || res.status === 429);
  }

  const choice = out.choices?.[0];
  const text: string = choice?.message?.content ?? "";
  if (choice?.finish_reason === "length") {
    throw new ChatError(`The model ran out of room (max ${req.stage.maxTokens} tokens). Raise max tokens for this stage in Settings.`, usage, false);
  }
  if (!text.trim()) throw new ChatError("The model returned an empty response.", usage, true);

  let json: T | null = null;
  if (req.schema) {
    try {
      json = parseJson(text) as T;
    } catch {
      throw new ChatError("The model's response was not valid JSON.", usage, true);
    }
  }
  return { text, json, usage };
}

function emptyUsage(ms: number): ChatUsage {
  return { promptTokens: 0, completionTokens: 0, reasoningTokens: 0, costUsd: 0, gatewayUsd: 0, ms };
}
