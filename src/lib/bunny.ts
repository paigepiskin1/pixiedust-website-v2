// Upload user files to Bunny storage and return the public pull-zone URL.
// Used for generation inputs (reference images/videos for motion, fashion, etc.).
interface BunnyEnv {
  BUNNY_STORAGE_ZONE: string;
  BUNNY_API_KEY: string;
  BUNNY_PULL_ZONE_URL: string;
}

const STORAGE_HOST = "https://storage.bunnycdn.com";

export async function uploadToBunny(env: BunnyEnv, path: string, body: ArrayBuffer, contentType: string): Promise<string> {
  const url = `${STORAGE_HOST}/${env.BUNNY_STORAGE_ZONE}/${path}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: { AccessKey: env.BUNNY_API_KEY, "Content-Type": contentType || "application/octet-stream" },
    body,
  });
  if (res.status !== 201 && res.status !== 200) {
    throw new Error(`Bunny upload failed (${res.status})`);
  }
  return `${env.BUNNY_PULL_ZONE_URL.replace(/\/$/, "")}/${path}`;
}

/**
 * Best-effort delete of a Bunny storage object. Accepts a full pull-zone URL or
 * a raw storage path. Returns true on success (or 404). Never throws — CDN
 * cleanup should not block the DB delete.
 */
export async function deleteFromBunny(env: BunnyEnv, urlOrPath: string): Promise<boolean> {
  let path = (urlOrPath || "").split("?")[0];
  const pull = env.BUNNY_PULL_ZONE_URL.replace(/\/$/, "");
  if (path.startsWith(pull + "/")) path = path.slice(pull.length + 1);
  else if (/^https?:\/\//.test(path)) {
    try { path = new URL(path).pathname.replace(/^\//, ""); } catch { return false; }
  }
  if (!path) return false;
  try {
    const res = await fetch(`${STORAGE_HOST}/${env.BUNNY_STORAGE_ZONE}/${path}`, {
      method: "DELETE",
      headers: { AccessKey: env.BUNNY_API_KEY },
    });
    return res.ok || res.status === 404;
  } catch {
    return false;
  }
}
