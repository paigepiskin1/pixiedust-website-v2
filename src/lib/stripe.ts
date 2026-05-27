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

// ─── Generic REST helpers + customer / payment-method management ───
async function stripeFetch(secretKey: string, method: "GET" | "POST", path: string, params?: Record<string, unknown>) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: method === "POST" && params ? encode(params).join("&") : undefined,
  });
  const data = (await res.json()) as any;
  if (!res.ok) throw new Error(data?.error?.message || `Stripe error (${res.status})`);
  return data;
}

/** Get the user's Stripe customer id, creating + persisting one if missing. */
export async function getOrCreateCustomer(
  secretKey: string,
  db: import("@cloudflare/workers-types").D1Database,
  user: { id: number; uid: string; email: string | null; name: string | null; stripe_customer_id?: string | null }
): Promise<string> {
  if (user.stripe_customer_id) return user.stripe_customer_id;
  const cust = await stripeFetch(secretKey, "POST", "/customers", {
    email: user.email ?? undefined,
    name: user.name ?? undefined,
    metadata: { user_id: user.id, user_uid: user.uid },
  });
  await db.prepare("UPDATE users SET stripe_customer_id = ? WHERE id = ?").bind(cust.id, user.id).run();
  return cust.id as string;
}

export interface SavedCard {
  id: string;
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
  isDefault: boolean;
}

export async function listPaymentMethods(secretKey: string, customerId: string): Promise<SavedCard[]> {
  const [pms, cust] = await Promise.all([
    stripeFetch(secretKey, "GET", `/payment_methods?customer=${customerId}&type=card&limit=20`),
    stripeFetch(secretKey, "GET", `/customers/${customerId}`),
  ]);
  const defaultPm = cust?.invoice_settings?.default_payment_method as string | undefined;
  return (pms.data || []).map((pm: any) => ({
    id: pm.id,
    brand: pm.card?.brand ?? "card",
    last4: pm.card?.last4 ?? "????",
    exp_month: pm.card?.exp_month ?? 0,
    exp_year: pm.card?.exp_year ?? 0,
    isDefault: pm.id === defaultPm,
  }));
}

export async function detachPaymentMethod(secretKey: string, pmId: string): Promise<void> {
  await stripeFetch(secretKey, "POST", `/payment_methods/${pmId}/detach`);
}

/** Confirm a payment method belongs to this customer before mutating it. */
export async function paymentMethodBelongsTo(secretKey: string, pmId: string, customerId: string): Promise<boolean> {
  try {
    const pm = await stripeFetch(secretKey, "GET", `/payment_methods/${pmId}`);
    return pm?.customer === customerId;
  } catch {
    return false;
  }
}

export async function setDefaultPaymentMethod(secretKey: string, customerId: string, pmId: string): Promise<void> {
  await stripeFetch(secretKey, "POST", `/customers/${customerId}`, {
    invoice_settings: { default_payment_method: pmId },
  });
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
