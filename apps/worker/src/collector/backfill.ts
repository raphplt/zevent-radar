import type { EventTotalFile, HistoryPoint } from "@zevent-radar/contracts";
import { EVENT_TOTAL_HISTORY_OPTIONS, mergeSeries } from "@zevent-radar/radar-engine";
import { KEYS, readJson, writeJson } from "../lib/r2";

const SNAPSHOT_PREFIX = "snapshots/";
const LIST_PAGE = 1000;
const FETCH_CONCURRENCY = 20;
const DEFAULT_LIMIT = 300;
const MAX_LIMIT = 900;

interface SnapshotTotal {
  generatedAt: string;
  totalAmountCents: number;
}

export interface BackfillOptions {
  /** Resume after this snapshot key (from a previous `nextAfter`). */
  after?: string;
  /** Maximum number of snapshots read in this call; keeps a single request within the subrequest budget. */
  limit?: number;
}

export interface BackfillResult {
  scanned: number;
  selected: number;
  added: number;
  points: number;
  nextAfter: string | null;
}

/** Parses `snapshots/2026-09-03T18-50-16-384Z.json` (colons and dots replaced by dashes) back to a timestamp. */
export function snapshotKeyToTs(key: string): number | null {
  const match = /^snapshots\/(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z\.json$/.exec(key);
  if (!match) return null;
  const ts = Date.parse(`${match[1]}T${match[2]}:${match[3]}:${match[4]}.${match[5]}Z`);
  return Number.isNaN(ts) ? null : ts;
}

/** Keeps keys at least `stepMs` apart, walking in order; `fromTs` is the timestamp of the last key kept by a previous call. */
export function pickKeys(keys: string[], stepMs: number, fromTs = -Infinity): string[] {
  const picked: string[] = [];
  let lastTs = fromTs;
  for (const key of keys) {
    const ts = snapshotKeyToTs(key);
    if (ts === null || ts - lastTs < stepMs) continue;
    picked.push(key);
    lastTs = ts;
  }
  return picked;
}

/**
 * Rebuilds the whole-edition total series from the minute snapshots kept in R2, one point per step.
 * Snapshots are listed in key order (chronological), read at most `limit` at a time, and merged into `event-total.json`.
 * Call again with `after = nextAfter` until it comes back null.
 */
export async function backfillEventTotal(bucket: R2Bucket, options: BackfillOptions = {}): Promise<BackfillResult> {
  const limit = Math.min(MAX_LIMIT, Math.max(1, options.limit ?? DEFAULT_LIMIT));
  const stepMs = EVENT_TOTAL_HISTORY_OPTIONS.coarseStepMs;
  const selected: string[] = [];
  let scanned = 0;
  let lastKey: string | null = null;
  let lastPickedTs = options.after ? (snapshotKeyToTs(options.after) ?? -Infinity) : -Infinity;
  let cursor: string | undefined;
  let more = false;

  listing: while (true) {
    const page: R2Objects = await bucket.list(cursor ? { prefix: SNAPSHOT_PREFIX, limit: LIST_PAGE, cursor } : { prefix: SNAPSHOT_PREFIX, limit: LIST_PAGE, startAfter: options.after });
    for (let i = 0; i < page.objects.length; i += 1) {
      const object = page.objects[i]!;
      scanned += 1;
      lastKey = object.key;
      const ts = snapshotKeyToTs(object.key);
      if (ts !== null && ts - lastPickedTs >= stepMs) {
        selected.push(object.key);
        lastPickedTs = ts;
      }
      if (selected.length >= limit) {
        more = i < page.objects.length - 1 || page.truncated;
        break listing;
      }
    }
    if (!page.truncated) break;
    cursor = page.cursor;
  }

  const points: HistoryPoint[] = [];
  let index = 0;
  async function worker(): Promise<void> {
    while (index < selected.length) {
      const key = selected[index];
      index += 1;
      if (!key) return;
      const snapshot = await readJson<SnapshotTotal>(bucket, key);
      if (!snapshot || typeof snapshot.totalAmountCents !== "number") continue;
      const ts = Date.parse(snapshot.generatedAt);
      if (!Number.isNaN(ts)) points.push([ts, snapshot.totalAmountCents]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(FETCH_CONCURRENCY, selected.length) }, () => worker()));
  points.sort((a, b) => a[0] - b[0]);

  const existing = await readJson<EventTotalFile>(bucket, KEYS.eventTotal);
  const before = existing?.points ?? [];
  const merged = mergeSeries(before, points, stepMs);
  if (merged.length !== before.length || points.length > 0) {
    const file: EventTotalFile = { updatedAt: existing?.updatedAt ?? new Date().toISOString(), points: merged };
    await writeJson(bucket, KEYS.eventTotal, file, "public, max-age=60");
  }
  return { scanned, selected: selected.length, added: merged.length - before.length, points: merged.length, nextAfter: more && lastKey ? lastKey : null };
}
