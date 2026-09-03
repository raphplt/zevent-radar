import type { HistoryFile, PublicStatusFile, StreamerHistoryResponse } from "@zevent-radar/contracts";
import { Hono } from "hono";
import type { Env } from "../env";
import { KEYS, readJson } from "../lib/r2";

export const publicRoutes = new Hono<{ Bindings: Env }>();

const PUBLIC_FILES: Record<string, string> = {
  "latest.json": KEYS.latest,
  "goals.json": KEYS.goals,
  "status.json": KEYS.status
};

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
    await cached(c, `/data/${file}`, file === "goals.json" ? 60 : 15, async () => {
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

publicRoutes.get("/api/health", async (c) => {
  const status = await readJson<PublicStatusFile>(c.env.DATA, KEYS.status);
  if (!status) return c.json({ ok: false, reason: "no status yet" }, 503);
  const age = Date.now() - Date.parse(status.generatedAt);
  return c.json({ ok: age < 5 * 60 * 1000 && !status.stale, ageSeconds: Math.round(age / 1000), stale: status.stale, degraded: status.degraded }, 200, { "cache-control": "no-store" });
});
