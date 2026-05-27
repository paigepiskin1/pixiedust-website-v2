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
