// Shared navigation model for the sidebar + mobile drawer.
// `href` are real routes (Astro MPA); active state is computed from the URL.

export type IconName =
  | "home"
  | "trending"
  | "gallery"
  | "wand"
  | "camera"
  | "film"
  | "motion"
  | "shirt"
  | "beauty"
  | "sparkle"
  | "ad"
  | "scissors"
  | "gift";

export interface NavItem {
  href: string;
  name: string;
  icon: IconName;
  /** CSS var name for the accent used on active state (e.g. "--pd-amber"). */
  accent?: string;
}

/** A labelled sub-group of items within a section (e.g. "Image" / "Video"). */
export interface NavGroup {
  label: string;
  items: NavItem[];
}

export interface NavSection {
  label: string;
  /** Flat items (most sections). */
  items?: NavItem[];
  /** Optional labelled sub-categories rendered under the section heading. */
  groups?: NavGroup[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    label: "Discover",
    items: [
      { href: "/", name: "Home", icon: "home" },
      { href: "/trending", name: "Trending", icon: "trending" },
      { href: "/gallery", name: "My creations", icon: "gallery" },
      { href: "/invite", name: "Invite friends", icon: "gift", accent: "--pd-mint" },
    ],
  },
  {
    label: "Tools",
    items: [
      { href: "/presets", name: "Presets", icon: "wand", accent: "--pd-amber" },
      { href: "/shoots", name: "Photoshoots", icon: "camera", accent: "--pd-teal" },
      { href: "/video", name: "Video", icon: "film", accent: "--pd-pink" },
      { href: "/motion", name: "Motion Transfer", icon: "motion", accent: "--pd-lilac" },
      { href: "/fashion", name: "Fashion Try-on", icon: "shirt", accent: "--pd-pink" },
      { href: "/beauty", name: "Beauty Studio", icon: "beauty", accent: "--pd-mint" },
      { href: "/avatar", name: "Tattoo Studio", icon: "sparkle", accent: "--pd-lilac" },
      { href: "/hair", name: "Hair Studio", icon: "scissors", accent: "--pd-teal" },
      { href: "/ad", name: "Ad Studio", icon: "ad", accent: "--pd-amber" },
    ],
  },
  {
    label: "AI Models",
    groups: [
      {
        label: "Image",
        items: [
          { href: "/studio/model-seedream-5-pro", name: "Seedream 5.0 Pro", icon: "sparkle", accent: "--pd-lilac" },
          { href: "/studio/model-nano-banana-2-pro", name: "Nano Banana 2.0 Pro", icon: "sparkle", accent: "--pd-amber" },
          { href: "/studio/model-gpt-image-2", name: "GPT Image 2", icon: "sparkle", accent: "--pd-mint" },
          { href: "/studio/model-seedance-2", name: "Seedance 2", icon: "sparkle", accent: "--pd-teal" },
        ],
      },
      {
        label: "Video",
        items: [
          { href: "/studio/model-seedance-2-0", name: "Seedance 2.0", icon: "film", accent: "--pd-pink" },
          { href: "/studio/model-seedance-2-5", name: "Seedance 2.5", icon: "film", accent: "--pd-pink" },
          { href: "/studio/model-kling-3", name: "Kling 3.0", icon: "film", accent: "--pd-lilac" },
          { href: "/studio/model-veo-3", name: "Google Veo 3", icon: "film", accent: "--pd-teal" },
          { href: "/studio/model-minimax-h3-max", name: "Minimax H3 Max", icon: "film", accent: "--pd-amber" },
          { href: "/studio/model-wan-3-prime", name: "Wan 3.0 Prime", icon: "film", accent: "--pd-mint" },
          { href: "/studio/model-minimax-h3", name: "Minimax H3", icon: "film", accent: "--pd-amber" },
          { href: "/studio/model-wan-3", name: "Wan 3.0", icon: "film", accent: "--pd-mint" },
        ],
      },
    ],
  },
];

/** True when `href` is the active route for the current `pathname`. */
export function isActive(href: string, pathname: string): boolean {
  const clean = pathname.replace(/\/+$/, "") || "/";
  if (href === "/") return clean === "/";
  return clean === href || clean.startsWith(href + "/");
}
