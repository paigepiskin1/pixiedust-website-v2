// Placeholder catalog datasets for the tool pages. Real templates come from D1
// in Phase 5. Each item carries a category `c` (for client-side filtering),
// a `tag` pill label, a tone, an accent var, credit cost, and a workspace href.
import { workspaceHref } from "./workspace";
import type { Tone } from "./content";

export interface CatalogItem {
  name: string;
  sub?: string;
  tag?: string;
  meta?: string;
  tone: Tone;
  accent: string;
  cr?: number;
  c?: string; // category (for filtering)
  href: string;
  previewImage?: string;
  previewVideo?: string;
}

const AMBER = "var(--pd-amber)";
const TEAL = "var(--pd-teal)";
const PINK = "var(--pd-pink)";
const LILAC = "var(--pd-lilac)";
const MINT = "var(--pd-mint)";

// ─── Presets ───────────────────────────────────────────────
export const PRESET_CATS = ["All", "Film", "Era", "Y2K", "Creative", "Professional", "Cameras", "Color grades", "Mood"];
const presetRaw: Omit<CatalogItem, "accent" | "cr" | "href">[] = [
  { name: "Kodak Portra", sub: "35mm · warm skin", tone: "amber", tag: "Film", c: "Film" },
  { name: "Kodak Gold", sub: "Sunny · honey", tone: "dusk", tag: "Film", c: "Film" },
  { name: "Cinestill 800T", sub: "Tungsten · halo", tone: "pink", tag: "Film", c: "Film" },
  { name: "Fuji Pro 400H", sub: "Pastel · airy", tone: "mint", tag: "Film", c: "Film" },
  { name: "Tri-X 400", sub: "B&W · contrast", tone: "noir", tag: "Film", c: "Film" },
  { name: "Ektachrome", sub: "Slide · vivid", tone: "teal", tag: "Film", c: "Film" },
  { name: "1970s", sub: "Film · grain", tone: "amber", tag: "Era", c: "Era" },
  { name: "1980s", sub: "Neon · synth", tone: "pink", tag: "Era", c: "Era" },
  { name: "1990s", sub: "Disposable", tone: "lilac", tag: "Era", c: "Era" },
  { name: "Y2K bubble", sub: "Glossy · pop", tone: "pink", tag: "Y2K", c: "Y2K" },
  { name: "Liquid chrome", sub: "Metal · morph", tone: "ice", tag: "Y2K", c: "Y2K" },
  { name: "Frosted glass", sub: "Soft · tint", tone: "mint", tag: "Y2K", c: "Y2K" },
  { name: "CD shimmer", sub: "Iridescent", tone: "lilac", tag: "Y2K", c: "Y2K" },
  { name: "Anime", sub: "Bright · ink", tone: "lilac", tag: "Creative", c: "Creative" },
  { name: "Ghibli", sub: "Soft · painterly", tone: "mint", tag: "Creative", c: "Creative" },
  { name: "Oil paint", sub: "Classic · rich", tone: "amber", tag: "Creative", c: "Creative" },
  { name: "Watercolor", sub: "Wet · bleed", tone: "ice", tag: "Creative", c: "Creative" },
  { name: "Pixar 3D", sub: "Soft · render", tone: "mint", tag: "Creative", c: "Creative" },
  { name: "Claymation", sub: "Tactile · stop-mo", tone: "pink", tag: "Creative", c: "Creative" },
  { name: "LinkedIn", sub: "Corporate · clean", tone: "ice", tag: "Pro", c: "Professional" },
  { name: "Vogue", sub: "Fashion · lit", tone: "pink", tag: "Pro", c: "Professional" },
  { name: "Magazine", sub: "Editorial · cover", tone: "noir", tag: "Pro", c: "Professional" },
  { name: "Headshot", sub: "Studio · key", tone: "dusk", tag: "Pro", c: "Professional" },
  { name: "Disposable", sub: "Flash · grain", tone: "pink", tag: "Camera", c: "Cameras" },
  { name: "Polaroid 600", sub: "Instant", tone: "amber", tag: "Camera", c: "Cameras" },
  { name: "CCTV", sub: "Lo-fi · timestamp", tone: "noir", tag: "Camera", c: "Cameras" },
  { name: "Camcorder", sub: "VHS · bleed", tone: "teal", tag: "Camera", c: "Cameras" },
  { name: "Drone", sub: "Aerial · 4K", tone: "teal", tag: "Camera", c: "Cameras" },
  { name: "Fisheye", sub: "180° · warp", tone: "lilac", tag: "Camera", c: "Cameras" },
  { name: "Teal & Orange", sub: "Blockbuster", tone: "teal", tag: "Grade", c: "Color grades" },
  { name: "Wes Anderson", sub: "Pastel · symmetric", tone: "pink", tag: "Grade", c: "Color grades" },
  { name: "Blade Runner", sub: "Magenta · neon", tone: "lilac", tag: "Grade", c: "Color grades" },
  { name: "Fincher green", sub: "Cool · low key", tone: "mint", tag: "Grade", c: "Color grades" },
  { name: "Dreamy", sub: "Soft glow", tone: "lilac", tag: "Mood", c: "Mood" },
  { name: "Melancholy", sub: "Cold · blue", tone: "ice", tag: "Mood", c: "Mood" },
  { name: "Sun-kissed", sub: "Warm haze", tone: "amber", tag: "Mood", c: "Mood" },
  { name: "Ethereal", sub: "Milky · light", tone: "mint", tag: "Mood", c: "Mood" },
];
export const PRESETS: CatalogItem[] = presetRaw.map((p) => ({ ...p, accent: AMBER, cr: 2, href: workspaceHref("preset", p.name) }));

