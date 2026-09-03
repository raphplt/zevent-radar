import type { HistoryPoint } from "@zevent-radar/contracts";

export interface HistoryOptions {
  retentionMs: number;
  checkpointMs: number;
  fineWindowMs: number;
  coarseStepMs: number;
}

export const DEFAULT_HISTORY_OPTIONS: HistoryOptions = {
  retentionMs: 24 * 60 * 60 * 1000,
  checkpointMs: 5 * 60 * 1000,
  fineWindowMs: 6 * 60 * 60 * 1000,
  coarseStepMs: 5 * 60 * 1000
};

export function appendPoint(
  series: HistoryPoint[],
  point: HistoryPoint,
  options: HistoryOptions = DEFAULT_HISTORY_OPTIONS
): HistoryPoint[] {
  const [ts, cents] = point;
  const last = series[series.length - 1];
  let next = series;
  if (!last) {
    next = [point];
  } else if (ts <= last[0]) {
    next = series;
  } else if (last[1] !== cents || ts - last[0] >= options.checkpointMs) {
    next = [...series, point];
  }
  return thin(prune(next, ts - options.retentionMs), ts - options.fineWindowMs, options.coarseStepMs);
}

export function prune(series: HistoryPoint[], minTs: number): HistoryPoint[] {
  let firstKept = series.findIndex((p) => p[0] >= minTs);
  if (firstKept === -1) {
    const last = series[series.length - 1];
    return last ? [last] : [];
  }
  if (firstKept > 0) firstKept -= 1;
  return firstKept === 0 ? series : series.slice(firstKept);
}

export function thin(series: HistoryPoint[], fineFromTs: number, stepMs: number): HistoryPoint[] {
  const out: HistoryPoint[] = [];
  let lastKeptTs = -Infinity;
  for (let i = 0; i < series.length; i += 1) {
    const point = series[i] as HistoryPoint;
    const next = series[i + 1];
    if (point[0] >= fineFromTs || !next || next[0] >= fineFromTs || point[0] - lastKeptTs >= stepMs) {
      out.push(point);
      lastKeptTs = point[0];
    }
  }
  return out;
}

export function valueAt(series: HistoryPoint[], ts: number): number | null {
  let value: number | null = null;
  for (const [pts, cents] of series) {
    if (pts <= ts) value = cents;
    else break;
  }
  return value;
}

export function deltaOver(series: HistoryPoint[], nowTs: number, windowMs: number): number | null {
  const current = valueAt(series, nowTs);
  const before = valueAt(series, nowTs - windowMs);
  if (current === null || before === null) return null;
  return current - before;
}
