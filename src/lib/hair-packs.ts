// Hair Studio data — colors, cuts (by gender), and the prompt builder. Mirrors
// the tattoo studio: each cut carries a `prompt` fragment + on-model `preview`.
// Reference-photo mode lets users try on a hairstyle from an uploaded image.

export type HairGender = "female" | "male";

export interface HairCut {
  id: string;
  gender: HairGender;
  label: string;
  blurb: string;
  /** Design phrasing, slots into "Give them <fragment>". */
  prompt: string;
  preview: string;
}

export interface HairColor {
  id: string;
  label: string;
  /** Swatch color (CSS). */
  hex: string;
  /** Colour phrasing, slots into "Colour their hair <fragment>". */
  prompt: string;
}

export const HAIR_GENDERS: { id: HairGender; label: string }[] = [
  { id: "female", label: "Women's" },
  { id: "male", label: "Men's" },
];

export const HAIR_COLORS: HairColor[] = [
  { id: "keep", label: "Keep my color", hex: "", prompt: "" },
  { id: "jet-black", label: "Jet Black", hex: "#1b1b1f", prompt: "a deep jet-black" },
  { id: "dark-brown", label: "Dark Brown", hex: "#3b2417", prompt: "a rich dark brown" },
  { id: "chestnut", label: "Chestnut", hex: "#6b4429", prompt: "a warm chestnut brown" },
  { id: "caramel", label: "Caramel", hex: "#a86b3c", prompt: "a caramel brown" },
  { id: "honey-blonde", label: "Honey Blonde", hex: "#c99b5b", prompt: "a honey blonde" },
  { id: "platinum", label: "Platinum", hex: "#ece6d6", prompt: "an icy platinum blonde" },
  { id: "auburn", label: "Auburn", hex: "#7a3418", prompt: "a deep auburn" },
  { id: "copper", label: "Copper Red", hex: "#b5502a", prompt: "a vivid copper red" },
  { id: "burgundy", label: "Burgundy", hex: "#5a1f2a", prompt: "a burgundy wine" },
  { id: "silver", label: "Silver", hex: "#c8c8cf", prompt: "a silver grey" },
  { id: "rose-gold", label: "Rose Gold", hex: "#d9a7a0", prompt: "a soft rose-gold" },
  { id: "pastel-pink", label: "Pastel Pink", hex: "#e7b6c8", prompt: "a pastel pink" },
  { id: "icy-blue", label: "Icy Blue", hex: "#a9c7db", prompt: "an icy blue" },
];

