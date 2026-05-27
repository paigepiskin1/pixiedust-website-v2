// Placeholder content for the public pages. Real data comes from D1 templates
// in Phase 5; this keeps Phase 3 visually complete and wired.
import { workspaceHref } from "./workspace";

export type Tone = "teal" | "lilac" | "mint" | "pink" | "noir" | "dusk" | "ice" | "amber";

export interface HeroSlide {
  tone: Tone;
  kicker: string;
  title: string; // may contain \n
  hot: string;
  dur: string;
  cta: string;
  cr: number;
  href: string;
  previewImage?: string;
  previewVideo?: string;
}

export const HERO_SLIDES: HeroSlide[] = [
  { tone: "lilac", kicker: "Motion transfer · viral this week", title: "Snakes wrapped,\nin 8 seconds.", hot: "428k uses", dur: "0:08", cta: "Try template", cr: 6, href: workspaceHref("motion", "snakes-wrap") },
  { tone: "pink", kicker: "Photo-to-life · trending", title: "Petals bloom\naround you.", hot: "312k uses", dur: "0:06", cta: "Try template", cr: 4, href: workspaceHref("i2v", "petals") },
  { tone: "dusk", kicker: "Cinematic · editor’s pick", title: "Noir chase,\nshot on Kling Pro.", hot: "186k uses", dur: "0:12", cta: "Open Movie Studio", cr: 8, href: workspaceHref("cinema", "noir-chase") },
  { tone: "mint", kicker: "Photoshoot pack", title: "Editorial Noir,\n24 frames.", hot: "156k uses", dur: "24 shots", cta: "Run pack", cr: 30, href: workspaceHref("shoot", "editorial-noir") },
];

export interface QuickTool {
  href: string;
  name: string;
  sub: string;
  tone: Tone;
  accent: string;
  glyph: string;
}

export const QUICK_TOOLS: QuickTool[] = [
  { href: "/presets", name: "Presets", sub: "120+ looks", tone: "amber", accent: "var(--pd-amber)", glyph: "◐" },
  { href: "/shoots", name: "Photoshoots", sub: "Themed packs", tone: "teal", accent: "var(--pd-teal)", glyph: "◑" },
  { href: "/video", name: "Video", sub: "Cinema · UGC", tone: "pink", accent: "var(--pd-pink)", glyph: "▷" },
  { href: "/motion", name: "Motion Transfer", sub: "Upload + swap", tone: "dusk", accent: "var(--pd-lilac)", glyph: "⇌" },
  { href: "/fashion", name: "Fashion Try-on", sub: "Wear anything", tone: "pink", accent: "var(--pd-pink)", glyph: "❖" },
  { href: "/beauty", name: "Beauty Studio", sub: "Hair · makeup", tone: "mint", accent: "var(--pd-mint)", glyph: "◐" },
  { href: "/avatar", name: "Avatar Studio", sub: "No training", tone: "lilac", accent: "var(--pd-lilac)", glyph: "✦" },
  { href: "/ad", name: "Ad Studio", sub: "Campaign-ready", tone: "amber", accent: "var(--pd-amber)", glyph: "⌘" },
];

export interface RailCard {
  type?: string;
  accent?: string;
  name: string;
  sub?: string;
  meta?: string;
  tone?: Tone;
  cr?: number;
  href?: string;
  previewImage?: string;
  previewVideo?: string;
}

export const TRENDING: RailCard[] = [
  { type: "Motion", accent: "var(--pd-lilac)", name: "Liquid metal", sub: "0:08 · 312k", meta: "0:08", tone: "ice", cr: 6, href: workspaceHref("motion", "liquid-metal") },
  { type: "Cinematic", accent: "var(--pd-mint)", name: "Noir alley", sub: "0:12 · 198k", meta: "0:12", tone: "amber", cr: 8, href: workspaceHref("cinema", "noir-chase") },
  { type: "Photoshoot", accent: "var(--pd-teal)", name: "Soft Siren", sub: "18 shots · 156k", meta: "18 shots", tone: "pink", cr: 18, href: workspaceHref("shoot", "soft-siren") },
  { type: "Motion", accent: "var(--pd-lilac)", name: "Petals bloom", sub: "0:06 · 124k", meta: "0:06", tone: "lilac", cr: 6, href: workspaceHref("i2v", "petals") },
  { type: "Fashion", accent: "var(--pd-pink)", name: "Runway fit", sub: "Try-on · 89k", meta: "2 cr", tone: "mint", cr: 2, href: workspaceHref("fashion", "runway") },
  { type: "Photoshoot", accent: "var(--pd-teal)", name: "Editorial Noir", sub: "24 shots · 142k", meta: "24 shots", tone: "noir", cr: 30, href: workspaceHref("shoot", "editorial-noir") },
  { type: "Cinematic", accent: "var(--pd-mint)", name: "Glass strut", sub: "0:08 · 78k", meta: "0:08", tone: "ice", cr: 8, href: workspaceHref("cinema", "glass-strut") },
  { type: "Motion", accent: "var(--pd-lilac)", name: "Y2K runway", sub: "0:10 · 67k", meta: "0:10", tone: "pink", cr: 6, href: workspaceHref("motion", "y2k-runway") },
];

const presetRaw: { name: string; sub: string; tone: Tone }[] = [
  { name: "Kodak Portra", sub: "35mm · warm", tone: "amber" },
  { name: "Cinestill 800T", sub: "Tungsten · halo", tone: "pink" },
  { name: "Y2K bubble", sub: "Glossy · pop", tone: "pink" },
  { name: "Wes Anderson", sub: "Pastel · symmetric", tone: "pink" },
  { name: "Anime", sub: "Bright · ink", tone: "lilac" },
  { name: "Ghibli", sub: "Soft · painterly", tone: "mint" },
  { name: "Tri-X 400", sub: "B&W · contrast", tone: "noir" },
  { name: "Liquid chrome", sub: "Metal · morph", tone: "ice" },
];

export const PRESET_TEASERS: RailCard[] = presetRaw.map((p) => ({
  ...p,
  type: "Preset",
  accent: "var(--pd-amber)",
  cr: 2,
  href: workspaceHref("preset", p.name),
}));

const beautyRaw: { name: string; sub: string; tone: Tone }[] = [
  { name: "Glazed glow", sub: "Makeup", tone: "pink" },
  { name: "Smoky noir", sub: "Makeup", tone: "dusk" },
  { name: "Copper bob", sub: "Hair", tone: "amber" },
  { name: "Curtain bangs", sub: "Hair", tone: "ice" },
  { name: "Berry stain", sub: "Lips", tone: "lilac" },
  { name: "Feather brow", sub: "Brows", tone: "teal" },
  { name: "Platinum", sub: "Hair", tone: "ice" },
  { name: "Sun-kissed", sub: "Makeup", tone: "amber" },
];

export const BEAUTY_LOOKS: RailCard[] = beautyRaw.map((b) => ({
  ...b,
  type: b.sub,
  accent: "var(--pd-mint)",
  cr: 1,
  href: workspaceHref("beauty", b.name),
}));
