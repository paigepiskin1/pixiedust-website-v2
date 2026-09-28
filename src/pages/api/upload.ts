export const prerender = false;
import type { APIContext } from "astro";
import { uploadToBunny } from "../../lib/bunny";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

const MAX_BYTES = 110 * 1024 * 1024; // 110MB (covers Kling's 100MB video limit)
const ALLOWED = /^(image\/(png|jpe?g|webp|gif)|video\/(mp4|quicktime|webm)|audio\/(mpeg|mp3|wav|x-wav|wave|mp4|m4a|aac|ogg|flac|x-m4a))$/i;
const EXT: Record<string, string> = {
  "image/png": "png", "image/jpeg": "jpg", "image/jpg": "jpg", "image/webp": "webp", "image/gif": "gif",
  "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm",
  "audio/mpeg": "mp3", "audio/mp3": "mp3", "audio/wav": "wav", "audio/x-wav": "wav", "audio/wave": "wav",
  "audio/mp4": "m4a", "audio/m4a": "m4a", "audio/x-m4a": "m4a", "audio/aac": "aac",
  "audio/ogg": "ogg", "audio/flac": "flac",
};

function mediaKind(type: string): "image" | "video" | "audio" {
  if (type.startsWith("video/")) return "video";
  if (type.startsWith("audio/")) return "audio";
  return "image";
}

export async function POST({ request, locals }: APIContext) {
  const user = locals.user;
  if (!user) return json({ error: "Sign in to upload." }, 401);
  const env = locals.runtime.env;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: "Expected multipart form data." }, 400);
  }
  const file = form.get("file");
  if (!(file instanceof File)) return json({ error: "No file." }, 400);
  if (file.size > MAX_BYTES) return json({ error: "File too large (max 110MB)." }, 413);
  // Some browsers omit MIME for audio — fall back to extension.
  let type = file.type || "";
  if (!type || !ALLOWED.test(type)) {
    const name = (file.name || "").toLowerCase();
    if (/\.mp3$/i.test(name)) type = "audio/mpeg";
    else if (/\.wav$/i.test(name)) type = "audio/wav";
    else if (/\.m4a$/i.test(name)) type = "audio/mp4";
    else if (/\.aac$/i.test(name)) type = "audio/aac";
    else if (/\.ogg$/i.test(name)) type = "audio/ogg";
    else if (/\.flac$/i.test(name)) type = "audio/flac";
    else if (/\.mp4$/i.test(name)) type = "video/mp4";
    else if (/\.mov$/i.test(name)) type = "video/quicktime";
    else if (/\.webm$/i.test(name)) type = "video/webm";
  }
  if (!ALLOWED.test(type)) return json({ error: `Unsupported type: ${file.type || type || "unknown"}. Use image, video (mp4/mov/webm), or audio (mp3/wav/m4a).` }, 415);

  const ext = EXT[type.toLowerCase()] ?? "bin";
  const path = `uploads/${user.uid}/${crypto.randomUUID()}.${ext}`;

  try {
    const url = await uploadToBunny(env, path, await file.arrayBuffer(), type);
    return json({ url, kind: mediaKind(type) });
  } catch {
    return json({ error: "Upload failed. Please try again." }, 502);
  }
}
