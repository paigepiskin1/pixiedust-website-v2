// AI Writer API (admin only). One endpoint, action-dispatched like the other
// admin APIs. Every call is server-side: the SyncNode key never reaches the
// browser, and nothing here can publish an item.
export const prerender = false;
import type { APIContext } from "astro";
import { adminActor, auditAdmin } from "../../../lib/admin";
import {
  addTopic, cancelJob, createJob, generateFromTopic, getJob, getVersion, jobLog, listJobs, listTopics, retryStage,
  reviewState, runStage, saveAsDraft, saveEdits, setLinks, setTopicStatus, usageReport, useUploadedImage, estimateJob,
  findOverlap, normalizeBrief, WriterError, type WriterEnv,
} from "../../../lib/writer/jobs";
import { getWriterSettings, saveWriterSettings } from "../../../lib/writer/settings";
import { STAGE_ORDER, type StageName } from "../../../lib/writer/types";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}

const isStage = (s: unknown): s is StageName => typeof s === "string" && (STAGE_ORDER as string[]).includes(s);

/** Job with its computed review state. Sources' full text stays server-side
 *  apart from a short preview; the panel shows what was fetched, not all of it. */
async function jobPayload(env: WriterEnv, id: string, withLog = false) {
  const job = await getJob(env.DB, id);
  if (!job) return null;
  const review = await reviewState(env, job);
  const research = job.research
    ? { ...job.research, sources: job.research.sources.map((s) => ({ ...s, text: undefined, preview: (s.text ?? "").slice(0, 400) })) }
    : null;
  return {
    job: { ...job, research },
    review: review ? { ...review, inventory: review.inventory.map((t) => ({ id: t.id, title: t.title, url: t.url, kind: t.kind })) } : null,
    log: withLog ? await jobLog(env.DB, id) : undefined,
  };
}

