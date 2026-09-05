import type { BulkHistoryResponse, EventsResponse, HistoryFile, HistoryPoint, PublicEvent, PublicEventKind, PublicStatusFile, StreamerHistoryResponse } from "@zevent-radar/contracts";
import { Hono } from "hono";
import type { Env } from "../env";
import { KEYS, readJson } from "../lib/r2";

export const publicRoutes = new Hono<{ Bindings: Env }>();

const PUBLIC_FILES: Record<string, string> = {
  "latest.json": KEYS.latest,
  "goals.json": KEYS.goals,
  "status.json": KEYS.status,
  "event-total.json": KEYS.eventTotal
};
const PUBLIC_FILE_TTL: Record<string, number> = { "goals.json": 60, "event-total.json": 60 };

async function cached(c: { req: { raw: Request }; executionCtx: { waitUntil(promise: Promise<unknown>): void } }, key: string, ttlSeconds: number, produce: () => Promise<Response>): Promise<Response> {
  const cache = caches.default;
  const cacheKey = new Request(new URL(key, c.req.raw.url).toString(), { method: "GET" });
  const hit = await cache.match(cacheKey);
  if (hit) return hit;
  const res = await produce();
  if (res.ok) {
    const toCache = new Response(res.clone().body, res);
    toCache.headers.set("cache-control", `public, max-age=${ttlSeconds}`);
    c.executionCtx.waitUntil(cache.put(cacheKey, toCache));
  }
  return res;
}

function withCors(res: Response): Response {
  const headers = new Headers(res.headers);
  headers.set("access-control-allow-origin", "*");
  return new Response(res.body, { status: res.status, headers });
}

publicRoutes.get("/data/:file", async (c) => {
  const file = c.req.param("file");
  const key = PUBLIC_FILES[file];
  if (!key) return c.notFound();
  return withCors(
    await cached(c, `/data/${file}`, PUBLIC_FILE_TTL[file] ?? 15, async () => {
      const object = await c.env.DATA.get(key);
      if (!object) return c.json({ error: "not ready" }, 503, { "cache-control": "no-store" });
      return new Response(object.body, {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": object.httpMetadata?.cacheControl ?? "public, max-age=15, stale-while-revalidate=120",
          etag: object.httpEtag,
          "last-modified": object.uploaded.toUTCString()
        }
      });
    })
  );
});

