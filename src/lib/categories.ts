// Admin-managed master list of template categories. Stored as a JSON array in
// app_settings under CATEGORIES_KEY. Pre-seeded from the originally-hardcoded
// catalog category lists. It's a shared palette for the template editor; each
// catalog page still only shows the categories its own templates actually use
// (see deriveCats), so one shared list stays tidy per-page.
import type { D1Database } from "@cloudflare/workers-types";
import { getSetting, setSetting } from "./app-settings";
import { PRESET_CATS, SHOOT_CATS, VIDEO_CATS, BEAUTY_CATS } from "./catalog";

export const CATEGORIES_KEY = "catalog_categories";

// Union of the previously-hardcoded lists (minus "All"), order-preserved.
export const DEFAULT_CATEGORIES: string[] = Array.from(
  new Set([...PRESET_CATS, ...SHOOT_CATS, ...VIDEO_CATS, ...BEAUTY_CATS].filter((c) => c && c !== "All"))
);

export async function getCategories(db: D1Database): Promise<string[]> {
  const raw = await getSetting(db, CATEGORIES_KEY);
  if (!raw) return [...DEFAULT_CATEGORIES];
  try {
    const p = JSON.parse(raw);
    if (!Array.isArray(p) || !p.length) return [...DEFAULT_CATEGORIES];
    const stored = p as string[];
    // Keep the admin-managed order; append any new defaults (e.g. Selfie)
    // that aren't in the saved palette yet.
    const seen = new Set(stored.map((c) => c.toLowerCase()));
    const extras = DEFAULT_CATEGORIES.filter((c) => !seen.has(c.toLowerCase()));
    return extras.length ? [...stored, ...extras] : stored;
  } catch {
    return [...DEFAULT_CATEGORIES];
  }
}

export async function setCategories(db: D1Database, cats: string[]): Promise<void> {
  await setSetting(db, CATEGORIES_KEY, JSON.stringify(cats));
}
