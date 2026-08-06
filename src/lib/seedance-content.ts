/**
 * Build BytePlus Seedance 2.0 multimodal `content[]` parts from a prompt +
 * optional image / video / audio reference URLs.
 *
 * Caps (Seedance 2.0 R2V): ≤9 images, ≤3 videos, ≤3 audios, ≤9 total refs
 * (product UX); audio cannot stand alone without an image or video.
 */

export type SeedanceContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; role: "reference_image"; image_url: { url: string } }
  | { type: "video_url"; role: "reference_video"; video_url: { url: string } }
  | { type: "audio_url"; role: "reference_audio"; audio_url: { url: string } };

const MAX_TOTAL = 9;
const MAX_IMAGES = 9;
const MAX_VIDEOS = 3;
const MAX_AUDIOS = 3;

function classifyUrl(url: string): "image" | "video" | "audio" {
  if (/\.(mp4|mov|webm)(\?|$)/i.test(url)) return "video";
  if (/\.(mp3|wav|m4a|aac|ogg|mpeg)(\?|$)/i.test(url)) return "audio";
  return "image";
}

function asUrlList(files: unknown): string[] {
  if (Array.isArray(files)) {
    return files.filter((u): u is string => typeof u === "string" && !!u).slice(0, MAX_TOTAL);
  }
  if (typeof files === "string" && files) return [files];
  return [];
}

export function buildSeedanceMultimodalContent(
  prompt: string,
  files: unknown
): { content: SeedanceContentPart[]; error?: string } {
  const urls = asUrlList(files);
  const images: string[] = [];
  const videos: string[] = [];
  const audios: string[] = [];

  for (const url of urls) {
    const kind = classifyUrl(url);
    if (kind === "video") {
      if (videos.length < MAX_VIDEOS) videos.push(url);
    } else if (kind === "audio") {
      if (audios.length < MAX_AUDIOS) audios.push(url);
    } else if (images.length < MAX_IMAGES) {
      images.push(url);
    }
  }

  const text = String(prompt || "").trim();
  if (audios.length && !images.length && !videos.length) {
    return { content: [], error: "Audio references need at least one image or video alongside them." };
  }
  if (!text && !images.length && !videos.length) {
    return { content: [], error: "Add a prompt or at least one image/video reference." };
  }

  const content: SeedanceContentPart[] = [];
  if (text) content.push({ type: "text", text });
  for (const url of images) {
    content.push({ type: "image_url", role: "reference_image", image_url: { url } });
  }
  for (const url of videos) {
    content.push({ type: "video_url", role: "reference_video", video_url: { url } });
  }
  for (const url of audios) {
    content.push({ type: "audio_url", role: "reference_audio", audio_url: { url } });
  }
  return { content };
}
