import type { HistoryPoint } from "@zevent-radar/contracts";
import { describe, expect, it, vi } from "vitest";
import { downsample, publicRoutes } from "./public";

describe("downsample", () => {
  it("keeps short series untouched", () => {
    const points: HistoryPoint[] = [[1, 1], [2, 2]];
    expect(downsample(points, 10)).toBe(points);
  });

  it("keeps the first and last points and respects the cap", () => {
    const points: HistoryPoint[] = Array.from({ length: 1000 }, (_, i) => [i, i * 2]);
    const out = downsample(points, 120);
    expect(out).toHaveLength(120);
    expect(out[0]).toEqual([0, 0]);
    expect(out[out.length - 1]).toEqual([999, 1998]);
  });
});

function fakeEnv(rows: Array<Record<string, unknown>>, capture: { sql?: string; binds?: unknown[] }) {
  return {
    DB: {
      prepare(sql: string) {
        capture.sql = sql;
        return {
          bind(...binds: unknown[]) {
            capture.binds = binds;
            return { all: async () => ({ results: rows }) };
          }
        };
      }
    },
    DATA: { get: async () => null }
  };
}

function row(i: number) {
  return { id: `e${i}`, kind: "goal_reached", streamer_id: "s1", streamer_login: "s1", streamer_display_name: "S1", goal_id: null, goal_label: null, amount_cents: 100 * i, created_at: `2026-09-04T18:0${i}:00.000Z` };
}

describe("GET /api/events", () => {
  vi.stubGlobal("caches", { default: { match: async () => undefined, put: async () => undefined } });
  const ctx = { waitUntil: () => undefined };

  it("paginates with a nextBefore cursor and filters by kind", async () => {
    const capture: { sql?: string; binds?: unknown[] } = {};
    const res = await publicRoutes.request("/api/events?limit=2&kind=goal_reached&before=2026-09-04T19:00:00.000Z", {}, fakeEnv([row(3), row(2), row(1)], capture), ctx as never);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { events: Array<{ id: string }>; nextBefore: string | null };
    expect(body.events.map((e) => e.id)).toEqual(["e3", "e2"]);
    expect(body.nextBefore).toBe("2026-09-04T18:02:00.000Z");
    expect(capture.sql).toContain("created_at < ?");
    expect(capture.sql).toContain("kind = ?");
    expect(capture.binds).toEqual(["2026-09-04T19:00:00.000Z", "goal_reached", 3]);
  });

  it("ends pagination when no more rows", async () => {
    const res = await publicRoutes.request("/api/events?limit=5", {}, fakeEnv([row(1)], {}), ctx as never);
    const body = (await res.json()) as { nextBefore: string | null };
    expect(body.nextBefore).toBeNull();
  });

  it("rejects unknown kinds", async () => {
    const res = await publicRoutes.request("/api/events?kind=nope", {}, fakeEnv([], {}), ctx as never);
    expect(res.status).toBe(400);
  });
});
