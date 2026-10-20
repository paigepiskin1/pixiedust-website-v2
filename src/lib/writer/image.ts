// Header image for a writer draft: generate through SyncNode, then make the
// one file the item uses, a compressed 1200×630 JPEG with a readable name.
//
// Resizing uses Bunny Optimizer on the pull zone (already on for pixiecdn), so
// no image library runs in the Worker: we request the cropped, compressed
// variant from the CDN and store those bytes as the final file. The same
// optimizer serves smaller responsive variants (?width=600 …) at render time.
import { submitGeneration, pollStatus, type PollResult } from "../syncnode";
import { uploadToBunny } from "../bunny";
import { MODERATION_FEE_USD } from "./settings";

interface BunnyEnv {
  BUNNY_STORAGE_ZONE: string;
  BUNNY_API_KEY: string;
  BUNNY_PULL_ZONE_URL: string;
}

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

export async function submitImage(apiKey: string, provider: string, model: string, prompt: string, input: Record<string, unknown>): Promise<string> {
  const { jobId } = await submitGeneration(apiKey, { provider, model, input: { ...input, prompt } });
  return jobId;
}

export function checkImage(apiKey: string, provider: string, jobId: string): Promise<PollResult> {
  return pollStatus(apiKey, provider, jobId);
}

const pullBase = (env: BunnyEnv) => env.BUNNY_PULL_ZONE_URL.replace(/\/$/, "");

async function exists(url: string): Promise<boolean> {
  try {
    const r = await fetch(url, { method: "HEAD" });
    return r.ok;
  } catch {
    return false;
  }
}

/** Readable, unused file name under media/blog/. Never overwrites a file. */
async function freePath(env: BunnyEnv, filename: string): Promise<string> {
  const base = (filename || "pixydust-blog-image")
    .toLowerCase().replace(/\.[a-z0-9]+$/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "pixydust-blog-image";
  for (let n = 1; n < 30; n++) {
    const path = `media/blog/${base}${n === 1 ? "" : `-${n}`}.jpg`;
    if (!(await exists(`${pullBase(env)}/${path}`))) return path;
  }
  return `media/blog/${base}-${crypto.randomUUID().slice(0, 8)}.jpg`;
}

export interface FinalImage {
  url: string;
  path: string;
  bytes: number;
  originalUrl: string;
}

/**
 * Make the final 1200×630 file from any image URL (a generation or an
 * uploaded screenshot). An image not already on our pull zone is copied there
 * first, because the optimizer only transforms files it serves.
 */
export async function finalizeImage(env: BunnyEnv, sourceUrl: string, filename: string, jobId: string): Promise<FinalImage> {
  let onCdn = sourceUrl.split("?")[0];
  if (!onCdn.startsWith(pullBase(env) + "/")) {
    const r = await fetch(sourceUrl);
    if (!r.ok) throw new Error(`Could not download the generated image (${r.status}).`);
    const type = r.headers.get("content-type") || "image/png";
    const ext = /jpe?g/.test(type) ? "jpg" : /webp/.test(type) ? "webp" : "png";
    onCdn = await uploadToBunny(env, `media/blog/ai-originals/${jobId}.${ext}`, await r.arrayBuffer(), type);
  }
  const variant = `${onCdn}?width=${OG_WIDTH}&height=${OG_HEIGHT}&aspect_ratio=${OG_WIDTH}:${OG_HEIGHT}&quality=82&format=jpeg`;
  const r = await fetch(variant);
  if (!r.ok) throw new Error(`The CDN could not resize the image (${r.status}).`);
  const bytes = await r.arrayBuffer();
  if (bytes.byteLength < 2000) throw new Error("The resized image came back empty.");
  const path = await freePath(env, filename);
  const url = await uploadToBunny(env, path, bytes, "image/jpeg");
  return { url, path, bytes: bytes.byteLength, originalUrl: onCdn };
}

/** SyncNode moderation on the final image. A flagged image is not used. */
export async function moderateImage(apiKey: string, imageUrl: string): Promise<{ safe: boolean; detail: unknown; costUsd: number }> {
  const res = await fetch("https://moderate.syncnode.ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey, imageUrl }),
  });
  const data = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) throw new Error(data?.error || `Moderation returned ${res.status}`);
  const safe = Number(data?.overall_moderation?.safe ?? data?.image_moderation?.safe) === 1;
  return { safe, detail: data?.overall_moderation ?? data?.image_moderation ?? null, costUsd: MODERATION_FEE_USD };
}

/** Responsive variants of a pull-zone image, for srcset. Other hosts get none. */
export function cdnSrcset(url: string | null | undefined, pullZone: string, widths = [480, 768, 1200]): string | undefined {
  if (!url || !pullZone) return undefined;
  const base = pullZone.replace(/\/$/, "");
  if (!url.startsWith(base + "/")) return undefined;
  const clean = url.split("?")[0];
  return widths.map((w) => `${clean}?width=${w} ${w}w`).join(", ");
}
