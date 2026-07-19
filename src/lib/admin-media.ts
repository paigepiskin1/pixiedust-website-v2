import type { D1Database } from "@cloudflare/workers-types";

export interface AdminMediaItem {
  id: string;
  url: string;
  kind: "image" | "video";
  filename: string | null;
  bytes: number | null;
  createdBy: string | null;
  createdAt: string;
}

interface Row {
  id: string;
  url: string;
  kind: string;
  filename: string | null;
  bytes: number | null;
  created_by: string | null;
  created_at: string;
}

function rowToItem(r: Row): AdminMediaItem {
  return {
    id: r.id,
    url: r.url,
    kind: r.kind === "video" ? "video" : "image",
    filename: r.filename,
    bytes: r.bytes,
    createdBy: r.created_by,
    createdAt: r.created_at,
  };
}

export async function listAdminMedia(db: D1Database, limit = 100): Promise<AdminMediaItem[]> {
  const { results } = await db
    .prepare(
      "SELECT id, url, kind, filename, bytes, created_by, created_at FROM admin_media ORDER BY created_at DESC LIMIT ?"
    )
    .bind(Math.max(1, Math.min(500, Math.floor(limit))))
    .all<Row>();
  return (results ?? []).map(rowToItem);
}

export async function addAdminMedia(
  db: D1Database,
  opts: { url: string; kind?: string; filename?: string | null; bytes?: number | null; createdBy?: string | null }
): Promise<AdminMediaItem> {
  const id = crypto.randomUUID();
  const kind = opts.kind === "video" ? "video" : "image";
  const filename = opts.filename?.trim() || null;
  const bytes = typeof opts.bytes === "number" && opts.bytes >= 0 ? Math.floor(opts.bytes) : null;
  const createdBy = opts.createdBy ?? null;
  await db
    .prepare(
      `INSERT INTO admin_media (id, url, kind, filename, bytes, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
    )
    .bind(id, opts.url, kind, filename, bytes, createdBy)
    .run();
  return {
    id,
    url: opts.url,
    kind,
    filename,
    bytes,
    createdBy,
    createdAt: new Date().toISOString().replace("T", " ").slice(0, 19),
  };
}

export async function deleteAdminMedia(db: D1Database, id: string): Promise<boolean> {
  const res = await db.prepare("DELETE FROM admin_media WHERE id = ?").bind(id).run();
  return (res.meta?.changes ?? 0) > 0;
}