export async function GET({ request, locals, url }: APIContext) {
  const env = locals.runtime.env as unknown as WriterEnv & { ADMIN_API_TOKEN: string };
  const actor = adminActor(request, locals, env.ADMIN_API_TOKEN);
  if (!actor) return json({ error: "Forbidden" }, 403);
  const id = url.searchParams.get("job");
  try {
    if (id) {
      const versionId = Number(url.searchParams.get("version"));
      if (versionId) {
        const v = await getVersion(env.DB, id, versionId);
        return v ? json({ version: v }) : json({ error: "Not found" }, 404);
      }
      const p = await jobPayload(env, id, url.searchParams.get("log") === "1");
      return p ? json(p) : json({ error: "Not found" }, 404);
    }
    const what = url.searchParams.get("list");
    if (what === "topics") return json({ topics: await listTopics(env.DB) });
    if (what === "usage") return json({ usage: await usageReport(env.DB), settings: await getWriterSettings(env.DB) });
    const jobs = await listJobs(env.DB, 60);
    return json({ jobs: jobs.map((j) => ({ id: j.id, topic: j.brief.topic, status: j.status, stages: j.stages, itemId: j.itemId, costActual: j.costActual, costEstimate: j.costEstimate, createdAt: j.createdAt, title: j.edits.title ?? j.draft?.title ?? null })) });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
}

export async function POST({ request, locals }: APIContext) {
  const env = locals.runtime.env as unknown as WriterEnv & { ADMIN_API_TOKEN: string };
  const actor = adminActor(request, locals, env.ADMIN_API_TOKEN);
  if (!actor) return json({ error: "Forbidden" }, 403);
  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  try {
    switch (body.action) {
      case "preview": {
        // Overlap and cost before anything is created or spent.
        const brief = normalizeBrief(body.brief);
        const s = await getWriterSettings(env.DB);
        return json({ ok: true, overlap: await findOverlap(env.DB, brief), estimate: estimateJob(s), brief });
      }
      case "create": {
        const { job, duplicate } = await createJob(env, body.brief, actor);
        if (!duplicate) await auditAdmin(env.DB, actor, "ai_writer_create", "ai_jobs", job.id, { topic: job.brief.topic });
        return json({ ok: true, id: job.id, duplicate, overlap: job.overlap, estimate: job.costEstimate });
      }
      case "run": {
        if (!body.id) return json({ error: "Missing id" }, 400);
        await runStage(env, body.id, actor, isStage(body.stage) ? body.stage : undefined);
        return json({ ok: true, ...(await jobPayload(env, body.id)) });
      }
      case "retry": {
        if (!body.id || !isStage(body.stage)) return json({ error: "Missing id or stage" }, 400);
        await retryStage(env, body.id, body.stage, actor);
        return json({ ok: true, ...(await jobPayload(env, body.id)) });
      }
      case "cancel": {
        await cancelJob(env, body.id, actor);
        return json({ ok: true, ...(await jobPayload(env, body.id)) });
      }
      case "edit": {
        await saveEdits(env, body.id, body.fields ?? {}, actor);
        return json({ ok: true, ...(await jobPayload(env, body.id)) });
      }
      case "links": {
        await setLinks(env, body.id, Array.isArray(body.updates) ? body.updates : [], actor);
        return json({ ok: true, ...(await jobPayload(env, body.id)) });
      }
      case "use-upload": {
        await useUploadedImage(env, body.id, String(body.url || ""), String(body.alt || ""), actor);
        return json({ ok: true, ...(await jobPayload(env, body.id)) });
      }
      case "save-draft": {
        const r = await saveAsDraft(env, body.id, actor, { overwrite: body.overwrite === true, force: body.force === true });
        return json({ ok: true, itemId: r.itemId, ...(await jobPayload(env, body.id)) });
      }
      case "topic-add": {
        const r = await addTopic(env, body.brief, actor);
        return json({ ok: true, ...r });
      }
      case "topic-status": {
        if (!["approved", "rejected", "proposed"].includes(body.status)) return json({ error: "Bad status" }, 400);
        await setTopicStatus(env.DB, Number(body.topicId), body.status);
        await auditAdmin(env.DB, actor, `ai_writer_topic_${body.status}`, "ai_topics", String(body.topicId));
        return json({ ok: true });
      }
      case "topic-generate": {
        const { job, duplicate } = await generateFromTopic(env, Number(body.topicId), actor);
        return json({ ok: true, id: job.id, duplicate });
      }
      case "settings": {
        const s = await saveWriterSettings(env.DB, body.settings ?? {});
        await auditAdmin(env.DB, actor, "ai_writer_settings", "app_settings", "ai_writer_settings", s);
        return json({ ok: true, settings: s });
      }
      case "fact-save": {
        const f = body.fact ?? {};
        const id = String(f.id || "").trim().toLowerCase();
        if (!/^[a-z]+(\.[a-z0-9-]+)+$/.test(id)) return json({ error: "Fact id looks like topic.name (e.g. tool.shoots.cost)." }, 400);
        const statement = String(f.statement || "").trim();
        if (statement.length < 8) return json({ error: "Write the fact as a full sentence." }, 400);
        const status = ["approved", "needs_review", "retired"].includes(f.status) ? f.status : "needs_review";
        const topic = id.split(".")[0] === "tool" ? "tools" : String(f.topic || id.split(".")[0]);
        await env.DB
          .prepare(
            `INSERT INTO ai_facts (id, topic, statement, source, status, sort_order, updated_by, updated_at)
             VALUES (?, ?, ?, ?, ?, COALESCE(?, 500), ?, datetime('now'))
             ON CONFLICT(id) DO UPDATE SET topic = excluded.topic, statement = excluded.statement, source = excluded.source,
               status = excluded.status, updated_by = excluded.updated_by, updated_at = datetime('now')`
          )
          .bind(id, topic, statement.slice(0, 1200), String(f.source || "").trim().slice(0, 300) || null, status, Number.isFinite(Number(f.sortOrder)) ? Number(f.sortOrder) : null, actor)
          .run();
        await auditAdmin(env.DB, actor, "ai_fact_save", "ai_facts", id, { status, statement });
        return json({ ok: true });
      }
      default:
        return json({ error: "Unknown action" }, 400);
    }
  } catch (err) {
    if (err instanceof WriterError) return json({ error: err.message, detail: err.detail }, err.status);
    return json({ error: (err as Error)?.message || String(err) }, 500);
  }
}
