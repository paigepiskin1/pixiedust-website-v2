// Telegram notifications for revenue events (subscriptions + credit top-ups).
// Sends a money GIF (Klipy) with a caption to the admin group. The GIF is
// cached in KV so Klipy is hit at most a few times a day; on a Klipy error/429
// we fall back to the last cached GIF. Best-effort — never throws.
import type { KVNamespace } from "@cloudflare/workers-types";

interface TgEnv {
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  KLIPY_API_KEY?: string;
  SESSIONS: KVNamespace;
}

const GIFS_KEY = "klipy:money_gifs";        // cached diverse pool (6h)
const FALLBACK_KEY = "klipy:money_gif_last"; // long-lived single fallback
const PREV_KEY = "klipy:money_gif_prev";     // last-sent url, to avoid repeats
const QUERIES = ["money rain", "make it rain", "cash money", "rich", "celebrate money", "money bag", "stonks", "cha ching"];

function pickRandom<T>(arr: T[]): T {
  if (arr.length <= 1) return arr[0];
  return arr[crypto.getRandomValues(new Uint32Array(1))[0] % arr.length];
}

/** Build a large, diverse pool of money-gif URLs from several Klipy queries. */
async function fetchPool(apiKey: string): Promise<string[]> {
  const all: string[] = [];
  for (const q of QUERIES) {
    try {
      const res = await fetch(`https://api.klipy.com/api/v1/${apiKey}/gifs/search?q=${encodeURIComponent(q)}&per_page=24&page=1`);
      if (!res.ok) continue;
      const j = (await res.json()) as any;
      for (const it of (j?.data?.data ?? [])) {
        const u = it?.file?.md?.gif?.url || it?.file?.hd?.gif?.url || it?.file?.sm?.gif?.url;
        if (u) all.push(u);
      }
    } catch { /* skip this query */ }
  }
  return [...new Set(all)]; // dedupe
}

/** A money GIF URL. Pulls from a diverse multi-query pool cached in KV (6h, to
 * stay within Klipy limits), picks at random, and avoids repeating the last one
 * sent. Falls back to the last good URL if Klipy is unavailable. */
async function getMoneyGif(env: TgEnv): Promise<string | null> {
  let pool: string[] | null = null;
  try {
    pool = (await env.SESSIONS.get(GIFS_KEY, "json")) as string[] | null;
  } catch { /* ignore */ }

  if ((!pool || pool.length < 2) && env.KLIPY_API_KEY) {
    const fresh = await fetchPool(env.KLIPY_API_KEY);
    if (fresh.length) {
      pool = fresh;
      await env.SESSIONS.put(GIFS_KEY, JSON.stringify(fresh), { expirationTtl: 21600 }); // 6h
      await env.SESSIONS.put(FALLBACK_KEY, fresh[0]); // durable fallback
    }
  }

  if (pool && pool.length) {
    let prev: string | null = null;
    try { prev = await env.SESSIONS.get(PREV_KEY); } catch { /* ignore */ }
    let pick = pickRandom(pool);
    for (let i = 0; i < 6 && pool.length > 1 && pick === prev; i++) pick = pickRandom(pool);
    try { await env.SESSIONS.put(PREV_KEY, pick, { expirationTtl: 21600 }); } catch { /* ignore */ }
    return pick;
  }

  try { return await env.SESSIONS.get(FALLBACK_KEY); } catch { return null; }
}

export interface PurchaseNotice {
  kind: "sub" | "renewal" | "pack";
  credits: number;
  label?: string | null;     // tier or pack name
  email?: string | null;
  amountUsd?: number | null;  // from Stripe amount_total/100
}

/** Post a revenue notification (with a money GIF) to the admin Telegram group. */
export async function notifyPurchase(env: TgEnv, n: PurchaseNotice): Promise<void> {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chat = env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return; // not configured yet

  const who = n.email || "a user";
  const amt = n.amountUsd != null && n.amountUsd > 0 ? ` · $${n.amountUsd.toFixed(2)}` : "";
  let caption: string;
  if (n.kind === "sub") caption = `🎉 <b>New subscription</b> — ${n.label || "plan"}${amt}\n${who} · +${n.credits} credits`;
  else if (n.kind === "renewal") caption = `🔁 <b>Subscription renewed</b> — ${n.label || "plan"}${amt}\n${who} · +${n.credits} credits`;
  else caption = `💰 <b>Credit top-up</b>${amt}\n${who} · +${n.credits} credits`;

  const gif = await getMoneyGif(env);
  try {
    if (gif) {
      const r = await fetch(`https://api.telegram.org/bot${token}/sendAnimation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chat, animation: gif, caption, parse_mode: "HTML" }),
      });
      if (r.ok) return;
    }
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chat, text: caption, parse_mode: "HTML" }),
    });
  } catch { /* best-effort */ }
}
