// Clicky Analytics API (read-only). Server-side only — the sitekey never
// reaches the browser. Responses are cached briefly in KV to stay well under
// Clicky's daily API limit.
import type { KVNamespace } from "@cloudflare/workers-types";

const API = "https://api.clicky.com/api/stats/4";
const CACHE_TTL = 300; // 5 minutes

export interface ClickyItem {
  title?: string;
  value: number;
  value_percent?: number;
  url?: string;
}

interface ClickyEnv {
  CLICKY_SITE_ID: string;
  CLICKY_SITEKEY: string;
  SESSIONS: KVNamespace;
}

/**
 * Fetch one or more Clicky stat `types` for a `date` keyword (today,
 * yesterday, last-7-days, last-30-days, last-365-days). Returns a map of
 * type → items[]. Network/parse failures resolve to empty arrays so the
 * dashboard degrades gracefully instead of erroring.
 */
export async function clickyStats(
  env: ClickyEnv,
  types: string[],
  date: string,
  limit = 10
): Promise<Record<string, ClickyItem[]>> {
  const typeParam = types.join(",");
  const cacheKey = `clicky:${env.CLICKY_SITE_ID}:${date}:${typeParam}:${limit}`;

  try {
    const cached = await env.SESSIONS.get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch {
    /* cache miss is fine */
  }

  const url =
    `${API}?site_id=${encodeURIComponent(env.CLICKY_SITE_ID)}` +
    `&sitekey=${encodeURIComponent(env.CLICKY_SITEKEY)}` +
    `&type=${encodeURIComponent(typeParam)}&date=${encodeURIComponent(date)}` +
    `&limit=${limit}&output=json`;

  const out: Record<string, ClickyItem[]> = {};
  try {
    const res = await fetch(url);
    if (!res.ok) return blank(types);
    const data = (await res.json()) as Array<{ type: string; dates?: Array<{ items?: any[] }> }>;
    for (const block of data) {
      const items = block.dates?.[0]?.items ?? [];
      out[block.type] = items.map((it) => ({
        title: it.title,
        value: Number(it.value) || 0,
        value_percent: it.value_percent != null ? Number(it.value_percent) : undefined,
        url: it.url,
      }));
    }
    for (const t of types) if (!out[t]) out[t] = [];
    try {
      await env.SESSIONS.put(cacheKey, JSON.stringify(out), { expirationTtl: CACHE_TTL });
    } catch {
      /* best-effort cache */
    }
    return out;
  } catch {
    return blank(types);
  }
}

function blank(types: string[]): Record<string, ClickyItem[]> {
  const o: Record<string, ClickyItem[]> = {};
  for (const t of types) o[t] = [];
  return o;
}

/** Single visitors total for a date keyword. */
export async function clickyVisitors(env: ClickyEnv, date: string): Promise<number> {
  const r = await clickyStats(env, ["visitors"], date, 1);
  return r.visitors?.[0]?.value ?? 0;
}