publicRoutes.get("/data/snapshots/:ts", async (c) => {
  const ts = c.req.param("ts").replace(/[^A-Za-z0-9_-]/g, "");
  const object = await c.env.DATA.get(KEYS.snapshot(ts.replace(/\.json$/, "")));
  if (!object) return c.notFound();
  return withCors(new Response(object.body, { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=31536000, immutable" } }));
});

publicRoutes.get("/data/history/:streamerId", async (c) => {
  const streamerId = c.req.param("streamerId").replace(/[^A-Za-z0-9_]/g, "");
  return withCors(
    await cached(c, `/data/history/${streamerId}`, 30, async () => {
      const history = await readJson<HistoryFile>(c.env.DATA, KEYS.history);
      if (!history) return c.json({ error: "not ready" }, 503, { "cache-control": "no-store" });
      const body: StreamerHistoryResponse = { streamerId, updatedAt: history.updatedAt, points: streamerId === "event" ? history.eventTotal : (history.series[streamerId] ?? []) };
      return c.json(body, 200, { "cache-control": "public, max-age=30, stale-while-revalidate=120" });
    })
  );
});

const BULK_MAX_IDS = 24;
const BULK_MAX_POINTS = 120;

/** Keep at most `max` points, always preserving the first and last ones. */
export function downsample(points: HistoryPoint[], max: number): HistoryPoint[] {
  if (points.length <= max) return points;
  const step = (points.length - 1) / (max - 1);
  const out: HistoryPoint[] = [];
  for (let i = 0; i < max; i += 1) out.push(points[Math.round(i * step)]!);
  return out;
}

publicRoutes.get("/api/history", async (c) => {
  const ids = Array.from(new Set((c.req.query("ids") ?? "").split(",").map((v) => v.replace(/[^A-Za-z0-9_]/g, "")).filter(Boolean))).slice(0, BULK_MAX_IDS);
  if (ids.length === 0) return withCors(c.json({ error: "ids required" }, 400));
  const sorted = [...ids].sort();
  return withCors(
    await cached(c, `/api/history?ids=${sorted.join(",")}`, 30, async () => {
      const history = await readJson<HistoryFile>(c.env.DATA, KEYS.history);
      if (!history) return c.json({ error: "not ready" }, 503, { "cache-control": "no-store" });
      const series: Record<string, HistoryPoint[]> = {};
      for (const id of sorted) series[id] = downsample(id === "event" ? history.eventTotal : (history.series[id] ?? []), BULK_MAX_POINTS);
      const body: BulkHistoryResponse = { updatedAt: history.updatedAt, series };
      return c.json(body, 200, { "cache-control": "public, max-age=30, stale-while-revalidate=120" });
    })
  );
});

const EVENT_KINDS: ReadonlySet<string> = new Set<PublicEventKind>(["goal_reached", "goal_accomplished", "live_started", "goal_added", "goal_updated"]);
const EVENTS_MAX = 200;

interface EventRow {
  id: string;
  kind: PublicEventKind;
  streamer_id: string;
  streamer_login: string;
  streamer_display_name: string;
  goal_id: string | null;
  goal_label: string | null;
  amount_cents: number | null;
  created_at: string;
}

publicRoutes.get("/api/events", async (c) => {
  const limit = Math.min(EVENTS_MAX, Math.max(1, Number(c.req.query("limit") ?? "100") || 100));
  const before = (c.req.query("before") ?? "").replace(/[^0-9TZ:.\-]/g, "");
  const kind = c.req.query("kind") ?? "";
  const streamerId = (c.req.query("streamerId") ?? "").replace(/[^A-Za-z0-9_]/g, "");
  if (kind && !EVENT_KINDS.has(kind)) return withCors(c.json({ error: "unknown kind" }, 400));
  const cacheKey = `/api/events?limit=${limit}&before=${before}&kind=${kind}&streamerId=${streamerId}`;
  return withCors(
    await cached(c, cacheKey, 20, async () => {
      const filters = ["public = 1"];
      const binds: unknown[] = [];
      if (before) {
        filters.push("created_at < ?");
        binds.push(before);
      }
      if (kind) {
        filters.push("kind = ?");
        binds.push(kind);
      }
      if (streamerId) {
        filters.push("streamer_id = ?");
        binds.push(streamerId);
      }
      binds.push(limit + 1);
      const { results } = await c.env.DB.prepare(`SELECT id, kind, streamer_id, streamer_login, streamer_display_name, goal_id, goal_label, amount_cents, created_at FROM events WHERE ${filters.join(" AND ")} ORDER BY created_at DESC LIMIT ?`)
        .bind(...binds)
        .all<EventRow>();
      const page = results.slice(0, limit);
      const events: PublicEvent[] = page.map((row) => ({
        id: row.id,
        kind: row.kind,
        streamerId: row.streamer_id,
        streamerLogin: row.streamer_login,
        streamerDisplayName: row.streamer_display_name,
        goalId: row.goal_id,
        goalLabel: row.goal_label,
        amountCents: row.amount_cents,
        createdAt: row.created_at
      }));
      const body: EventsResponse = { events, nextBefore: results.length > limit ? (page[page.length - 1]?.created_at ?? null) : null };
      return c.json(body, 200, { "cache-control": "public, max-age=20, stale-while-revalidate=60" });
    })
  );
});

publicRoutes.get("/api/health", async (c) => {
  const status = await readJson<PublicStatusFile>(c.env.DATA, KEYS.status);
  if (!status) return c.json({ ok: false, reason: "no status yet" }, 503);
  const age = Date.now() - Date.parse(status.generatedAt);
  return c.json({ ok: age < 5 * 60 * 1000 && !status.stale, ageSeconds: Math.round(age / 1000), stale: status.stale, degraded: status.degraded }, 200, { "cache-control": "no-store" });
});
