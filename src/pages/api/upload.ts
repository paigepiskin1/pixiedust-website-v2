export const prerender = false;
import type { APIContext } from "astro";
import { uploadToBunny } from "../../lib/bunny";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

const MAX_BYTES = 110 * 1024 * 1024; // 110MB (covers Kling's 100MB video limit)
const ALLOWED = /^(image\/(png|jpe?g|webp|gif)|video\/(mp4|quicktime|webm))$/i;
const EXT: Record<string, string> = {
  "image/png": "png", "image/jpeg": "jpg", "image/jpg": "jpg", "image/webp": "webp", "image/gif": "gif",
  "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm",
};

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
  if (!ALLOWED.test(file.type)) return json({ error: `Unsupported type: ${file.type || "unknown"}.` }, 415);

  const ext = EXT[file.type.toLowerCase()] ?? "bin";
  const path = `uploads/${user.uid}/${crypto.randomUUID()}.${ext}`;

  try {
    const url = await uploadToBunny(env, path, await file.arrayBuffer(), file.type);
    return json({ url, kind: file.type.startsWith("video") ? "video" : "image" });
  } catch {
    return json({ error: "Upload failed. Please try again." }, 502);
  }
}
