import { adminGoalCreateSchema, adminGoalUpdateSchema, adminReportDecisionSchema, type StatusFile } from "@zevent-radar/contracts";
import { Hono } from "hono";
import { runCollector } from "../collector/run";
import type { Env } from "../env";
import { authenticateAdmin } from "../lib/auth";
import { audit, loadStreamers, rowToGoal, type GoalRow } from "../lib/db";
import { nowIso, uuid } from "../lib/ids";
import { KEYS, readJson } from "../lib/r2";
import { importGoals, publishGoals } from "../goals/catalog";
import { syncFromIngdoc } from "../goals/ingdoc-sync";

type Variables = { moderator: string };

export const adminRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

adminRoutes.use("/api/admin/*", async (c, next) => {
  const identity = await authenticateAdmin(c.req.raw, c.env);
  if (!identity) return c.json({ error: "unauthorized" }, 401);
  c.set("moderator", identity);
  c.header("cache-control", "no-store");
  await next();
});

adminRoutes.get("/api/admin/status", async (c) => {
  const status = await readJson<StatusFile>(c.env.DATA, KEYS.status);
  const [pending, deliveries, subs, errors] = await Promise.all([
    c.env.DB.prepare("SELECT COUNT(*) AS n FROM community_reports WHERE status = 'pending'").first<{ n: number }>(),
    c.env.DB.prepare("SELECT status, COUNT(*) AS n FROM notification_deliveries GROUP BY status").all<{ status: string; n: number }>(),
    c.env.DB.prepare("SELECT COUNT(*) AS n FROM push_subscriptions").first<{ n: number }>(),
    c.env.DB.prepare("SELECT n.event_key, n.status, n.sent_at FROM notification_deliveries n WHERE n.status NOT IN ('sent', 'pending') ORDER BY n.sent_at DESC LIMIT 20").all<{ event_key: string; status: string; sent_at: string }>()
  ]);
  return c.json({ moderator: c.get("moderator"), status, pendingReports: pending?.n ?? 0, subscriptions: subs?.n ?? 0, deliveries: deliveries.results, deliveryErrors: errors.results });
});

adminRoutes.post("/api/admin/collect", async (c) => {
  const result = await runCollector(c.env, { trigger: "admin" });
  return c.json(result);
});

adminRoutes.post("/api/admin/goals/sync", async (c) => {
  try {
    const summary = await syncFromIngdoc(c.env, c.get("moderator"));
    return c.json(summary);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "sync failed" }, 502);
  }
});

adminRoutes.post("/api/admin/goals/import", async (c) => {
  const dryRun = c.req.query("dryRun") === "1" || c.req.query("dryRun") === "true";
  const mode = c.req.query("mode") === "sync" ? "sync" : "merge";
  try {
    const { summary, jobs } = await importGoals(c.env, await c.req.json(), { actor: c.get("moderator"), mode, dryRun });
    if (jobs.length > 0) await c.env.NOTIFICATIONS.sendBatch(jobs.map((body) => ({ body })));
    return c.json(summary);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "import failed" }, 400);
  }
});

adminRoutes.get("/api/admin/goals", async (c) => {
  const streamerId = c.req.query("streamerId");
  const status = c.req.query("status");
  const filters: string[] = [];
  const binds: unknown[] = [];
  if (streamerId) {
    filters.push("(streamer_id = ? OR streamer_id IN (SELECT id FROM streamers WHERE twitch_login = ?))");
    binds.push(streamerId, streamerId.toLowerCase());
  }
  if (status) {
    filters.push("status = ?");
    binds.push(status);
  }
  const where = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";
  const { results } = await c.env.DB.prepare(`SELECT * FROM goals ${where} ORDER BY streamer_id, amount_cents LIMIT 500`).bind(...binds).all<GoalRow>();
  return c.json({ goals: results.map(rowToGoal) });
});

adminRoutes.get("/api/admin/goals/duplicates", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT streamer_id, amount_cents, COUNT(*) AS n, GROUP_CONCAT(id) AS ids, GROUP_CONCAT(label, ' || ') AS labels FROM goals WHERE status NOT IN ('rejected', 'superseded') GROUP BY streamer_id, amount_cents HAVING n > 1 ORDER BY n DESC LIMIT 200"
  ).all();
  return c.json({ duplicates: results });
});

adminRoutes.post("/api/admin/goals", async (c) => {
  const parsed = adminGoalCreateSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid payload", issues: parsed.error.issues }, 400);
  const input = parsed.data;
  const streamers = await loadStreamers(c.env.DB);
  const streamer = streamers.find((s) => s.id === input.streamerId || s.twitch_login === input.streamerId.toLowerCase());
  if (!streamer) return c.json({ error: "unknown streamer" }, 404);
  const at = nowIso();
  const id = uuid();
  await c.env.DB.batch([
    c.env.DB.prepare("INSERT INTO goals (id, streamer_id, amount_cents, label, category, status, source_url, source_name, verified_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'admin', ?, ?, ?)").bind(id, streamer.id, Math.round(input.amount * 100), input.label, input.category, input.status, input.sourceUrl ?? null, at, at, at),
    audit(c.env.DB, c.get("moderator"), "goal.create", "goal", id, input)
  ]);
  await publishGoals(c.env);
  return c.json({ id }, 201);
});

