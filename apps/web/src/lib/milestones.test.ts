import { describe, expect, it } from "vitest";
import { crossedMilestones, nextMilestone } from "./milestones";

describe("milestones", () => {
  it("steps by 500k under 5M then by 1M", () => {
    expect(nextMilestone(0)).toBe(500_000_00);
    expect(nextMilestone(609_284_00)).toBe(1_000_000_00);
    expect(nextMilestone(4_999_999_00)).toBe(5_000_000_00);
    expect(nextMilestone(5_000_000_00)).toBe(6_000_000_00);
  });
  it("lists crossed milestones between two totals", () => {
    expect(crossedMilestones(999_000_00, 999_500_00)).toEqual([]);
    expect(crossedMilestones(999_000_00, 1_000_000_00)).toEqual([1_000_000_00]);
    expect(crossedMilestones(4_400_000_00, 6_100_000_00)).toEqual([4_500_000_00, 5_000_000_00, 6_000_000_00]);
  });
});
