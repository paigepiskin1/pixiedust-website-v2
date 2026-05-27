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
  | "ad";

export interface NavItem {
  href: string;
  name: string;
  icon: IconName;
  /** CSS var name for the accent used on active state (e.g. "--pd-amber"). */
  accent?: string;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    label: "Discover",
    items: [
      { href: "/", name: "Home", icon: "home" },
      { href: "/trending", name: "Trending", icon: "trending" },
      { href: "/gallery", name: "My creations", icon: "gallery" },
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
      { href: "/avatar", name: "Avatar Studio", icon: "sparkle", accent: "--pd-lilac" },
      { href: "/ad", name: "Ad Studio", icon: "ad", accent: "--pd-amber" },
    ],
  },
];

/** True when `href` is the active route for the current `pathname`. */
export function isActive(href: string, pathname: string): boolean {
  const clean = pathname.replace(/\/+$/, "") || "/";
  if (href === "/") return clean === "/";
  return clean === href || clean.startsWith(href + "/");
}
