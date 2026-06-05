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

const GIFS_KEY = "klipy:money_gifs";        // short-lived rotation set
const FALLBACK_KEY = "klipy:money_gif_last"; // long-lived single fallback
const QUERIES = ["money rain", "make it rain", "cash money", "rich", "money bag"];

function pickRandom<T>(arr: T[]): T {
  if (arr.length <= 1) return arr[0];
  return arr[crypto.getRandomValues(new Uint32Array(1))[0] % arr.length];
}

/** A money GIF URL — cached in KV (6h); refetched from Klipy on miss; falls
 * back to the last good URL if Klipy is unavailable. */
async function getMoneyGif(env: TgEnv): Promise<string | null> {
  try {
    const cached = (await env.SESSIONS.get(GIFS_KEY, "json")) as string[] | null;
    if (cached && cached.length) return pickRandom(cached);
  } catch { /* ignore */ }

  if (env.KLIPY_API_KEY) {
    try {
      const q = pickRandom(QUERIES);
      const res = await fetch(
        `https://api.klipy.com/api/v1/${env.KLIPY_API_KEY}/gifs/search?q=${encodeURIComponent(q)}&per_page=24&page=1`
      );
      if (res.ok) {
        const j = (await res.json()) as any;
        const items: any[] = j?.data?.data ?? [];
        const urls = items
          .map((it) => it?.file?.md?.gif?.url || it?.file?.hd?.gif?.url || it?.file?.sm?.gif?.url)
          .filter(Boolean) as string[];
        if (urls.length) {
          await env.SESSIONS.put(GIFS_KEY, JSON.stringify(urls), { expirationTtl: 21600 }); // 6h
          await env.SESSIONS.put(FALLBACK_KEY, urls[0]); // no TTL → durable fallback
          return pickRandom(urls);
        }
      }
    } catch { /* fall through to fallback */ }
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
