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
    return Array.isArray(p) && p.length ? (p as string[]) : [...DEFAULT_CATEGORIES];
  } catch {
    return [...DEFAULT_CATEGORIES];
  }
}

export async function setCategories(db: D1Database, cats: string[]): Promise<void> {
  await setSetting(db, CATEGORIES_KEY, JSON.stringify(cats));
}
