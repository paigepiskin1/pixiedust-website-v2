export const prerender = false;
// Legacy path kept so older clients still work. Prefer /api/credits/checkout —
// some browser extensions block URLs containing "billing" / "checkout" together.
export { POST } from "../credits/checkout";
