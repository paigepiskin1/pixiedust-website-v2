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
