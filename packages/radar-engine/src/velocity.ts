import type { Confidence, HistoryPoint } from "@zevent-radar/contracts";
import { median, mean, stddev } from "./math";
import { valueAt } from "./history";

export const VELOCITY_WINDOW_MS = 5 * 60 * 1000;
export const MINUTE_MS = 60 * 1000;
export const MIN_SAMPLES = 3;
export const MAX_DATA_AGE_SEC = 120;
export const MAX_ETA_SEC = 3600;
export const HIGH_VOLATILITY = 2;
export const MEDIUM_VOLATILITY = 0.8;

export interface VelocityResult {
  centsPerMinute: number | null;
  samples: number;
  deltas: number[];
  volatility: number;
  accelerating: boolean;
  lastDelta: number;
}

export function computeVelocity(series: HistoryPoint[], nowMs: number): VelocityResult {
  const windowStart = nowMs - VELOCITY_WINDOW_MS;
  const samples = series.filter((p) => p[0] > windowStart && p[0] <= nowMs).length;
  const minutes = Math.round(VELOCITY_WINDOW_MS / MINUTE_MS);
  const values: Array<number | null> = [];
  for (let i = minutes; i >= 0; i -= 1) {
    values.push(valueAt(series, nowMs - i * MINUTE_MS));
  }
  const deltas: number[] = [];
  for (let i = 1; i < values.length; i += 1) {
    const prev = values[i - 1];
    const cur = values[i];
    if (prev === null || cur === null || cur === undefined || prev === undefined) continue;
    deltas.push(Math.max(0, cur - prev));
  }
  const lastDelta = deltas[deltas.length - 1] ?? 0;
  const med = median(deltas);
  const positive = deltas.filter((d) => d > 0);
  const volatility = positive.length >= 2 && mean(positive) > 0 ? stddev(positive) / mean(positive) : 0;
  const centsPerMinute = samples >= MIN_SAMPLES && med > 0 ? med : null;
  const accelerating = med > 0 && lastDelta >= 2 * med && lastDelta > 0;
  return { centsPerMinute, samples, deltas, volatility, accelerating, lastDelta };
}

export function computeEta(remainingCents: number, velocity: VelocityResult, dataAgeSec: number): number | null {
  if (remainingCents <= 0) return 0;
  if (velocity.centsPerMinute === null || velocity.centsPerMinute <= 0) return null;
  if (velocity.samples < MIN_SAMPLES) return null;
  if (dataAgeSec > MAX_DATA_AGE_SEC) return null;
  if (velocity.volatility > HIGH_VOLATILITY) return null;
  const seconds = Math.round((remainingCents / velocity.centsPerMinute) * 60);
  if (seconds > MAX_ETA_SEC) return null;
  return seconds;
}

export function computeConfidence(velocity: VelocityResult, dataAgeSec: number): Confidence | null {
  if (velocity.centsPerMinute === null) return null;
  if (velocity.samples >= 4 && velocity.volatility <= MEDIUM_VOLATILITY && dataAgeSec <= 90) return "high";
  if (velocity.samples >= MIN_SAMPLES && velocity.volatility <= HIGH_VOLATILITY) return "medium";
  return "low";
}
