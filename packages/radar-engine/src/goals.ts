import { ACTIVE_STATUSES, COMPARABLE_CATEGORIES, type GoalRecord } from "@zevent-radar/contracts";

export function referenceAmount(goal: Pick<GoalRecord, "category">, streamerCents: number, eventTotalCents: number): number {
  return goal.category === "global" ? eventTotalCents : streamerCents;
}

export function isTrackable(goal: Pick<GoalRecord, "category" | "status">): boolean {
  return COMPARABLE_CATEGORIES.has(goal.category) && ACTIVE_STATUSES.has(goal.status);
}

export function selectNextGoal<T extends Pick<GoalRecord, "amountCents" | "category" | "status">>(
  goals: T[],
  streamerCents: number,
  eventTotalCents: number
): T | null {
  let best: T | null = null;
  for (const goal of goals) {
    if (goal.category !== "donation" || !ACTIVE_STATUSES.has(goal.status)) continue;
    if (goal.amountCents <= streamerCents) continue;
    if (!best || goal.amountCents < best.amountCents) best = goal;
  }
  if (best) return best;
  return null;
}

export function detectReachedGoals<T extends Pick<GoalRecord, "amountCents" | "category" | "status">>(
  goals: T[],
  previousCents: number,
  currentCents: number,
  scope: "donation" | "global" = "donation"
): T[] {
  if (currentCents <= previousCents) return [];
  return goals
    .filter((g) => g.category === scope && ACTIVE_STATUSES.has(g.status))
    .filter((g) => g.amountCents > previousCents && g.amountCents <= currentCents)
    .sort((a, b) => a.amountCents - b.amountCents);
}

export function nextRecurrentMilestone(stepCents: number, currentCents: number): number | null {
  if (stepCents <= 0) return null;
  return (Math.floor(currentCents / stepCents) + 1) * stepCents;
}
