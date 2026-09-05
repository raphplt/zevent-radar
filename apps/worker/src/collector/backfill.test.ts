import type { EventTotalFile } from "@zevent-radar/contracts";
import { describe, expect, it } from "vitest";
import { backfillEventTotal, pickKeys, snapshotKeyToTs } from "./backfill";

const MIN = 60_000;
const START = Date.parse("2026-09-03T18:50:00.000Z");

function snapshotKey(ts: number): string {
  return `snapshots/${new Date(ts).toISOString().replace(/[:.]/g, "-")}.json`;
}

function fakeBucket(minutes: number, existing: EventTotalFile | null = null) {
  const objects = new Map<string, string>();
  for (let i = 0; i < minutes; i += 1) {
    const ts = START + i * MIN;
    objects.set(snapshotKey(ts), JSON.stringify({ generatedAt: new Date(ts).toISOString(), totalAmountCents: 1000 * i }));
  }
  if (existing) objects.set("event-total.json", JSON.stringify(existing));
  const lists: Array<{ startAfter?: string; cursor?: string }> = [];
  const bucket = {
    async list(options: { prefix: string; limit: number; startAfter?: string; cursor?: string }) {
      lists.push({ startAfter: options.startAfter, cursor: options.cursor });
      const keys = [...objects.keys()].filter((k) => k.startsWith(options.prefix)).sort();
      const from = options.cursor ?? options.startAfter;
      const remaining = from ? keys.filter((k) => k > from) : keys;
      const page = remaining.slice(0, options.limit);
      const truncated = remaining.length > page.length;
      return { objects: page.map((key) => ({ key })), truncated, cursor: truncated ? page[page.length - 1] : undefined };
    },
    async get(key: string) {
      const body = objects.get(key);
      return body === undefined ? null : { json: async () => JSON.parse(body) };
    },
    async put(key: string, body: string) {
      objects.set(key, body);
    }
  };
  return { bucket: bucket as unknown as R2Bucket, objects, lists };
}

describe("snapshotKeyToTs", () => {
  it("round-trips a snapshot key", () => {
    const ts = Date.parse("2026-09-03T18:50:16.384Z");
    expect(snapshotKeyToTs(snapshotKey(ts))).toBe(ts);
  });

  it("rejects foreign keys", () => {
    expect(snapshotKeyToTs("snapshots/latest.json")).toBeNull();
    expect(snapshotKeyToTs("latest.json")).toBeNull();
  });
});

describe("pickKeys", () => {
  it("keeps one key per step", () => {
    const keys = Array.from({ length: 12 }, (_, i) => snapshotKey(START + i * MIN));
    expect(pickKeys(keys, 5 * MIN)).toEqual([keys[0], keys[5], keys[10]]);
  });

  it("continues from a previous pick", () => {
    const keys = Array.from({ length: 12 }, (_, i) => snapshotKey(START + i * MIN));
    expect(pickKeys(keys, 5 * MIN, START - MIN)).toEqual([keys[4], keys[9]]);
  });
});

describe("backfillEventTotal", () => {
  it("rebuilds a five-minute series from minute snapshots", async () => {
    const { bucket, objects } = fakeBucket(31);
    const result = await backfillEventTotal(bucket);
    expect(result.nextAfter).toBeNull();
    expect(result.scanned).toBe(31);
    expect(result.selected).toBe(7);
    const file = JSON.parse(objects.get("event-total.json")!) as EventTotalFile;
    expect(file.points.map((p) => p[1])).toEqual([0, 5000, 10000, 15000, 20000, 25000, 30000]);
  });

  it("paginates with nextAfter and merges with the live series", async () => {
    const live: EventTotalFile = { updatedAt: "2026-09-03T19:20:00.000Z", points: [[START + 30 * MIN, 30000], [START + 31 * MIN, 31000]] };
    const { bucket, objects } = fakeBucket(32, live);
    const first = await backfillEventTotal(bucket, { limit: 3 });
    expect(first.selected).toBe(3);
    expect(first.nextAfter).toBe(snapshotKey(START + 10 * MIN));
    const second = await backfillEventTotal(bucket, { after: first.nextAfter!, limit: 10 });
    expect(second.nextAfter).toBeNull();
    const file = JSON.parse(objects.get("event-total.json")!) as EventTotalFile;
    expect(file.updatedAt).toBe(live.updatedAt);
    expect(file.points.map((p) => p[1])).toEqual([0, 5000, 10000, 15000, 20000, 25000, 30000, 31000]);
  });
});
