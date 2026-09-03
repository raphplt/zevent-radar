import type { Confidence, GoalRecord, HistoryPoint, PublicGoal, RadarEntry } from "@zevent-radar/contracts";
import { selectNextGoal } from "./goals";
import { classify, computeScore } from "./score";
import { computeConfidence, computeEta, computeVelocity, type VelocityResult } from "./velocity";

export interface StreamerSnapshotInput {
  id: string;
  online: boolean;
  amountCents: number;
  goals: GoalRecord[];
  series: HistoryPoint[];
}

export interface StreamerRadarResult {
  nextGoal: GoalRecord | null;
  remainingCents: number | null;
  progress: number | null;
  velocity: VelocityResult;
  etaSeconds: number | null;
  confidence: Confidence | null;
  entry: RadarEntry | null;
}

export function toPublicGoal(goal: GoalRecord): PublicGoal {
  return {
    id: goal.id,
    amountCents: goal.amountCents,
    label: goal.label,
    category: goal.category,
    status: goal.status,
    sourceUrl: goal.sourceUrl,
    reachedAt: goal.reachedAt,
    accomplishedAt: goal.accomplishedAt
  };
}

export function evaluateStreamer(input: StreamerSnapshotInput, nowMs: number, dataAgeSec: number, eventTotalCents: number): StreamerRadarResult {
  const velocity = computeVelocity(input.series, nowMs);
  const nextGoal = selectNextGoal(input.goals, input.amountCents, eventTotalCents);
  if (!nextGoal) {
    return { nextGoal: null, remainingCents: null, progress: null, velocity, etaSeconds: null, confidence: null, entry: null };
  }
  const remainingCents = nextGoal.amountCents - input.amountCents;
  const progress = nextGoal.amountCents > 0 ? input.amountCents / nextGoal.amountCents : 0;
  const etaSeconds = computeEta(remainingCents, velocity, dataAgeSec);
  const confidence = computeConfidence(velocity, dataAgeSec);
  const scoreInput = {
    goalCents: nextGoal.amountCents,
    remainingCents,
    etaSeconds,
    velocity,
    confidence,
    online: input.online,
    dataAgeSec
  };
  const category = classify(scoreInput);
  const entry: RadarEntry | null = category
    ? {
        streamerId: input.id,
        category,
        score: computeScore(scoreInput),
        remainingCents,
        progress,
        etaSeconds,
        confidence,
        velocityCentsPerMinute: velocity.centsPerMinute,
        goal: toPublicGoal(nextGoal)
      }
    : null;
  return { nextGoal, remainingCents, progress, velocity, etaSeconds, confidence, entry };
}

export function rankRadar(entries: RadarEntry[], limit = 40): RadarEntry[] {
  const order: Record<RadarEntry["category"], number> = { imminent: 0, very_close: 1, accelerating: 2, watch: 3 };
  return [...entries]
    .sort((a, b) => {
      if (a.category === "imminent" || b.category === "imminent") {
        if (a.category !== b.category) return order[a.category] - order[b.category];
      }
      return b.score - a.score;
    })
    .slice(0, limit);
}
