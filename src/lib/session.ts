// Opaque session ids stored in KV (sess:<id> -> firebase uid), referenced by an
// HttpOnly cookie. Keeps the Firebase ID token out of long-lived storage.
export const SESSION_COOKIE = "pd_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export async function createSession(kv: KVNamespace, uid: string): Promise<string> {
  const id = crypto.randomUUID();
  await kv.put(`sess:${id}`, uid, { expirationTtl: SESSION_TTL_SECONDS });
  return id;
}

export async function readSession(kv: KVNamespace, id: string | undefined): Promise<string | null> {
  if (!id) return null;
  return await kv.get(`sess:${id}`);
}

export async function destroySession(kv: KVNamespace, id: string | undefined): Promise<void> {
  if (id) await kv.delete(`sess:${id}`);
}
