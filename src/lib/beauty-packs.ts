// Beauty Studio data — premade makeup looks + the prompt builder. Mirrors the
// hair/tattoo studios. Supports: preset looks, a reference makeup photo (analyze
// + isolate the makeup and transfer it), and a "who to edit" target for photos
// with more than one person.

export interface MakeupLook {
  id: string;
  label: string;
  blurb: string;
  /** Design phrasing, slots into "Apply <fragment>". */
  prompt: string;
  preview: string;
}

export const MAKEUP_LOOKS: MakeupLook[] = [
  { id: "clean-girl", label: "Clean Girl", blurb: "Dewy, natural, nude", prompt: "a natural 'clean girl' makeup look — glowy dewy skin, lightly brushed-up brows, subtle bronzer, cream blush, minimal neutral eyeshadow, and glossy nude lips", preview: "https://pixiecdn.b-cdn.net/gen_d80b0323-9f76-44ee-bb08-a6aed948e196_1784140480907.jpg" },
  { id: "soft-glam", label: "Soft Glam", blurb: "Neutral eye + lashes", prompt: "a soft glam makeup look — neutral shimmer eyeshadow, subtle winged eyeliner, natural lashes, defined brows, soft contour, and mauve satin lips", preview: "https://pixiecdn.b-cdn.net/gen_d80b0323-9f76-44ee-bb08-a6aed948e196_1784140484080.jpg" },
  { id: "full-glam", label: "Full Glam", blurb: "Sculpted, dramatic", prompt: "a full glam makeup look — blended neutral smokey eyeshadow, sharp winged liner, dramatic voluminous lashes, sculpted contour and highlight, and nude glossy lips", preview: "https://pixiecdn.b-cdn.net/gen_d80b0323-9f76-44ee-bb08-a6aed948e196_1784140484365.jpg" },
  { id: "smokey-eye", label: "Smokey Eye", blurb: "Sultry dark eye", prompt: "a sultry smokey-eye makeup look — dark blended charcoal eyeshadow, smudged liner, full lashes, and matte nude lips", preview: "https://pixiecdn.b-cdn.net/gen_d80b0323-9f76-44ee-bb08-a6aed948e196_1784140485394.jpg" },
  { id: "red-lip", label: "Red Lip Classic", blurb: "Clean skin, bold lip", prompt: "a classic makeup look — clean glowy skin, a subtle neutral eye, defined brows, and a bold matte red lip", preview: "https://pixiecdn.b-cdn.net/gen_d80b0323-9f76-44ee-bb08-a6aed948e196_1784140482244.jpg" },
  { id: "bronze-goddess", label: "Bronze Goddess", blurb: "Warm, glowy, gold", prompt: "a warm bronze makeup look — gold and bronze shimmer eyeshadow, glowy sunkissed skin, bronzer, and warm nude-bronze lips", preview: "https://pixiecdn.b-cdn.net/gen_d80b0323-9f76-44ee-bb08-a6aed948e196_1784140493759.jpg" },
  { id: "sunkissed-blush", label: "Sunkissed Blush", blurb: "Blush + freckles", prompt: "a fresh sunkissed makeup look — rosy blush across the cheeks and nose, faux freckles, glossy lips, fluffy brows, and dewy skin", preview: "https://pixiecdn.b-cdn.net/gen_d80b0323-9f76-44ee-bb08-a6aed948e196_1784140491549.jpg" },
  { id: "graphic-liner", label: "Graphic Liner", blurb: "Editorial colored liner", prompt: "an editorial graphic eyeliner makeup look — a bold colored graphic winged liner, clean glowy skin, and nude lips", preview: "https://pixiecdn.b-cdn.net/gen_d80b0323-9f76-44ee-bb08-a6aed948e196_1784140495075.jpg" },
];

/** Who to apply the makeup to when a photo has more than one person. */
export const MAKEUP_TARGETS: { id: string; label: string; phrase: string }[] = [
  { id: "main", label: "Main subject", phrase: "the main person (the largest, most central face)" },
  { id: "everyone", label: "Everyone", phrase: "every person in the photo" },
  { id: "describe", label: "Describe…", phrase: "" },
];

/** Base instruction — edit makeup only, keep identity + everything else fixed. */
export const BEAUTY_BASE_RULE =
  "Generate an edited version of the input photo where ONLY the makeup is changed. " +
  "Keep the person's identity, facial features, face shape, bone structure, skin texture, hair, expression, pose, and background exactly the same — change nothing except the makeup. " +
  "Apply the makeup realistically and cleanly, blended naturally to their own skin tone. Do not beautify, slim, smooth, or reshape the face beyond applying makeup.";

export interface MakeupSelection {
  lookId?: string | null;
  hasReference?: boolean;
  targetId?: string;
  targetText?: string;
}

/** Resolve the "who to edit" phrase from the target selection. */
function targetPhrase(sel: MakeupSelection): string {
  const t = MAKEUP_TARGETS.find((x) => x.id === (sel.targetId || "main"));
  if (t?.id === "describe") return (sel.targetText || "").trim() || "the main person";
  return t?.phrase || "the main person";
}

/** Build the model prompt from a look/reference + the target person(s). */
export function buildBeautyPrompt(sel: MakeupSelection): string {
  const who = targetPhrase(sel);
  const look = sel.lookId ? MAKEUP_LOOKS.find((l) => l.id === sel.lookId) : null;
  let action = "";
  if (sel.hasReference) {
    action =
      `Look at the makeup worn by the person in the second reference image. Analyze and isolate ONLY their makeup — eyeshadow, eyeliner, lashes, brows, blush, contour, highlight, and lip color/finish — and recreate that same makeup look on ${who} in the first image. ` +
      "Do NOT copy the reference person's face, identity, skin tone, or features — transfer only the makeup, adapted naturally to the subject's own face and skin tone.";
  } else if (look) {
    action = `Apply ${look.prompt} to ${who}.`;
  } else {
    return "";
  }
  return `${BEAUTY_BASE_RULE} ${action}`;
}
