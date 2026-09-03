import type { GoalRecord, HistoryPoint } from "@zevent-radar/contracts";
import { evaluateStreamer, rankRadar } from "./radar";

const MIN = 60_000;

function goal(amountCents: number, status: GoalRecord["status"] = "verified"): GoalRecord {
  return {
    id: `g-${amountCents}`,
    streamerId: "s1",
    amountCents,
    label: "goal",
    category: "donation",
    status,
    sourceUrl: null,
    sourceName: null,
    verifiedAt: null,
    reachedAt: null,
    accomplishedAt: null,
    createdAt: "",
    updatedAt: ""
  };
}

function series(now: number, perMinute: number, end: number): HistoryPoint[] {
  const points: HistoryPoint[] = [];
  for (let i = 5; i >= 0; i -= 1) points.push([now - i * MIN, end - i * perMinute]);
  return points;
}

describe("evaluateStreamer", () => {
  const now = 10_000_000;

  it("marks an imminent goal when the ETA is under five minutes", () => {
    const result = evaluateStreamer(
      { id: "s1", online: true, amountCents: 980_000, goals: [goal(1_000_000)], series: series(now, 10_000, 980_000) },
      now,
      20,
      0
    );
    expect(result.etaSeconds).toBe(120);
    expect(result.entry?.category).toBe("imminent");
    expect(result.confidence).toBe("high");
  });

  it("marks very close goals without velocity", () => {
    const result = evaluateStreamer(
      { id: "s1", online: false, amountCents: 950_000, goals: [goal(1_000_000)], series: [[now - MIN, 950_000]] },
      now,
      20,
      0
    );
    expect(result.etaSeconds).toBeNull();
    expect(result.entry?.category).toBe("very_close");
  });

  it("excludes far goals", () => {
    const result = evaluateStreamer(
      { id: "s1", online: false, amountCents: 100_000, goals: [goal(10_000_000)], series: [] },
      now,
      20,
      0
    );
    expect(result.entry).toBeNull();
    expect(result.nextGoal?.amountCents).toBe(10_000_000);
  });

  it("returns nothing without an active goal", () => {
    const result = evaluateStreamer({ id: "s1", online: true, amountCents: 100, goals: [goal(50, "reached")], series: [] }, now, 20, 0);
    expect(result.nextGoal).toBeNull();
  });
});

describe("rankRadar", () => {
  it("puts imminent entries first then sorts by score", () => {
    const base = { streamerId: "x", remainingCents: 1, progress: 0.9, etaSeconds: null, confidence: null, velocityCentsPerMinute: null, goal: { id: "g", amountCents: 1, label: "", category: "donation" as const, status: "verified" as const, sourceUrl: null, reachedAt: null, accomplishedAt: null } };
    const ranked = rankRadar([
      { ...base, streamerId: "a", category: "watch", score: 5 },
      { ...base, streamerId: "b", category: "imminent", score: 1 },
      { ...base, streamerId: "c", category: "very_close", score: 3 }
    ]);
    expect(ranked.map((e) => e.streamerId)).toEqual(["b", "a", "c"]);
  });
});
