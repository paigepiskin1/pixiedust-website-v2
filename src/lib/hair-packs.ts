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
  /** Solid swatch color (CSS hex). Ignored when `swatch` is set. */
  hex: string;
  /** Optional CSS background for multi-tone swatches (gradient). */
  swatch?: string;
  /** Colour phrasing, slots into "Colour their hair <fragment>". */
  prompt: string;
  /** Optional color-reference photo (extra model input). */
  ref?: string;
}

export const HAIR_GENDERS: { id: HairGender; label: string }[] = [
  { id: "female", label: "Women's" },
  { id: "male", label: "Men's" },
];

export const HAIR_COLORS: HairColor[] = [
  { id: "keep", label: "Keep my color", hex: "", prompt: "" },

  // ── Solids ──
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

  // ── Multi-tone / chunky ──
  {
    id: "two-tone",
    label: "Two Tone",
    hex: "#ece6d6",
    swatch: "linear-gradient(180deg,#f2e6c8 0 48%,#1b1b1f 52% 100%)",
    prompt:
      "a bold two-tone color — bright blonde on the top/crown layers and deep black underneath (skunk / peekaboo contrast)",
  },
  {
    id: "y2k-chunky",
    label: "Y2K Chunky",
    hex: "#c99b5b",
    swatch: "linear-gradient(135deg,#f0e2b8 0 28%,#5a3a22 28% 55%,#f0e2b8 55% 78%,#5a3a22 78% 100%)",
    prompt:
      "Y2K chunky highlights and lowlights — thick alternating blonde and medium-brown strips throughout the hair",
  },
  {
    id: "black-blonde-chunky",
    label: "Black Blonde Chunky",
    hex: "#1b1b1f",
    swatch: "linear-gradient(135deg,#1b1b1f 0 35%,#f2e6c8 35% 55%,#1b1b1f 55% 75%,#f2e6c8 75% 100%)",
    prompt:
      "chunky black-and-blonde highlights — bold thick strips of platinum blonde woven through jet-black hair",
    ref: "https://pixiecdn.b-cdn.net/hair-refs/colors/black-blonde-chunky.jpg",
  },
  {
    id: "blonde-chunky",
    label: "Blonde Chunky",
    hex: "#e8d5a8",
    swatch: "linear-gradient(135deg,#6b4429 0 40%,#e8d5a8 40% 55%,#6b4429 55% 70%,#e8d5a8 70% 85%,#6b4429 85% 100%)",
    prompt:
      "subtle chunky blonde highlights — thicker-than-foil blonde pieces through a medium brown base, soft and dimensional rather than stark",
  },
  {
    id: "money-piece",
    label: "Money Piece",
    hex: "#f0e2b8",
    swatch: "linear-gradient(90deg,#f0e2b8 0 22%,#5a3a22 22% 78%,#f0e2b8 78% 100%)",
    prompt:
      "a money-piece color — bright blonde face-framing front pieces with the rest of the hair left a natural medium brown",
  },
  {
    id: "pink-black-chunky",
    label: "Pink Black Chunky",
    hex: "#e7b6c8",
    swatch: "linear-gradient(135deg,#1b1b1f 0 40%,#f4a7c2 40% 60%,#1b1b1f 60% 80%,#f4a7c2 80% 100%)",
    prompt:
      "chunky pink-and-black hair — bold thick strips of hot pastel pink woven through jet-black hair",
    ref: "https://pixiecdn.b-cdn.net/hair-refs/colors/pink-black-chunky.jpg",
  },

  // ── Solid pastels ──
  { id: "pastel-pink", label: "Pastel Pink", hex: "#e7b6c8", prompt: "a soft solid pastel pink" },
  { id: "pastel-lavender", label: "Pastel Lavender", hex: "#c9b6e7", prompt: "a soft solid pastel lavender purple" },
  { id: "pastel-lilac", label: "Pastel Lilac", hex: "#d8c4ef", prompt: "a soft solid pastel lilac" },
  { id: "pastel-mint", label: "Pastel Mint", hex: "#b6e7d4", prompt: "a soft solid pastel mint green" },
  { id: "pastel-blue", label: "Pastel Blue", hex: "#b6d4e7", prompt: "a soft solid pastel baby blue" },
  { id: "pastel-peach", label: "Pastel Peach", hex: "#f0c9b0", prompt: "a soft solid pastel peach" },
  { id: "pastel-yellow", label: "Pastel Yellow", hex: "#f0e6b0", prompt: "a soft solid pastel butter yellow" },
  { id: "icy-blue", label: "Icy Blue", hex: "#a9c7db", prompt: "an icy blue" },
];