// ─── Photoshoots ───────────────────────────────────────────
export const SHOOT_CATS = ["All", "Editorial", "Professional", "Glamour", "Lifestyle", "Fantasy"];
const shootRaw: Omit<CatalogItem, "accent" | "href">[] = [
  { name: "Editorial Noir", sub: "24 shots · $4.99", tag: "Popular", tone: "noir", c: "Editorial", cr: 30 },
  { name: "Soft Siren", sub: "18 shots · $3.99", tone: "pink", c: "Glamour", cr: 22 },
  { name: "LinkedIn Pro", sub: "12 shots · $2.99", tone: "ice", c: "Professional", cr: 15 },
  { name: "Vogue Editorial", sub: "24 shots · $4.99", tag: "New", tone: "pink", c: "Editorial", cr: 30 },
  { name: "Café Lifestyle", sub: "18 shots · $3.99", tone: "amber", c: "Lifestyle", cr: 22 },
  { name: "Boudoir", sub: "24 shots · $5.99", tone: "dusk", c: "Glamour", cr: 36 },
  { name: "CEO Headshots", sub: "12 shots · $2.99", tone: "noir", c: "Professional", cr: 15 },
  { name: "Fairy tale", sub: "24 shots · $4.99", tone: "lilac", c: "Fantasy", cr: 30 },
  { name: "Y2K mall girl", sub: "18 shots · $3.99", tag: "Trending", tone: "pink", c: "Lifestyle", cr: 22 },
  { name: "Old Hollywood", sub: "24 shots · $4.99", tone: "noir", c: "Editorial", cr: 30 },
  { name: "Coffee shop", sub: "18 shots · $3.99", tone: "amber", c: "Lifestyle", cr: 22 },
  { name: "Cyber goddess", sub: "24 shots · $5.99", tone: "lilac", c: "Fantasy", cr: 36 },
];
export const SHOOTS: CatalogItem[] = shootRaw.map((p) => ({ ...p, accent: TEAL, href: workspaceHref("shoot", p.name) }));

// ─── Video ─────────────────────────────────────────────────
export const VIDEO_CATS = ["All", "Cinematic", "Photo-to-life", "Fashion", "Video Game"];
const videoKind = (c: string) =>
  c === "Cinematic" ? "cinema" : c === "Fashion" ? "fashion-video" : c === "Video Game" ? "game-video" : "i2v";
const videoRaw: Omit<CatalogItem, "accent" | "href">[] = [
  { name: "Snakes wrapped", sub: "Photo-to-life", meta: "0:08", tag: "Trending", tone: "lilac", c: "Photo-to-life", cr: 6 },
  { name: "Petals bloom", sub: "Photo-to-life", meta: "0:06", tone: "pink", c: "Photo-to-life", cr: 4 },
  { name: "Glass shatter", sub: "Photo-to-life", meta: "0:08", tone: "mint", c: "Photo-to-life", cr: 6 },
  { name: "Noir chase", sub: "Cinematic", meta: "0:12", tag: "Editor", tone: "dusk", c: "Cinematic", cr: 8 },
  { name: "Café main char", sub: "Cinematic", meta: "0:10", tone: "amber", c: "Cinematic", cr: 8 },
  { name: "Action scene", sub: "Cinematic", meta: "0:12", tone: "noir", c: "Cinematic", cr: 10 },
  { name: "Y2K runway", sub: "Fashion", meta: "0:10", tone: "pink", c: "Fashion", cr: 6 },
  { name: "Couture walk", sub: "Fashion", meta: "0:08", tone: "noir", c: "Fashion", cr: 6 },
  { name: "Cyberpunk run", sub: "Video Game", meta: "0:08", tone: "lilac", c: "Video Game", cr: 8 },
  { name: "Anime opening", sub: "Video Game", meta: "0:10", tone: "pink", c: "Video Game", cr: 8 },
  { name: "GTA cutscene", sub: "Video Game", meta: "0:10", tone: "amber", c: "Video Game", cr: 8 },
  { name: "Neon arcade", sub: "Video Game", meta: "0:08", tone: "pink", c: "Video Game", cr: 8 },
];
export const VIDEO: CatalogItem[] = videoRaw.map((p) => ({ ...p, accent: PINK, href: workspaceHref(videoKind(p.c || ""), p.name) }));

