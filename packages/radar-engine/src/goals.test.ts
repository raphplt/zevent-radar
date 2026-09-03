import type { GoalRecord } from "@zevent-radar/contracts";
import { detectReachedGoals, nextRecurrentMilestone, selectNextGoal } from "./goals";

function goal(partial: Partial<GoalRecord> & Pick<GoalRecord, "amountCents">): GoalRecord {
  return {
    id: `g-${partial.amountCents}`,
    streamerId: "s1",
    label: "goal",
    category: "donation",
    status: "verified",
    sourceUrl: null,
    sourceName: null,
    verifiedAt: null,
    reachedAt: null,
    accomplishedAt: null,
    createdAt: "",
    updatedAt: "",
    ...partial
  };
}

describe("selectNextGoal", () => {
  const goals = [goal({ amountCents: 500_000 }), goal({ amountCents: 100_000 }), goal({ amountCents: 200_000 })];

  it("picks the smallest goal above the current amount", () => {
    expect(selectNextGoal(goals, 150_000, 0)?.amountCents).toBe(200_000);
  });

  it("ignores reached, rejected and non comparable goals", () => {
    const list = [
      goal({ amountCents: 160_000, status: "reached" }),
      goal({ amountCents: 170_000, status: "rejected" }),
      goal({ amountCents: 180_000, category: "incentive" }),
      goal({ amountCents: 190_000, category: "global" }),
      goal({ amountCents: 300_000 })
    ];
    expect(selectNextGoal(list, 150_000, 0)?.amountCents).toBe(300_000);
  });

  it("returns null when everything is reached", () => {
    expect(selectNextGoal(goals, 600_000, 0)).toBeNull();
  });
});

describe("detectReachedGoals", () => {
  const goals = [goal({ amountCents: 100_000 }), goal({ amountCents: 200_000 }), goal({ amountCents: 300_000 })];

  it("detects several goals crossed between two measures", () => {
    expect(detectReachedGoals(goals, 90_000, 250_000).map((g) => g.amountCents)).toEqual([100_000, 200_000]);
  });

  it("does not fire on equal previous amount", () => {
    expect(detectReachedGoals(goals, 100_000, 150_000)).toHaveLength(0);
  });

  it("does not fire on a decrease", () => {
    expect(detectReachedGoals(goals, 250_000, 90_000)).toHaveLength(0);
  });
});

describe("nextRecurrentMilestone", () => {
  it("computes the next multiple", () => {
    expect(nextRecurrentMilestone(5_000, 12_000)).toBe(15_000);
    expect(nextRecurrentMilestone(5_000, 15_000)).toBe(20_000);
    expect(nextRecurrentMilestone(0, 15_000)).toBeNull();
  });
});
