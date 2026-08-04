import type { D1Database } from "@cloudflare/workers-types";

export const REPORT_REASONS = [
  { id: "stuck_processing", label: "Stuck processing" },
  { id: "bad_result", label: "Wrong / bad result" },
  { id: "nsfw", label: "Inappropriate content" },
  { id: "credits", label: "Credits charged incorrectly" },
  { id: "other", label: "Other" },
] as const;

export type ReportReasonId = (typeof REPORT_REASONS)[number]["id"];

export function isReportReason(v: unknown): v is ReportReasonId {
  return typeof v === "string" && REPORT_REASONS.some((r) => r.id === v);
}

export function reasonLabel(id: string): string {
  return REPORT_REASONS.find((r) => r.id === id)?.label ?? id;
}

export interface GenerationReportRow {
  id: string;
  generation_id: string;
  user_id: number;
  reason: string;
  note: string | null;
  status: string;
  admin_note: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  email: string | null;
  gen_status: string | null;
  gen_type: string | null;
  output_url: string | null;
  template_title: string | null;
  template_id: string | null;
}

export async function listGenerationReports(
  db: D1Database,
  opts: { status?: "open" | "resolved" | "all"; limit?: number } = {}
): Promise<GenerationReportRow[]> {
  const limit = Math.max(1, Math.min(opts.limit ?? 100, 200));
  const status = opts.status ?? "open";
  const statusClause = status === "all" ? "" : "AND r.status = ?";
  const binds: unknown[] = [];
  if (status !== "all") binds.push(status);
  binds.push(limit);

  const { results } = await db
    .prepare(
      `SELECT r.id, r.generation_id, r.user_id, r.reason, r.note, r.status,
              r.admin_note, r.resolved_by, r.resolved_at, r.created_at,
              u.email,
              g.status AS gen_status, g.type AS gen_type, g.output_url,
              g.template_id, t.title AS template_title
       FROM generation_reports r
       JOIN users u ON u.id = r.user_id
       LEFT JOIN generations g ON g.id = r.generation_id
       LEFT JOIN templates t ON t.id = g.template_id
       WHERE 1=1 ${statusClause}
       ORDER BY r.created_at DESC
       LIMIT ?`
    )
    .bind(...binds)
    .all<GenerationReportRow>();
  return results ?? [];
}

export async function countOpenReports(db: D1Database): Promise<number> {
  const row = await db
    .prepare(`SELECT COUNT(*) AS c FROM generation_reports WHERE status = 'open'`)
    .first<{ c: number }>();
  return row?.c ?? 0;
}
