import type { Confidence, RadarCategory } from "@zevent-radar/contracts";
import { clamp } from "./math";
import type { VelocityResult } from "./velocity";

export const VERY_CLOSE_RATIO = 0.1;
export const VERY_CLOSE_CENTS = 200_000;
export const WATCH_RATIO = 0.25;
export const WATCH_CENTS = 500_000;
export const IMMINENT_SEC = 300;

export interface ScoreInput {
  goalCents: number;
  remainingCents: number;
  etaSeconds: number | null;
  velocity: VelocityResult;
  confidence: Confidence | null;
  online: boolean;
  dataAgeSec: number;
}

const CONFIDENCE_FACTOR: Record<Confidence, number> = { high: 1, medium: 0.8, low: 0.55 };

export function computeScore(input: ScoreInput): number {
  const progressProximity = input.goalCents > 0 ? clamp(1 - input.remainingCents / input.goalCents, 0, 1) ** 2 : 0;
  const etaProximity = input.etaSeconds !== null ? 1 / (1 + input.etaSeconds / IMMINENT_SEC) : 0;
  const proximity = 0.05 + Math.max(progressProximity, etaProximity);
  const velocity = input.velocity.centsPerMinute ?? 0;
  const momentum = 1 + Math.log10(1 + velocity / 10_000) + (input.velocity.accelerating ? 0.5 : 0);
  const liveBonus = input.online ? 1.2 : 0.7;
  const confidence = input.confidence ? CONFIDENCE_FACTOR[input.confidence] : 0.35;
  const freshness = input.dataAgeSec <= 120 ? 1 : input.dataAgeSec <= 300 ? 0.6 : 0.3;
  return Math.round(proximity * momentum * liveBonus * confidence * freshness * 1000) / 1000;
}

export function classify(input: ScoreInput): RadarCategory | null {
  const { remainingCents, goalCents, etaSeconds, velocity } = input;
  if (remainingCents <= 0) return null;
  if (etaSeconds !== null && etaSeconds <= IMMINENT_SEC) return "imminent";
  const veryClose = remainingCents <= goalCents * VERY_CLOSE_RATIO || remainingCents <= VERY_CLOSE_CENTS;
  if (veryClose) return "very_close";
  if (velocity.accelerating && (etaSeconds !== null || remainingCents <= goalCents * WATCH_RATIO)) return "accelerating";
  const watch = remainingCents <= goalCents * WATCH_RATIO || remainingCents <= WATCH_CENTS;
  if (watch) return "watch";
  return null;
}
