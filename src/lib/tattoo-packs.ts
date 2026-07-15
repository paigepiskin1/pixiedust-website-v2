// Premade tattoo packs for the Tattoo Studio (/avatar). Each pack targets one
// body area and carries a design `prompt` fragment that the studio combines
// into a single instruction for the try-on model (google/nano-banana-pro).
//
// `preview` is a marketing thumbnail (design shown on a model) hosted on Bunny.
// Adding a pack = append an entry here (and drop a preview image on the CDN).

export type TattooArea = "face" | "neck" | "arms" | "torso";

export interface TattooPack {
  id: string;
  area: TattooArea;
  label: string;
  blurb: string;
  /** Design + placement, phrased to slot into "Tattoos to apply: <fragment>". */
  prompt: string;
  /** Preview thumbnail (design shown on a model), hosted on Bunny. */
  preview: string;
}

export const AREAS: { id: TattooArea; label: string }[] = [
  { id: "face", label: "Face" },
  { id: "neck", label: "Neck" },
  { id: "arms", label: "Arms" },
  { id: "torso", label: "Torso" },
];

export const TATTOO_PACKS: TattooPack[] = [
  // ── Face ──────────────────────────────────────────────────────────
  {
    id: "face-baby-loyalty",
    area: "face",
    label: "Baby / Loyalty",
    blurb: "Script + snake, dagger, rose & butterfly",
    prompt:
      'on the RIGHT side of the face (viewer\'s left): a cursive "Baby" script with a small star cluster on the upper temple above the eyebrow arch, a fine-line snake with subtle scales running down the temple toward the cheekbone, and a small vertical dagger just beneath the outer corner of the eye; on the LEFT side of the face (viewer\'s right): a cursive "Loyalty" script with a small crescent-moon accent on the upper temple, a fine-line rose and flower vine running down the temple toward the cheekbone, and a detailed butterfly with open wings on the upper cheek below the outer eye',
    preview: "https://pixiecdn.b-cdn.net/gen_d80b0323-9f76-44ee-bb08-a6aed948e196_1784080311566.jpg",
  },
  {
    id: "face-angelic",
    area: "face",
    label: "Angelic",
    blurb: "Halo, delicate cross & stars",
    prompt:
      "a small halo with a little star cluster on one temple, a thin cursive word on the other temple, a delicate cross beneath the outer corner of one eye, and a few tiny stars scattered on the upper cheekbone — all fine-line and airy",
    preview: "https://pixiecdn.b-cdn.net/gen_d80b0323-9f76-44ee-bb08-a6aed948e196_1784080879316.jpg",
  },
  {
    id: "face-gothic",
    area: "face",
    label: "Gothic",
    blurb: "Spiderweb, teardrops & bat",
    prompt:
      "a small spiderweb at one temple, three tiny teardrops beneath the outer corner of one eye, a little bat on one cheekbone, and a small dagger on the other cheekbone — all fine-line and edgy",
    preview: "https://pixiecdn.b-cdn.net/gen_d80b0323-9f76-44ee-bb08-a6aed948e196_1784080879232.jpg",
  },
  // ── Neck ──────────────────────────────────────────────────────────
  {
    id: "neck-script",
    area: "neck",
    label: "Nape Script",
    blurb: "Cursive word down the neck",
    prompt: "an elegant cursive fine-line script word running down the side of the neck",
    preview: "https://pixiecdn.b-cdn.net/gen_d80b0323-9f76-44ee-bb08-a6aed948e196_1784080878505.jpg",
  },
  {
    id: "neck-butterfly",
    area: "neck",
    label: "Throat Butterfly",
    blurb: "Butterfly below the ear",
    prompt: "a delicate fine-line butterfly with open wings on the side of the neck just below the ear",
    preview: "https://pixiecdn.b-cdn.net/gen_d80b0323-9f76-44ee-bb08-a6aed948e196_1784080877865.jpg",
  },
  // ── Arms ──────────────────────────────────────────────────────────
  {
    id: "arm-floral",
    area: "arms",
    label: "Floral Forearm",
    blurb: "Rose & vine along the arm",
    prompt: "a fine-line rose and flowing vine with leaves running along the forearm",
    preview: "https://pixiecdn.b-cdn.net/gen_d80b0323-9f76-44ee-bb08-a6aed948e196_1784080875924.jpg",
  },
  {
    id: "arm-snake",
    area: "arms",
    label: "Snake Wrap",
    blurb: "Snake around the forearm",
    prompt: "a fine-line snake with subtle scales wrapping around the forearm",
    preview: "https://pixiecdn.b-cdn.net/gen_d80b0323-9f76-44ee-bb08-a6aed948e196_1784080888023.jpg",
  },
  // ── Torso ─────────────────────────────────────────────────────────
  {
    id: "torso-sternum",
    area: "torso",
    label: "Sternum Ornament",
    blurb: "Symmetrical sternum piece",
    prompt:
      "an ornamental, symmetrical fine-line piece running down the sternum with delicate linework and a small crescent moon",
    preview: "https://pixiecdn.b-cdn.net/gen_d80b0323-9f76-44ee-bb08-a6aed948e196_1784080886262.jpg",
  },
  {
    id: "torso-script",
    area: "torso",
    label: "Collarbone Script",
    blurb: "Script below the collarbone",
    prompt: "a fine-line cursive script word just below the collarbone across the upper chest",
    preview: "https://pixiecdn.b-cdn.net/gen_d80b0323-9f76-44ee-bb08-a6aed948e196_1784080889174.jpg",
  },
];

/** Base instruction shared by every generation — enforces skin-only + occlusion. */
export const TATTOO_BASE_RULE =
  "Add the following as delicate fine-line black-and-grey tattoos, inked realistically on the person's skin. " +
  "Keep their identity, features, pose, hair, skin tone, lighting and background completely unchanged. " +
  "Place tattoos ONLY on bare, visible skin — never on hair, eyebrows, eyes, lips, jewelry, or clothing. " +
  "Wherever hair or clothing falls in front of the skin, it must stay on top and occlude the tattoos so they look like real ink on the skin beneath. " +
  "Follow the body's natural contours, perspective and lighting, with balanced symmetry. Do not add tattoos anywhere not specified.";

/** Build the final model prompt from the selected pack ids (order preserved). */
export function buildTattooPrompt(packIds: string[]): string {
  const byId = new Map(TATTOO_PACKS.map((p) => [p.id, p]));
  const frags = packIds.map((id) => byId.get(id)?.prompt).filter(Boolean) as string[];
  if (!frags.length) return "";
  return `${TATTOO_BASE_RULE} Tattoos to apply: ${frags.join("; ")}.`;
}
