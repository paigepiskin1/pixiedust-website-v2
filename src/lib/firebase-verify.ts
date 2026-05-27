// Server-side Firebase ID token verification using Web Crypto (works on
// Cloudflare Workers — no Admin SDK / service account needed). Firebase ID
// tokens are RS256 JWTs signed by Google's securetoken service.
import { FIREBASE_PROJECT_ID } from "./firebase-config";

const JWK_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
const ISSUER = `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`;

export interface FirebaseClaims {
  uid: string;
  email?: string;
  name?: string;
  picture?: string;
  emailVerified: boolean;
}

interface JwkCache {
  keys: Record<string, CryptoKey>;
  expiresAt: number;
}
let jwkCache: JwkCache | null = null;

function b64urlToBytes(s: string): Uint8Array {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function b64urlToJson<T>(s: string): T {
  return JSON.parse(new TextDecoder().decode(b64urlToBytes(s)));
}

async function getKeys(): Promise<Record<string, CryptoKey>> {
  const now = Date.now();
  if (jwkCache && jwkCache.expiresAt > now) return jwkCache.keys;

  const res = await fetch(JWK_URL);
  if (!res.ok) throw new Error("Could not fetch Firebase signing keys");
  const { keys } = (await res.json()) as { keys: JsonWebKey[] };

  const imported: Record<string, CryptoKey> = {};
  for (const jwk of keys) {
    if (!jwk.kid) continue;
    imported[jwk.kid] = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"]
    );
  }

  // Respect the endpoint's cache lifetime (falls back to 1h).
  const cc = res.headers.get("cache-control") || "";
  const maxAge = Number(/max-age=(\d+)/.exec(cc)?.[1] || 3600);
  jwkCache = { keys: imported, expiresAt: now + maxAge * 1000 };
  return imported;
}

/** Verify a Firebase ID token. Throws on any failure; returns claims on success. */
export async function verifyIdToken(token: string): Promise<FirebaseClaims> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Malformed token");
  const [headerB64, payloadB64, sigB64] = parts;

  const header = b64urlToJson<{ alg: string; kid: string }>(headerB64);
  if (header.alg !== "RS256") throw new Error("Unexpected token algorithm");

  const keys = await getKeys();
  const key = keys[header.kid];
  if (!key) throw new Error("Unknown signing key");

  const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64urlToBytes(sigB64), data);
  if (!ok) throw new Error("Invalid token signature");

  const p = b64urlToJson<Record<string, any>>(payloadB64);
  const now = Math.floor(Date.now() / 1000);
  if (p.aud !== FIREBASE_PROJECT_ID) throw new Error("Token audience mismatch");
  if (p.iss !== ISSUER) throw new Error("Token issuer mismatch");
  if (typeof p.exp !== "number" || p.exp <= now) throw new Error("Token expired");
  if (typeof p.iat !== "number" || p.iat > now + 60) throw new Error("Token issued in the future");
  if (!p.sub || typeof p.sub !== "string") throw new Error("Token missing subject");

  return {
    uid: p.sub,
    email: p.email,
    name: p.name,
    picture: p.picture,
    emailVerified: !!p.email_verified,
  };
}