adminRoutes.patch("/api/admin/goals/:id", async (c) => {
  const parsed = adminGoalUpdateSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid payload", issues: parsed.error.issues }, 400);
  const id = c.req.param("id");
  const row = await c.env.DB.prepare("SELECT * FROM goals WHERE id = ?").bind(id).first<GoalRow>();
  if (!row) return c.json({ error: "not found" }, 404);
  const input = parsed.data;
  const at = nowIso();
  const amountCents = input.amount !== undefined ? Math.round(input.amount * 100) : row.amount_cents;
  const status = input.status ?? row.status;
  const reachedAt = status === "reached" || status === "accomplished" ? (row.reached_at ?? at) : status === "verified" || status === "pending" ? null : row.reached_at;
  const accomplishedAt = status === "accomplished" ? (row.accomplished_at ?? at) : status === "verified" || status === "pending" || status === "reached" ? null : row.accomplished_at;
  await c.env.DB.batch([
    c.env.DB.prepare("INSERT INTO goal_versions (id, goal_id, amount_cents, label, category, status, source_url, changed_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(uuid(), id, row.amount_cents, row.label, row.category, row.status, row.source_url, c.get("moderator"), at),
    c.env.DB.prepare("UPDATE goals SET amount_cents = ?, label = ?, category = ?, status = ?, source_url = ?, reached_at = ?, accomplished_at = ?, verified_at = COALESCE(verified_at, ?), updated_at = ? WHERE id = ?").bind(
      amountCents,
      input.label ?? row.label,
      input.category ?? row.category,
      status,
      input.sourceUrl === undefined ? row.source_url : input.sourceUrl,
      reachedAt,
      accomplishedAt,
      status === "verified" ? at : null,
      at,
      id
    ),
    audit(c.env.DB, c.get("moderator"), "goal.update", "goal", id, input)
  ]);
  if (status === "accomplished" && row.status !== "accomplished") {
    const streamer = await c.env.DB.prepare("SELECT id, twitch_login, display_name FROM streamers WHERE id = ?").bind(row.streamer_id).first<{ id: string; twitch_login: string; display_name: string }>();
    if (streamer) {
      const inserted = await c.env.DB.prepare("INSERT OR IGNORE INTO events (id, event_key, kind, public, streamer_id, streamer_login, streamer_display_name, goal_id, goal_label, amount_cents, created_at) VALUES (?, ?, 'goal_accomplished', 1, ?, ?, ?, ?, ?, ?, ?)")
        .bind(uuid(), `accomplished:${id}`, streamer.id, streamer.twitch_login, streamer.display_name, id, input.label ?? row.label, amountCents, at)
        .run();
      if (inserted.meta.changes > 0) {
        await c.env.NOTIFICATIONS.send({ eventKey: `accomplished:${id}`, type: "accomplished", streamerId: streamer.id, streamerLogin: streamer.twitch_login, title: `${streamer.display_name} : goal accompli`, body: input.label ?? row.label, url: `/streamers/${streamer.twitch_login}`, tag: `accomplished:${id}`, createdAt: at });
      }
    }
  }
  await publishGoals(c.env);
  return c.json({ ok: true });
});

adminRoutes.get("/api/admin/reports", async (c) => {
  const status = c.req.query("status") ?? "pending";
  const { results } = await c.env.DB.prepare(
    "SELECT r.*, s.twitch_login, s.display_name, (SELECT COUNT(*) FROM report_confirmations x WHERE x.report_id = r.id) AS confirmations FROM community_reports r LEFT JOIN streamers s ON s.id = r.streamer_id WHERE r.status = ? ORDER BY r.created_at DESC LIMIT 200"
  )
    .bind(status)
    .all();
  return c.json({ reports: results });
});

adminRoutes.post("/api/admin/reports/:id/decision", async (c) => {
  const parsed = adminReportDecisionSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid payload" }, 400);
  const id = c.req.param("id");
  const at = nowIso();
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE community_reports SET status = ?, reviewed_at = ?, reviewed_by = ? WHERE id = ?").bind(parsed.data.status, at, c.get("moderator"), id),
    audit(c.env.DB, c.get("moderator"), `report.${parsed.data.status}`, "report", id, null)
  ]);
  return c.json({ ok: true });
});

adminRoutes.get("/api/admin/audit", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT * FROM moderation_audit ORDER BY created_at DESC LIMIT 200").all();
  return c.json({ entries: results });
});

adminRoutes.get("/api/admin/events", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT * FROM events ORDER BY created_at DESC LIMIT 200").all();
  return c.json({ events: results });
});
