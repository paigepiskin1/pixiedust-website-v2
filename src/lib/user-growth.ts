// User-growth metrics for /admin/analytics.
//
// "Started"  = password signup that triggered a verify email (before a D1 user
//              row exists). Counted from email_log template='verify', first
//              send per uid.
// "Joined"   = completed onboarding — welcome email went out
//              (users.welcome_sent_at). OAuth users land here without a verify.

import type { D1Database } from "@cloudflare/workers-types";

export interface GrowthDay {
  day: string; // YYYY-MM-DD
  started: number;
  joined: number;
}

export interface UserGrowth {
  pendingVerify: number;
  joinedTotal: number;
  startedInRange: number;
  joinedInRange: number;
  days: GrowthDay[];
}

/** Map Clicky-style range keywords to a day window (inclusive). */
export function rangeToDays(range: string): number {
  switch (range) {
    case "today":
      return 1;
    case "yesterday":
      return 2; // include yesterday + today so the chart has a bit of context
    case "last-7-days":
      return 7;
    case "last-30-days":
      return 30;
    case "last-365-days":
      return 365;
    default:
      return 30;
  }
}

function dayKeys(n: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    d.setUTCDate(d.getUTCDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

/**
 * Pull user-growth totals + a daily series for the last `days` calendar days.
 * Failures resolve to empty/zero so the analytics page never 500s.
 */
export async function getUserGrowth(db: D1Database, days = 30): Promise<UserGrowth> {
  const empty: UserGrowth = {
    pendingVerify: 0,
    joinedTotal: 0,
    startedInRange: 0,
    joinedInRange: 0,
    days: dayKeys(days).map((day) => ({ day, started: 0, joined: 0 })),
  };
  try {
    const since = empty.days[0]?.day ?? new Date().toISOString().slice(0, 10);

    const [pendingRow, joinedRow, startedRows, joinedRows] = await Promise.all([
      // Distinct verify recipients who never received a welcome (still pending).
      db
        .prepare(
          `SELECT COUNT(*) AS n FROM (
             SELECT DISTINCT e.user_uid AS uid
             FROM email_log e
             WHERE e.template = 'verify'
               AND e.user_uid IS NOT NULL AND e.user_uid != ''
               AND NOT EXISTS (
                 SELECT 1 FROM users u
                 WHERE u.uid = e.user_uid
                   AND u.welcome_sent_at IS NOT NULL
                   AND u.deleted_at IS NULL
               )
           )`
        )
        .first<{ n: number }>(),
      db
        .prepare(
          `SELECT COUNT(*) AS n FROM users
           WHERE welcome_sent_at IS NOT NULL AND deleted_at IS NULL`
        )
        .first<{ n: number }>(),
      // First verify email per uid, bucketed by day — only days in range.
      db
        .prepare(
          `SELECT day, COUNT(*) AS n FROM (
             SELECT user_uid, date(MIN(created_at)) AS day
             FROM email_log
             WHERE template = 'verify'
               AND user_uid IS NOT NULL AND user_uid != ''
             GROUP BY user_uid
           )
           WHERE day >= ?
           GROUP BY day
           ORDER BY day`
        )
        .bind(since)
        .all<{ day: string; n: number }>(),
      db
        .prepare(
          `SELECT date(welcome_sent_at) AS day, COUNT(*) AS n
           FROM users
           WHERE welcome_sent_at IS NOT NULL
             AND deleted_at IS NULL
             AND date(welcome_sent_at) >= ?
           GROUP BY date(welcome_sent_at)
           ORDER BY day`
        )
        .bind(since)
        .all<{ day: string; n: number }>(),
    ]);

    const startedMap = new Map<string, number>();
    for (const r of startedRows.results ?? []) startedMap.set(r.day, Number(r.n) || 0);
    const joinedMap = new Map<string, number>();
    for (const r of joinedRows.results ?? []) joinedMap.set(r.day, Number(r.n) || 0);

    const series = empty.days.map((d) => ({
      day: d.day,
      started: startedMap.get(d.day) ?? 0,
      joined: joinedMap.get(d.day) ?? 0,
    }));

    return {
      pendingVerify: Number(pendingRow?.n) || 0,
      joinedTotal: Number(joinedRow?.n) || 0,
      startedInRange: series.reduce((s, d) => s + d.started, 0),
      joinedInRange: series.reduce((s, d) => s + d.joined, 0),
      days: series,
    };
  } catch {
    return empty;
  }
}
