// Minimal server-side Stripe client over the REST API (no SDK). Checkout
// sessions use dynamic price_data so we don't pre-create Stripe products —
// pricing lives in D1 (subscription_tiers / credit_packs).
const API = "https://api.stripe.com/v1";

function encode(params: Record<string, unknown>, prefix = ""): string[] {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (item && typeof item === "object") parts.push(...encode(item as Record<string, unknown>, `${key}[${i}]`));
        else parts.push(`${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(String(item))}`);
      });
    } else if (typeof v === "object") {
      parts.push(...encode(v as Record<string, unknown>, key));
    } else {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
    }
  }
  return parts;
}

export async function createCheckoutSession(
  secretKey: string,
  params: Record<string, unknown>
): Promise<{ id: string; url: string }> {
  const res = await fetch(`${API}/checkout/sessions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: encode(params).join("&"),
  });
  const data = (await res.json()) as { id?: string; url?: string; error?: { message?: string } };
  if (!res.ok || !data.url) throw new Error(data.error?.message || `Stripe error (${res.status})`);
  return { id: data.id!, url: data.url };
}

/** Verify a Stripe webhook signature (HMAC-SHA256) using Web Crypto. */
export async function verifyWebhookSignature(
  payload: string,
  sigHeader: string | null,
  secret: string,
  toleranceSec = 300
): Promise<boolean> {
  if (!sigHeader) return false;
  const parts: Record<string, string> = {};
  for (const seg of sigHeader.split(",")) {
    const idx = seg.indexOf("=");
    if (idx > 0) parts[seg.slice(0, idx).trim()] = seg.slice(idx + 1).trim();
  }
  const t = parts.t;
  const v1 = parts.v1;
  if (!t || !v1) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - Number(t)) > toleranceSec) return false;

  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${payload}`));
  const hex = Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, "0")).join("");
  if (hex.length !== v1.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ v1.charCodeAt(i);
  return diff === 0;
}
