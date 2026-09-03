import type { HistoryPoint } from "@zevent-radar/contracts";
import { appendPoint, deltaOver, prune, thin, valueAt } from "./history";

const MIN = 60_000;

describe("appendPoint", () => {
  it("adds a point when the amount changes", () => {
    const s = appendPoint([[0, 100]], [MIN, 200]);
    expect(s).toHaveLength(2);
  });

  it("skips a point when nothing changed within the checkpoint interval", () => {
    const s = appendPoint([[0, 100]], [MIN, 100]);
    expect(s).toHaveLength(1);
  });

  it("adds a checkpoint after five minutes without change", () => {
    const s = appendPoint([[0, 100]], [5 * MIN, 100]);
    expect(s).toHaveLength(2);
  });

  it("ignores points older than the last one", () => {
    const s = appendPoint([[MIN, 100]], [0, 50]);
    expect(s).toEqual([[MIN, 100]]);
  });

  it("prunes points beyond retention but keeps one baseline", () => {
    const series: HistoryPoint[] = [
      [0, 1],
      [MIN, 2],
      [2 * MIN, 3]
    ];
    expect(prune(series, 2 * MIN)).toEqual([
      [MIN, 2],
      [2 * MIN, 3]
    ]);
    expect(prune(series, 10 * MIN)).toEqual([[2 * MIN, 3]]);
  });
});

describe("valueAt", () => {
  it("carries the last known value forward", () => {
    const series: HistoryPoint[] = [
      [0, 1],
      [2 * MIN, 3]
    ];
    expect(valueAt(series, MIN)).toBe(1);
    expect(valueAt(series, 3 * MIN)).toBe(3);
    expect(valueAt(series, -1)).toBeNull();
  });
});

describe("thin", () => {
  it("keeps every point in the fine window and one per step before", () => {
    const series: HistoryPoint[] = [];
    for (let i = 0; i < 20; i += 1) series.push([i * MIN, i]);
    const thinned = thin(series, 10 * MIN, 5 * MIN);
    const old = thinned.filter((p) => p[0] < 9 * MIN).map((p) => p[0] / MIN);
    expect(old).toEqual([0, 5]);
    expect(thinned.filter((p) => p[0] >= 10 * MIN)).toHaveLength(10);
  });
});

describe("deltaOver", () => {
  it("returns the increase over a window", () => {
    const series: HistoryPoint[] = [
      [0, 100],
      [3 * MIN, 150],
      [6 * MIN, 200]
    ];
    expect(deltaOver(series, 6 * MIN, 5 * MIN)).toBe(100);
    expect(deltaOver(series, 2 * MIN, 5 * MIN)).toBeNull();
  });
});
