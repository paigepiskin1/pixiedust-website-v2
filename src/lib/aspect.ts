/**
 * Aspect helpers for models that only accept a discrete set of ratios
 * (notably openai/gpt-image-2 on Replicate).
 */

/** Ratios GPT Image 2 accepts as named aspect_ratio values (excl. pixel sizes / auto). */
export const GPT_IMAGE_RATIOS: ReadonlyArray<{ label: string; w: number; h: number }> = [
  { label: "1:1", w: 1, h: 1 },
  { label: "3:2", w: 3, h: 2 },
  { label: "2:3", w: 2, h: 3 },
  { label: "4:3", w: 4, h: 3 },
  { label: "3:4", w: 3, h: 4 },
  { label: "16:9", w: 16, h: 9 },
  { label: "9:16", w: 9, h: 16 },
];

export function isMatchAspect(aspect: string | null | undefined): boolean {
  return aspect === "original" || aspect === "match" || aspect === "match_input_image" || aspect === "auto";
}

/** Pick the named GPT Image ratio closest to the given pixel dimensions. */
export function nearestGptAspect(width: number, height: number): string {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return "auto";
  const r = width / height;
  let best = "1:1";
  let bestDiff = Infinity;
  for (const a of GPT_IMAGE_RATIOS) {
    const diff = Math.abs(r - a.w / a.h);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = a.label;
    }
  }
  return best;
}

/**
 * Resolve the aspect_ratio value to send for a GPT-Image model.
 * "original"/"match" → nearest ratio from upload dims when available, else "auto".
 * Other studio ratios map onto the supported GPT set.
 */
export function resolveGptImageAspect(
  aspect: string | null | undefined,
  imageWidth?: number | null,
  imageHeight?: number | null
): string {
  if (isMatchAspect(aspect)) {
    if (imageWidth && imageHeight) return nearestGptAspect(imageWidth, imageHeight);
    return "auto";
  }
  const map: Record<string, string> = {
    "1:1": "1:1",
    "3:2": "3:2",
    "2:3": "2:3",
    "4:3": "4:3",
    "3:4": "3:4",
    "16:9": "16:9",
    "9:16": "9:16",
    "4:5": "3:4",
    "5:4": "4:3",
    "21:9": "16:9",
    "9:21": "9:16",
  };
  if (aspect && map[aspect]) return map[aspect];
  if (aspect && GPT_IMAGE_RATIOS.some((a) => a.label === aspect)) return aspect;
  return "1:1";
}
