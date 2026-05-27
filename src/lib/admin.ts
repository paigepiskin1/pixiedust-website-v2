// Shared admin helpers. Pages guard with: if (!isAdmin(Astro)) return redirect.
import type { D1Database } from "@cloudflare/workers-types";

export const ADMIN_NAV = [
  { k: "dashboard", name: "Dashboard", href: "/admin" },
  { k: "templates", name: "Templates", href: "/admin/templates" },
  { k: "users", name: "Users", href: "/admin/users" },
  { k: "content", name: "Content", href: "/admin/content" },
];

export function isAdmin(locals: App.Locals): boolean {
  return !!locals.user?.isAdmin;
}

/**
 * Admin auth for API endpoints: a logged-in admin session OR a valid
 * `Authorization: Bearer <ADMIN_API_TOKEN>` (so Claude Code / scripts can drive
 * the Template API headlessly). Returns the acting admin uid (or null).
 */
export function adminActor(request: Request, locals: App.Locals, token: string | undefined): string | null {
  if (locals.user?.isAdmin) return locals.user.uid;
  const auth = request.headers.get("authorization") || "";
  const m = /^Bearer\s+(.+)$/i.exec(auth);
  if (m && token && m[1] === token) return "api-token";
  return null;
}

/** Record a non-credit admin action (template edits, role/balance changes). */
export async function auditAdmin(
  db: D1Database,
  adminUid: string,
  action: string,
  targetType: string | null,
  targetId: string | null,
  detail?: unknown
): Promise<void> {
  await db
    .prepare(
      "INSERT INTO admin_audit (admin_uid, action, target_type, target_id, detail_json) VALUES (?, ?, ?, ?, ?)"
    )
    .bind(adminUid, action, targetType, targetId, detail ? JSON.stringify(detail) : null)
    .run();
}
