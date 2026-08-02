// Hair Studio data — colors, cuts (by gender), and the prompt builder. Mirrors
// the tattoo studio: each cut carries a `prompt` fragment + on-model `preview`.
// Optional `ref` is a style-reference photo sent as the second image input so
// GPT Image / nano-banana can match cut shape more faithfully.
// Reference-photo mode lets users try on a hairstyle from an uploaded image.

export type HairGender = "female" | "male";

export interface HairCut {
  id: string;
  gender: HairGender;
  label: string;
  blurb: string;
  /** Design phrasing, slots into "Give them <fragment>". */
  prompt: string;
  /** On-model cover shown in the cut gallery. */
  preview: string;
  /** Optional hairstyle reference image (second model input). */
  ref?: string;
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

/** Placeholder preview until on-model covers are regenerated. */
const PLACEHOLDER = "https://pixiecdn.b-cdn.net/uploads/ry1mTnFZgZYzASRGD2N0A6TbW5k1/c385e363-674d-47f2-ba24-89ae54eb8f55.webp";

export const HAIR_CUTS: HairCut[] = [
  // ── Women's ──
  {
    id: "f-long-layers",
    gender: "female",
    label: "Long Layers",
    blurb: "Soft face-framing layers",
    prompt:
      "a long layered haircut with soft face-framing layers, feathered ends, and natural movement like a salon layered blowout",
    preview: PLACEHOLDER,
    ref: "https://pixiecdn.b-cdn.net/uploads/ry1mTnFZgZYzASRGD2N0A6TbW5k1/3f3d3515-7c51-4605-b7ea-3f0c519d2927.jpg",
  },
  {
    id: "f-long-wolf",
    gender: "female",
    label: "Long Wolf Cut",
    blurb: "Shaggy layers + curtain fringe",
    prompt:
      "a long wolf cut with shaggy disconnected layers, volume at the crown, face-framing pieces, and a soft curtain fringe",
    preview: PLACEHOLDER,
    ref: "https://pixiecdn.b-cdn.net/uploads/ry1mTnFZgZYzASRGD2N0A6TbW5k1/8090eeca-8ca9-408d-b662-c5d706c25a8c.jpg",
  },
  {
    id: "f-short-wolf",
    gender: "female",
    label: "Short Wolf Cut",
    blurb: "Cropped shaggy wolf",
    prompt:
      "a short wolf cut with choppy layered fringe, textured shaggy crown, and shorter layered ends around the shoulders",
    preview: PLACEHOLDER,
    ref: "https://pixiecdn.b-cdn.net/uploads/ry1mTnFZgZYzASRGD2N0A6TbW5k1/545be481-4153-4823-be74-19e3881286d7.jpg",
  },
  {
    id: "f-long-angles",
    gender: "female",
    label: "Long Angled Layers",
    blurb: "Sharp A-line layers",
    prompt:
      "long angled layers with a sharp A-line silhouette, longer in front, sleek face-framing pieces, and polished ends",
    preview: PLACEHOLDER,
    ref: "https://i.pinimg.com/1200x/d3/18/21/d31821d081f4eff8632429cdb83a93d6.jpg",
  },
  {
    id: "f-curtain-bangs",
    gender: "female",
    label: "Curtain Bangs",
    blurb: "Sabrina Carpenter style",
    prompt:
      "long hair with soft Sabrina Carpenter-style curtain bangs sweeping apart at the center, face-framing fringe, and glossy length",
    preview: PLACEHOLDER,
    ref: "https://pixiecdn.b-cdn.net/uploads/ry1mTnFZgZYzASRGD2N0A6TbW5k1/35e97a44-13f8-4b86-95ed-d26bccf485b2.jpg",
  },
  {
    id: "f-long-straight",
    gender: "female",
    label: "Long Straight",
    blurb: "Sleek glossy length",
    prompt:
      "long sleek straight hair with a clean center or soft side part, glassy shine, and blunt polished ends",
    preview: PLACEHOLDER,
    ref: "https://pixiecdn.b-cdn.net/uploads/ry1mTnFZgZYzASRGD2N0A6TbW5k1/a22bc279-10a0-41ae-b29e-99df3b80df6c.jpg",
  },
  {
    id: "f-long-curly",
    gender: "female",
    label: "Long Curly",
    blurb: "Defined bouncy curls",
    prompt:
      "long curly hair with defined springy curls, natural volume, and soft face-framing curl pieces",
    preview: PLACEHOLDER,
    ref: "https://pixiecdn.b-cdn.net/uploads/ry1mTnFZgZYzASRGD2N0A6TbW5k1/eae83b93-beb7-4314-9359-4c225817ba77.jpg",
  },
  {
    id: "f-traditional-bob",
    gender: "female",
    label: "Traditional Bob",
    blurb: "Classic chin-length bob",
    prompt:
      "a classic traditional bob cut at chin length, soft rounded shape, light internal layering, and a clean polished finish",
    preview: PLACEHOLDER,
    ref: "https://pixiecdn.b-cdn.net/uploads/ry1mTnFZgZYzASRGD2N0A6TbW5k1/b4ed556a-ee5f-4b70-ad94-0521b521262f.jpg",
  },
  {
    id: "f-flipped-bob",
    gender: "female",
    label: "Flipped-Out Bob",
    blurb: "Ends flicked out",
    prompt:
      "a chin-to-shoulder bob with flipped-out ends, soft bounce, and a retro blowout flip at the tips",
    preview: PLACEHOLDER,
    ref: "https://pixiecdn.b-cdn.net/uploads/ry1mTnFZgZYzASRGD2N0A6TbW5k1/c78a01e7-6245-4b18-a4b0-714374bb1d07.jpg",
  },
  {
    id: "f-y2k-bob",
    gender: "female",
    label: "Y2K Bob",
    blurb: "Chunky early-2000s bob",
    prompt:
      "an early-2000s Y2K bob with chunky layers, slight flip, face-framing pieces, and glossy blowout volume",
    preview: PLACEHOLDER,
    ref: "https://pixiecdn.b-cdn.net/uploads/ry1mTnFZgZYzASRGD2N0A6TbW5k1/d68d75b7-be46-4e80-bca6-94d3161b5ea0.jpg",
  },
  {
    id: "f-angled-bob",
    gender: "female",
    label: "Angled Bob",
    blurb: "90s Posh Spice bob",
    prompt:
      "a 1990s Victoria Beckham / Posh Spice angled bob — shorter in back, longer sharp points in front, sleek blowout, blunt polished ends",
    preview: PLACEHOLDER,
  },
  {
    id: "f-pixie",
    gender: "female",
    label: "Pixie Cut",
    blurb: "Short & chic",
    prompt:
      "a chic short pixie cut with textured crown, softly tapered sides, and a light feathered fringe",
    preview: PLACEHOLDER,
  },
  {
    id: "f-mullet",
    gender: "female",
    label: "Mullet",
    blurb: "Short front, long back",
    prompt:
      "a modern women's mullet with shorter layered front and sides, longer textured length in the back, and soft face-framing pieces",
    preview: PLACEHOLDER,
  },
  {
    id: "f-long-mullet",
    gender: "female",
    label: "Long Mullet",
    blurb: "Grown-out shaggy mullet",
    prompt:
      "a long women's mullet with shaggy layered top and fringe, disconnected shorter sides, and much longer textured length down the back",
    preview: PLACEHOLDER,
  },
  {
    id: "f-emo",
    gender: "female",
    label: "Emo Hair",
    blurb: "Side-swept emo layers",
    prompt:
      "an emo haircut with a heavy side-swept fringe covering one eye, choppy layered length, and razor-cut face-framing pieces",
    preview: PLACEHOLDER,
  },
  {
    id: "f-scene-queen",
    gender: "female",
    label: "Scene Queen",
    blurb: "Choppy scene cut",
    prompt:
      "a scene queen haircut with choppy asymmetrical layers, heavy side-swept fringe, teased volume at the crown, and razor-cut ends",
    preview: PLACEHOLDER,
  },
  {
    id: "f-afro",
    gender: "female",
    label: "Afro",
    blurb: "Full natural afro",
    prompt:
      "a full rounded natural afro with dense coily texture, even spherical shape, and soft volume framing the face",
    preview: PLACEHOLDER,
  },

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
  if (sel.hasReference || cut?.ref) {
    parts.push(
      "Restyle their hair to closely match the hairstyle shown in the second reference image — copy its cut, length, shape, layers and texture, but keep the person's own identity and face."
    );
    if (cut?.prompt) parts.push(`Aim for ${cut.prompt}.`);
  } else if (cut) {
    parts.push(`Give them ${cut.prompt}.`);
  }
  if (color && color.prompt) parts.push(`Colour their hair ${color.prompt}.`);
  if (!parts.length) return "";
  return `${HAIR_BASE_RULE} ${parts.join(" ")}`;
}
