// BytePlus (Ark) asset library, via SyncNode's /byteplus/asset proxy. Real-person
// photos are rejected by Seedance inline, but assets uploaded to the library and
// referenced as asset://<id> are authorized. Only the AIGC group type is enabled
// on our account (LivenessFace/real-person needs BytePlus enablement + liveness),
// so this is best-effort — see project_byteplus_real_person_block memory.
import type { D1Database } from "@cloudflare/workers-types";
import { getSetting, setSetting } from "./app-settings";

const BASE = "https://run.syncnode.ai/byteplus/asset";
const GROUP_KEY = "byteplus_asset_group_id";

async function assetCall(apiKey: string, action: string, params: Record<string, unknown>): Promise<any> {
  const res = await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey, action, params }),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, any>;
  const err = data?.ResponseMetadata?.Error;
  if (err) throw new Error(`asset:${action} ${err.Code}: ${err.Message}`);
  if (data?.error) throw new Error(`asset:${action}: ${data.error}`);
  return data.Result ?? data;
}

/** Shared library group (created once, id cached in app_settings). */
async function sharedGroupId(apiKey: string, db: D1Database): Promise<string> {
  const cached = await getSetting(db, GROUP_KEY);
  if (cached) return cached;
  const r = await assetCall(apiKey, "CreateAssetGroup", { Name: "pixiedust-users" });
  await setSetting(db, GROUP_KEY, r.Id);
  return r.Id;
}

/** Upload one image URL to the library and wait until it's Active; returns the id. */
async function uploadAndActivate(apiKey: string, groupId: string, url: string): Promise<string> {
  const c = await assetCall(apiKey, "CreateAsset", { GroupId: groupId, Name: "user-" + Date.now(), URL: url, AssetType: "Image" });
  const assetId = c.Id || c.AssetId;
  for (let i = 0; i < 20; i++) {
    const s = await assetCall(apiKey, "GetAsset", { Id: assetId });
    if (s.Status === "Active") return assetId;
    if (s.Status === "Failed") throw new Error("Photo rejected — use a clear, single, frontal face (jpeg/png/webp, 300–6000px, under 30MB).");
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("The photo took too long to process — try again.");
}

/**
 * For a BytePlus `content[]` payload, replace each http(s) image reference with
 * an uploaded `asset://<id>` library reference. Mutates and returns `input`.
 * No-op if there are no image URLs to convert.
 */
export async function prepareByteplusAssets(apiKey: string, db: D1Database, input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const content = (input as any).content;
  if (!Array.isArray(content)) return input;
  let groupId: string | null = null;
  for (const part of content) {
    const url = part?.type === "image_url" ? part?.image_url?.url : undefined;
    if (typeof url === "string" && /^https?:\/\//i.test(url)) {
      if (!groupId) groupId = await sharedGroupId(apiKey, db);
      const assetId = await uploadAndActivate(apiKey, groupId, url);
      part.image_url.url = `asset://${assetId}`;
    }
  }
  return input;
}
