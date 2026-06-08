// Minimal Firebase Admin (no SDK) for privileged operations like deleting a
// user from Firebase Auth. Uses a service-account JSON (stored in the
// FIREBASE_SERVICE_ACCOUNT secret) to mint an OAuth2 access token via a signed
// JWT, then calls the Identity Toolkit admin API. Works on Cloudflare Workers
// (Web Crypto only).

interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
}

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToDer(pem: string): ArrayBuffer {
  const body = pem.replace(/-----BEGIN [^-]+-----/, "").replace(/-----END [^-]+-----/, "").replace(/\s+/g, "");
  const bin = atob(body);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

function parseServiceAccount(raw: string | undefined): ServiceAccount | null {
  if (!raw) return null;
  try {
    const j = JSON.parse(raw) as ServiceAccount;
    if (!j.client_email || !j.private_key || !j.project_id) return null;
    // JSON-escaped newlines in the private key → real newlines.
    j.private_key = j.private_key.replace(/\\n/g, "\n");
    return j;
  } catch {
    return null;
  }
}

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(new TextEncoder().encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const claims = b64url(
    new TextEncoder().encode(
      JSON.stringify({
        iss: sa.client_email,
        scope: "https://www.googleapis.com/auth/identitytoolkit",
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600,
      })
    )
  );
  const signingInput = `${header}.${claims}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToDer(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(signingInput));
  const jwt = `${signingInput}.${b64url(sig)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=${encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer")}&assertion=${jwt}`,
  });
  const data = (await res.json()) as { access_token?: string; error_description?: string };
  if (!data.access_token) throw new Error(data.error_description || "token exchange failed");
  return data.access_token;
}

export interface AdminResult {
  ok: boolean;
  skipped?: boolean; // service account not configured
  error?: string;
}

/** Hard-delete a user from Firebase Auth by uid. Best-effort: returns
 * {skipped:true} when no service account is configured. */
export async function deleteFirebaseUser(env: { FIREBASE_SERVICE_ACCOUNT?: string }, uid: string): Promise<AdminResult> {
  const sa = parseServiceAccount(env.FIREBASE_SERVICE_ACCOUNT);
  if (!sa) return { ok: false, skipped: true, error: "Firebase service account not configured" };
  try {
    const token = await getAccessToken(sa);
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${sa.project_id}/accounts:delete`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ localId: uid }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    // USER_NOT_FOUND is fine — already gone from Firebase.
    if (!res.ok && data?.error?.message && data.error.message !== "USER_NOT_FOUND") {
      return { ok: false, error: data.error.message };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String((err as Error)?.message || err) };
  }
}