// ─── Motion ────────────────────────────────────────────────
const motionRaw: Omit<CatalogItem, "accent" | "href">[] = [
  { name: "TikTok trend", sub: "Dance", meta: "0:06", tag: "Trending", tone: "lilac", cr: 6 },
  { name: "Glass strut", sub: "Walk", meta: "0:08", tone: "ice", cr: 6 },
  { name: "Snakes wrap", sub: "Body morph", meta: "0:08", tag: "Hot", tone: "lilac", cr: 8 },
  { name: "Y2K runway", sub: "Walk · strut", meta: "0:10", tone: "pink", cr: 8 },
  { name: "Savage dance", sub: "Choreo", meta: "0:06", tone: "pink", cr: 6 },
  { name: "Slow-mo spin", sub: "Dramatic", meta: "0:08", tone: "amber", cr: 6 },
  { name: "Action stunt", sub: "Stunt", meta: "0:10", tone: "noir", cr: 8 },
  { name: "Fashion week", sub: "Walk", meta: "0:12", tone: "dusk", cr: 8 },
];
export const MOTION: CatalogItem[] = motionRaw.map((p) => ({ ...p, accent: LILAC, href: workspaceHref("motion", p.name) }));

// ─── Beauty ────────────────────────────────────────────────
export const BEAUTY_CATS = ["All", "Makeup", "Hair", "Lips", "Brows", "Skin"];
const beautyRaw: Omit<CatalogItem, "accent" | "href">[] = [
  { name: "Glazed glow", sub: "Makeup", tag: "Hot", tone: "pink", c: "Makeup", cr: 1 },
  { name: "Smoky noir", sub: "Makeup", tone: "dusk", c: "Makeup", cr: 1 },
  { name: "Sun-kissed", sub: "Makeup", tone: "amber", c: "Makeup", cr: 1 },
  { name: "Doll", sub: "Makeup", tone: "pink", c: "Makeup", cr: 1 },
  { name: "Copper bob", sub: "Hair", tone: "amber", c: "Hair", cr: 1 },
  { name: "Curtain bangs", sub: "Hair", tone: "ice", c: "Hair", cr: 1 },
  { name: "Platinum blonde", sub: "Hair", tone: "ice", c: "Hair", cr: 1 },
  { name: "Long waves", sub: "Hair", tone: "amber", c: "Hair", cr: 1 },
  { name: "Berry stain", sub: "Lips", tag: "New", tone: "lilac", c: "Lips", cr: 1 },
  { name: "Glossy nude", sub: "Lips", tone: "amber", c: "Lips", cr: 1 },
  { name: "Feather brow", sub: "Brows", tone: "teal", c: "Brows", cr: 1 },
  { name: "Glass skin", sub: "Skin", tone: "mint", c: "Skin", cr: 1 },
];
export const BEAUTY: CatalogItem[] = beautyRaw.map((p) => ({ ...p, accent: MINT, href: workspaceHref("beauty", p.name) }));

// ─── Fashion ───────────────────────────────────────────────
const fashionRaw: Omit<CatalogItem, "accent" | "href" | "tag">[] = [
  { name: "Coastal grandma", sub: "Casual", tone: "mint", cr: 2 },
  { name: "Streetwear", sub: "Casual", tone: "noir", cr: 2 },
  { name: "Y2K mall", sub: "Casual", tone: "pink", cr: 2 },
  { name: "Black tie", sub: "Formal", tone: "dusk", cr: 2 },
  { name: "Cocktail", sub: "Formal", tone: "amber", cr: 2 },
  { name: "Runway editorial", sub: "Editorial", tone: "lilac", cr: 3 },
  { name: "Athleisure", sub: "Sport", tone: "mint", cr: 2 },
  { name: "Vintage 70s", sub: "Throwback", tone: "amber", cr: 2 },
];
export const FASHION: CatalogItem[] = fashionRaw.map((p) => ({ ...p, accent: PINK, tag: "Try-on", href: workspaceHref("fashion", p.name) }));