export const HAIR_CUTS: HairCut[] = [
  // ── Women's ──
  {
    id: "f-long-layers",
    gender: "female",
    label: "Long Layers",
    blurb: "Soft face-framing layers",
    prompt:
      "a long layered haircut with soft face-framing layers, feathered ends, and natural movement like a salon layered blowout",
    preview: "https://pixiecdn.b-cdn.net/gen_d80b0323-9f76-44ee-bb08-a6aed948e196_1785682922459.jpg",
    ref: "https://pixiecdn.b-cdn.net/uploads/ry1mTnFZgZYzASRGD2N0A6TbW5k1/3f3d3515-7c51-4605-b7ea-3f0c519d2927.jpg",
  },
  {
    id: "f-long-wolf",
    gender: "female",
    label: "Long Wolf Cut",
    blurb: "Shaggy layers + curtain fringe",
    prompt:
      "a long wolf cut with shaggy disconnected layers, volume at the crown, face-framing pieces, and a soft curtain fringe",
    preview: "https://pixiecdn.b-cdn.net/gen_d80b0323-9f76-44ee-bb08-a6aed948e196_1785683040917.jpg",
    ref: "https://pixiecdn.b-cdn.net/uploads/ry1mTnFZgZYzASRGD2N0A6TbW5k1/8090eeca-8ca9-408d-b662-c5d706c25a8c.jpg",
  },
  {
    id: "f-short-wolf",
    gender: "female",
    label: "Short Wolf Cut",
    blurb: "Cropped shaggy wolf",
    prompt:
      "a short wolf cut with choppy layered fringe, textured shaggy crown, and shorter layered ends around the shoulders",
    preview: "https://pixiecdn.b-cdn.net/gen_d80b0323-9f76-44ee-bb08-a6aed948e196_1785683192326.jpg",
    ref: "https://pixiecdn.b-cdn.net/uploads/ry1mTnFZgZYzASRGD2N0A6TbW5k1/545be481-4153-4823-be74-19e3881286d7.jpg",
  },
  {
    id: "f-long-angles",
    gender: "female",
    label: "Long Angled Layers",
    blurb: "Sharp A-line layers",
    prompt:
      "long angled layers with a sharp A-line silhouette, longer in front, sleek face-framing pieces, and polished ends",
    preview: "https://pixiecdn.b-cdn.net/gen_d80b0323-9f76-44ee-bb08-a6aed948e196_1785683335992.jpg",
    ref: "https://pixiecdn.b-cdn.net/media/hair/refs/f-long-angles.jpg",
  },
  {
    id: "f-curtain-bangs",
    gender: "female",
    label: "Curtain Bangs",
    blurb: "Sabrina Carpenter style",
    prompt:
      "long hair with soft Sabrina Carpenter-style curtain bangs sweeping apart at the center, face-framing fringe, and glossy length",
    preview: "https://pixiecdn.b-cdn.net/gen_d80b0323-9f76-44ee-bb08-a6aed948e196_1785683460687.jpg",
    ref: "https://pixiecdn.b-cdn.net/uploads/ry1mTnFZgZYzASRGD2N0A6TbW5k1/35e97a44-13f8-4b86-95ed-d26bccf485b2.jpg",
  },
  {
    id: "f-long-straight",
    gender: "female",
    label: "Long Straight",
    blurb: "Sleek glossy length",
    prompt:
      "long sleek straight hair with a clean center or soft side part, glassy shine, and blunt polished ends",
    preview: "https://pixiecdn.b-cdn.net/gen_d80b0323-9f76-44ee-bb08-a6aed948e196_1785683572541.jpg",
    ref: "https://pixiecdn.b-cdn.net/uploads/ry1mTnFZgZYzASRGD2N0A6TbW5k1/a22bc279-10a0-41ae-b29e-99df3b80df6c.jpg",
  },
  {
    id: "f-long-curly",
    gender: "female",
    label: "Long Curly",
    blurb: "Defined bouncy curls",
    prompt:
      "long curly hair with defined springy curls, natural volume, and soft face-framing curl pieces",
    preview: "https://pixiecdn.b-cdn.net/gen_d80b0323-9f76-44ee-bb08-a6aed948e196_1785683696550.jpg",
    ref: "https://pixiecdn.b-cdn.net/uploads/ry1mTnFZgZYzASRGD2N0A6TbW5k1/eae83b93-beb7-4314-9359-4c225817ba77.jpg",
  },
  {
    id: "f-traditional-bob",
    gender: "female",
    label: "Traditional Bob",
    blurb: "Classic chin-length bob",
    prompt:
      "a classic traditional bob cut at chin length, soft rounded shape, light internal layering, and a clean polished finish",
    preview: "https://pixiecdn.b-cdn.net/gen_d80b0323-9f76-44ee-bb08-a6aed948e196_1785683827561.jpg",
    ref: "https://pixiecdn.b-cdn.net/uploads/ry1mTnFZgZYzASRGD2N0A6TbW5k1/b4ed556a-ee5f-4b70-ad94-0521b521262f.jpg",
  },
  {
    id: "f-flipped-bob",
    gender: "female",
    label: "Flipped-Out Bob",
    blurb: "Ends flicked out",
    prompt:
      "a chin-to-shoulder bob with flipped-out ends, soft bounce, and a retro blowout flip at the tips",
    preview: "https://pixiecdn.b-cdn.net/gen_d80b0323-9f76-44ee-bb08-a6aed948e196_1785683937083.jpg",
    ref: "https://pixiecdn.b-cdn.net/uploads/ry1mTnFZgZYzASRGD2N0A6TbW5k1/c78a01e7-6245-4b18-a4b0-714374bb1d07.jpg",
  },
  {
    id: "f-y2k-bob",
    gender: "female",
    label: "Y2K Bob",
    blurb: "Chunky early-2000s bob",
    prompt:
      "an early-2000s Y2K bob with chunky layers, slight flip, face-framing pieces, and glossy blowout volume",
    preview: "https://pixiecdn.b-cdn.net/gen_d80b0323-9f76-44ee-bb08-a6aed948e196_1785684053148.jpg",
    ref: "https://pixiecdn.b-cdn.net/uploads/ry1mTnFZgZYzASRGD2N0A6TbW5k1/d68d75b7-be46-4e80-bca6-94d3161b5ea0.jpg",
  },
  {
    id: "f-angled-bob",
    gender: "female",
    label: "Angled Bob",
    blurb: "90s Posh Spice bob",
    prompt:
      "a 1990s Victoria Beckham / Posh Spice angled bob — shorter in back, longer sharp points in front, sleek blowout, blunt polished ends",
    preview: "https://pixiecdn.b-cdn.net/gen_d80b0323-9f76-44ee-bb08-a6aed948e196_1785684184986.jpg",
  },
  {
    id: "f-pixie",
    gender: "female",
    label: "Pixie Cut",
    blurb: "Short & chic",
    prompt:
      "a chic short pixie cut with textured crown, softly tapered sides, and a light feathered fringe",
    preview: "https://pixiecdn.b-cdn.net/gen_d80b0323-9f76-44ee-bb08-a6aed948e196_1785684304667.jpg",
  },
  {
    id: "f-mullet",
    gender: "female",
    label: "Mullet",
    blurb: "Short front, long back",
    prompt:
      "a modern women's mullet with shorter layered front and sides, longer textured length in the back, and soft face-framing pieces",
    preview: "https://pixiecdn.b-cdn.net/gen_d80b0323-9f76-44ee-bb08-a6aed948e196_1785684423855.jpg",
  },
  {
    id: "f-long-mullet",
    gender: "female",
    label: "Long Mullet",
    blurb: "Grown-out shaggy mullet",
    prompt:
      "a long women's mullet with shaggy layered top and fringe, disconnected shorter sides, and much longer textured length down the back",
    preview: "https://pixiecdn.b-cdn.net/gen_d80b0323-9f76-44ee-bb08-a6aed948e196_1785684548329.jpg",
  },
  {
    id: "f-emo",
    gender: "female",
    label: "Emo Hair",
    blurb: "Side-swept emo layers",
    prompt:
      "an emo haircut with a heavy side-swept fringe covering one eye, choppy layered length, and razor-cut face-framing pieces",
    preview: "https://pixiecdn.b-cdn.net/gen_d80b0323-9f76-44ee-bb08-a6aed948e196_1785684738591.jpg",
  },
  {
    id: "f-scene-queen",
    gender: "female",
    label: "Scene Queen",
    blurb: "Choppy scene cut",
    prompt:
      "a scene queen haircut with choppy asymmetrical layers, heavy side-swept fringe, teased volume at the crown, and razor-cut ends",
    preview: "https://pixiecdn.b-cdn.net/gen_d80b0323-9f76-44ee-bb08-a6aed948e196_1785684852472.jpg",
  },
  {
    id: "f-afro",
    gender: "female",
    label: "Afro",
    blurb: "Full natural afro",
    prompt:
      "a full rounded natural afro with dense coily texture, even spherical shape, and soft volume framing the face",
    preview: "https://pixiecdn.b-cdn.net/gen_d80b0323-9f76-44ee-bb08-a6aed948e196_1785684989404.jpg",
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
      "Restyle their hair to closely match the hairstyle shown in the cut/style reference image — copy its cut, length, shape, layers and texture, but keep the person's own identity and face."
    );
    if (cut?.prompt) parts.push(`Aim for ${cut.prompt}.`);
  } else if (cut) {
    parts.push(`Give them ${cut.prompt}.`);
  }
  if (color?.ref) {
    parts.push(
      `Colour their hair to match the color pattern in the color reference image — aim for ${color.prompt}.`
    );
  } else if (color && color.prompt) {
    parts.push(`Colour their hair ${color.prompt}.`);
  }
  if (!parts.length) return "";
  return `${HAIR_BASE_RULE} ${parts.join(" ")}`;
}
