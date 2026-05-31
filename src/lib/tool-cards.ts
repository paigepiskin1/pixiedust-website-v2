// Admin-chosen background media (image or video) for the "Start a project" tool
// cards on the home page. Stored as JSON in app_settings under TOOL_CARDS_KEY,
// keyed by the tool's href. Empty/missing → the card falls back to its gradient.
import type { D1Database } from "@cloudflare/workers-types";
import { getSetting } from "./app-settings";

export const TOOL_CARDS_KEY = "tool_cards";

export interface ToolMedia {
  url: string;
  type: "image" | "video";
}
export type ToolCardMap = Record<string, ToolMedia>;

export async function getToolCards(db: D1Database): Promise<ToolCardMap> {
  const raw = await getSetting(db, TOOL_CARDS_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}