// ─── Avatar ────────────────────────────────────────────────
const avatarRaw: Omit<CatalogItem, "accent" | "href" | "tag">[] = [
  { name: "Editorial me", sub: "Studio", tone: "noir", cr: 4 },
  { name: "Anime self", sub: "Stylized", tone: "lilac", cr: 4 },
  { name: "Pixar me", sub: "3D", tone: "mint", cr: 4 },
  { name: "Cyber model", sub: "Stylized", tone: "lilac", cr: 4 },
  { name: "Renaissance", sub: "Painterly", tone: "amber", cr: 4 },
  { name: "Y2K avatar", sub: "Stylized", tone: "pink", cr: 4 },
  { name: "Cottagecore", sub: "Soft", tone: "mint", cr: 4 },
  { name: "Goth", sub: "Dark", tone: "noir", cr: 4 },
];
export const AVATAR: CatalogItem[] = avatarRaw.map((p) => ({ ...p, accent: LILAC, tag: "Avatar", href: workspaceHref("avatar", p.name) }));

// ─── Ad ────────────────────────────────────────────────────
const adRaw: Omit<CatalogItem, "accent" | "href" | "tag">[] = [
  { name: "Product hero", sub: "E-commerce", tone: "mint", cr: 4 },
  { name: "Lifestyle ad", sub: "Campaign", tone: "amber", cr: 4 },
  { name: "UGC review", sub: "Social", tone: "pink", cr: 6 },
  { name: "Outdoor billboard", sub: "Print", tone: "noir", cr: 4 },
  { name: "Beauty before/after", sub: "Beauty", tone: "pink", cr: 4 },
  { name: "Cinematic ad", sub: "Video", tone: "dusk", cr: 10 },
  { name: "Founder portrait", sub: "Brand", tone: "ice", cr: 4 },
  { name: "Studio packshot", sub: "Product", tone: "noir", cr: 4 },
];
export const AD: CatalogItem[] = adRaw.map((p) => ({ ...p, accent: AMBER, tag: "Ad", href: workspaceHref("ad", p.name) }));

// ─── Trending grid ─────────────────────────────────────────
const trendKind: Record<string, string> = {
  Motion: "motion",
  "Photo-to-life": "i2v",
  Cinematic: "cinema",
  Photoshoot: "shoot",
  Beauty: "beauty",
  Preset: "preset",
  "Color grade": "preset",
  Avatar: "avatar",
};
const trendRaw: { name: string; sub: string; tag: string; meta: string; tone: Tone; cr: number; accent: string }[] = [
  { name: "Snakes wrapped", sub: "Motion", tag: "#1", meta: "428k", tone: "lilac", cr: 8, accent: LILAC },
  { name: "Petals bloom", sub: "Photo-to-life", tag: "#2", meta: "312k", tone: "pink", cr: 6, accent: PINK },
  { name: "Liquid metal", sub: "Motion", tag: "#3", meta: "298k", tone: "ice", cr: 6, accent: LILAC },
  { name: "Y2K runway", sub: "Motion", tag: "#4", meta: "221k", tone: "pink", cr: 6, accent: LILAC },
  { name: "Noir alley", sub: "Cinematic", tag: "#5", meta: "198k", tone: "amber", cr: 8, accent: MINT },
  { name: "Soft Siren", sub: "Photoshoot", tag: "#6", meta: "156k", tone: "pink", cr: 22, accent: TEAL },
  { name: "Glass strut", sub: "Motion", tag: "#7", meta: "124k", tone: "ice", cr: 6, accent: LILAC },
  { name: "Editorial Noir", sub: "Photoshoot", tag: "#8", meta: "142k", tone: "noir", cr: 30, accent: TEAL },
  { name: "Glazed glow", sub: "Beauty", tag: "#9", meta: "108k", tone: "pink", cr: 1, accent: MINT },
  { name: "Cinestill 800T", sub: "Preset", tag: "#10", meta: "94k", tone: "pink", cr: 2, accent: AMBER },
  { name: "Wes Anderson", sub: "Color grade", tag: "#11", meta: "88k", tone: "pink", cr: 2, accent: AMBER },
  { name: "Anime self", sub: "Avatar", tag: "#12", meta: "76k", tone: "lilac", cr: 4, accent: LILAC },
];
export const TRENDING_GRID: CatalogItem[] = trendRaw.map((p) => ({ ...p, href: workspaceHref(trendKind[p.sub] || "preset", p.name) }));
