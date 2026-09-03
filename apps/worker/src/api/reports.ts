import { confirmReportSchema, createReportSchema, TEMPORARY_REPORT_KINDS, type CommunityReport, type ReportKind } from "@zevent-radar/contracts";
import { Hono } from "hono";
import type { Env } from "../env";
import { nowIso, sha256, uuid } from "../lib/ids";
import { verifyTurnstile } from "../lib/turnstile";

export const reportRoutes = new Hono<{ Bindings: Env }>();

const VISIBLE_CONFIRMATIONS = 3;
const TEMPORARY_TTL_MS = 2 * 60 * 60 * 1000;
const PER_INSTALLATION_HOURLY = 5;

interface ReportRow {
  id: string;
  streamer_id: string;
  twitch_login: string | null;
  display_name: string | null;
  kind: ReportKind;
  message: string;
  source_url: string | null;
  status: CommunityReport["status"];
  confirmations: number;
  created_at: string;
  expires_at: string | null;
}

function toReport(row: ReportRow): CommunityReport {
  return {
    id: row.id,
    streamerId: row.streamer_id,
    streamerLogin: row.twitch_login,
    streamerDisplayName: row.display_name,
    kind: row.kind,
    message: row.message,
    sourceUrl: row.source_url,
    status: row.status,
    confirmations: row.confirmations,
    createdAt: row.created_at,
    expiresAt: row.expires_at
  };
}

const SELECT = `SELECT r.id, r.streamer_id, s.twitch_login, s.display_name, r.kind, r.message, r.source_url, r.status, r.created_at, r.expires_at, (SELECT COUNT(*) FROM report_confirmations c WHERE c.report_id = r.id) AS confirmations FROM community_reports r LEFT JOIN streamers s ON s.id = r.streamer_id`;

reportRoutes.get("/api/community", async (c) => {
  const streamerId = c.req.query("streamerId");
  const installationId = c.req.query("installationId");
  const now = nowIso();
  const filters = ["r.status <> 'rejected'", "(r.expires_at IS NULL OR r.expires_at > ?)"];
  const binds: unknown[] = [now];
  if (streamerId) {
    filters.push("r.streamer_id = ?");
    binds.push(streamerId);
  }
  const { results } = await c.env.DB.prepare(`${SELECT} WHERE ${filters.join(" AND ")} ORDER BY r.created_at DESC LIMIT 200`).bind(...binds).all<ReportRow>();
  const visible = results.filter((r) => r.status === "approved" || r.confirmations >= VISIBLE_CONFIRMATIONS || (installationId && r.status === "pending"));
  let mine: string[] = [];
  let confirmed: string[] = [];
  if (installationId) {
    mine = results.filter((r) => r.status === "pending").map((r) => r.id);
    const own = await c.env.DB.prepare("SELECT id FROM community_reports WHERE installation_id = ? ORDER BY created_at DESC LIMIT 50").bind(installationId).all<{ id: string }>();
    const ids = new Set(own.results.map((r) => r.id));
    const confirms = await c.env.DB.prepare("SELECT report_id FROM report_confirmations WHERE installation_id = ? ORDER BY created_at DESC LIMIT 200").bind(installationId).all<{ report_id: string }>();
    confirmed = confirms.results.map((r) => r.report_id);
    mine = mine.filter((id) => ids.has(id));
  }
  const reports = visible.filter((r) => r.status !== "pending" || r.confirmations >= VISIBLE_CONFIRMATIONS || mine.includes(r.id) || confirmed.includes(r.id)).map(toReport);
  return c.json({ reports, confirmed, visibleThreshold: VISIBLE_CONFIRMATIONS }, 200, { "cache-control": "no-store" });
});

reportRoutes.post("/api/reports", async (c) => {
  const parsed = createReportSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid payload", issues: parsed.error.issues }, 400);
  const input = parsed.data;
  const ip = c.req.header("cf-connecting-ip") ?? null;
  if (c.env.REPORT_LIMITER) {
    const { success } = await c.env.REPORT_LIMITER.limit({ key: `report:${ip ?? input.installationId}` });
    if (!success) return c.json({ error: "rate limited" }, 429);
  }
  if (!(await verifyTurnstile(c.env.TURNSTILE_SECRET_KEY, input.turnstileToken, ip))) return c.json({ error: "turnstile failed" }, 403);
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const recent = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM community_reports WHERE installation_id = ? AND created_at > ?").bind(input.installationId, hourAgo).first<{ n: number }>();
  if ((recent?.n ?? 0) >= PER_INSTALLATION_HOURLY) return c.json({ error: "too many reports" }, 429);
  const streamer = await c.env.DB.prepare("SELECT id FROM streamers WHERE id = ? OR twitch_login = ?").bind(input.streamerId, input.streamerId.toLowerCase()).first<{ id: string }>();
  if (!streamer) return c.json({ error: "unknown streamer" }, 404);
  const at = nowIso();
  const id = uuid();
  const expiresAt = TEMPORARY_REPORT_KINDS.has(input.kind) ? new Date(Date.now() + TEMPORARY_TTL_MS).toISOString() : null;
  await c.env.DB.prepare("INSERT INTO community_reports (id, streamer_id, kind, message, source_url, status, installation_id, ip_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)")
    .bind(id, streamer.id, input.kind, input.message.trim(), input.sourceUrl ?? null, input.installationId, ip ? await sha256(ip) : null, at, expiresAt)
    .run();
  return c.json({ id, status: "pending", expiresAt }, 201);
});

reportRoutes.post("/api/reports/:id/confirm", async (c) => {
  const parsed = confirmReportSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid payload" }, 400);
  const id = c.req.param("id");
  const report = await c.env.DB.prepare("SELECT id, installation_id, status FROM community_reports WHERE id = ?").bind(id).first<{ id: string; installation_id: string; status: string }>();
  if (!report || report.status === "rejected") return c.json({ error: "not found" }, 404);
  if (report.installation_id === parsed.data.installationId) return c.json({ error: "cannot confirm own report" }, 400);
  await c.env.DB.prepare("INSERT OR IGNORE INTO report_confirmations (report_id, installation_id, created_at) VALUES (?, ?, ?)").bind(id, parsed.data.installationId, nowIso()).run();
  const count = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM report_confirmations WHERE report_id = ?").bind(id).first<{ n: number }>();
  return c.json({ id, confirmations: count?.n ?? 0, visible: (count?.n ?? 0) >= VISIBLE_CONFIRMATIONS || report.status === "approved" });
});