export const HAIR_CUTS: HairCut[] = [
  // ── Women's ──
  { id: "f-long-layers", gender: "female", label: "Long Layers", blurb: "Soft face-framing layers", prompt: "a long, layered haircut with soft face-framing layers", preview: "https://pixiecdn.b-cdn.net/gen_d80b0323-9f76-44ee-bb08-a6aed948e196_1784086859701.jpg" },
  { id: "f-blunt-bob", gender: "female", label: "Blunt Bob", blurb: "Sleek jaw-length bob", prompt: "a sleek blunt bob cut at jaw length", preview: "https://pixiecdn.b-cdn.net/gen_d80b0323-9f76-44ee-bb08-a6aed948e196_1784086860725.jpg" },
  { id: "f-curtain-bangs", gender: "female", label: "Curtain Bangs", blurb: "Face-framing fringe", prompt: "long hair with curtain bangs framing the face", preview: "https://pixiecdn.b-cdn.net/gen_d80b0323-9f76-44ee-bb08-a6aed948e196_1784086860575.jpg" },
  { id: "f-beach-waves", gender: "female", label: "Beach Waves", blurb: "Tousled natural waves", prompt: "long tousled beachy waves with natural volume", preview: "https://pixiecdn.b-cdn.net/gen_d80b0323-9f76-44ee-bb08-a6aed948e196_1784086861270.jpg" },
  { id: "f-pixie", gender: "female", label: "Pixie Cut", blurb: "Short & chic", prompt: "a short cropped pixie cut", preview: "https://pixiecdn.b-cdn.net/gen_d80b0323-9f76-44ee-bb08-a6aed948e196_1784086859182.jpg" },
  { id: "f-sleek-straight", gender: "female", label: "Sleek Straight", blurb: "Glossy center part", prompt: "long sleek straight glossy hair with a center part", preview: "https://pixiecdn.b-cdn.net/gen_d80b0323-9f76-44ee-bb08-a6aed948e196_1784086871329.jpg" },
  // ── Men's ──
  { id: "m-textured-crop", gender: "male", label: "Textured Crop", blurb: "Short crop + fringe", prompt: "a short textured crop haircut with a small fringe", preview: "https://pixiecdn.b-cdn.net/gen_d80b0323-9f76-44ee-bb08-a6aed948e196_1784086866479.jpg" },
  { id: "m-fade-quiff", gender: "male", label: "Fade + Quiff", blurb: "Skin fade, quiff on top", prompt: "a skin fade on the sides with a voluminous quiff on top", preview: "https://pixiecdn.b-cdn.net/gen_d80b0323-9f76-44ee-bb08-a6aed948e196_1784086869917.jpg" },
  { id: "m-buzz", gender: "male", label: "Buzz Cut", blurb: "Clean & very short", prompt: "a very short buzz cut", preview: "https://pixiecdn.b-cdn.net/gen_d80b0323-9f76-44ee-bb08-a6aed948e196_1784086871958.jpg" },
  { id: "m-pompadour", gender: "male", label: "Pompadour", blurb: "Volume up & back", prompt: "a classic pompadour with volume swept up and back and tapered sides", preview: "https://pixiecdn.b-cdn.net/gen_d80b0323-9f76-44ee-bb08-a6aed948e196_1784086881310.jpg" },
  { id: "m-slick-back", gender: "male", label: "Slicked Back", blurb: "Sleek, tapered sides", prompt: "medium slicked-back hair with tapered sides", preview: "https://pixiecdn.b-cdn.net/gen_d80b0323-9f76-44ee-bb08-a6aed948e196_1784086871216.jpg" },
  { id: "m-curly-top", gender: "male", label: "Curly Top", blurb: "Curls + faded sides", prompt: "a curly top with faded sides", preview: "https://pixiecdn.b-cdn.net/gen_d80b0323-9f76-44ee-bb08-a6aed948e196_1784086876550.jpg" },
];

/** Base instruction — restyle hair only, keep everything else identical. */
export const HAIR_BASE_RULE =
  "Generate an edited version of the input photo in which ONLY the person's hair is restyled. " +
  "Keep their face, identity, facial features, skin tone, expression, pose, body, clothing and background exactly the same — change nothing except the hair. " +
  "Make the new hair look photorealistic and natural, matching the person's head shape and the scene's lighting and perspective.";

export interface HairSelection {
  cutId?: string | null;
  colorId?: string | null;
  hasReference?: boolean;
}

/** Build the model prompt from a cut, a color, and/or a reference-photo flag. */
export function buildHairPrompt(sel: HairSelection): string {
  const cut = sel.cutId ? HAIR_CUTS.find((c) => c.id === sel.cutId) : null;
  const color = sel.colorId ? HAIR_COLORS.find((c) => c.id === sel.colorId) : null;
  const parts: string[] = [];
  if (sel.hasReference) {
    parts.push(
      "Restyle their hair to closely match the hairstyle shown in the second reference image — copy its cut, length, shape and texture, but keep the person's own identity and face."
    );
  } else if (cut) {
    parts.push(`Give them ${cut.prompt}.`);
  }
  if (color && color.prompt) parts.push(`Colour their hair ${color.prompt}.`);
  if (!parts.length) return "";
  return `${HAIR_BASE_RULE} ${parts.join(" ")}`;
}
