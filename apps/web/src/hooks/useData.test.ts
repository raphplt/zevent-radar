import { describe, expect, it } from "vitest";
import { mergeHistoryPoints } from "./useData";

describe("mergeHistoryPoints", () => {
  it("unions both series by timestamp, sorted, with the long series winning on ties", () => {
    expect(mergeHistoryPoints([[300, 30], [600, 60]], [[100, 10], [300, 31], [400, 40]])).toEqual([[100, 10], [300, 30], [400, 40], [600, 60]]);
  });

  it("returns the other series untouched when one is empty", () => {
    const base = [[1, 1]] as Array<[number, number]>;
    expect(mergeHistoryPoints(base, [])).toBe(base);
    expect(mergeHistoryPoints([], base)).toBe(base);
  });
});
