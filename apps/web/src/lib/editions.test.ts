import { describe, expect, it } from "vitest";
import {
  alignPoints,
  compareAtStage,
  compactEuros,
  currentEdition,
  elapsedLabel,
  niceAmountScale,
  offsetForAmount,
  PAST_EDITIONS,
  rankAtStage,
  valueAtOffset,
  weekdayLabel,
  type Edition
} from "./editions";

const edition: Edition = {
  year: 2000,
  approximate: false,
  marathonStart: "2000-09-08T16:00:00.000Z",
  openedAt: "2000-09-07T18:00:00.000Z",
  endedAt: "2000-09-10T23:00:00.000Z",
  finalCents: 1_000_00,
  points: [
    [-1320, 0],
    [0, 100_00],
    [600, 500_00],
    [1800, 1_000_00]
  ]
};

describe("valueAtOffset", () => {
  it("is null before the first point", () => {
    expect(valueAtOffset(edition.points, -2000)).toBeNull();
  });
  it("returns the last point at or before the offset", () => {
    expect(valueAtOffset(edition.points, 599)).toEqual({ cents: 100_00, ended: false });
    expect(valueAtOffset(edition.points, 600)).toEqual({ cents: 500_00, ended: false });
  });
  it("flags an edition that already ended", () => {
    expect(valueAtOffset(edition.points, 1800)).toEqual({ cents: 1_000_00, ended: false });
    expect(valueAtOffset(edition.points, 2400)).toEqual({ cents: 1_000_00, ended: true });
  });
});

describe("offsetForAmount", () => {
  it("finds the first offset reaching the amount", () => {
    expect(offsetForAmount(edition.points, 300_00)).toBe(600);
    expect(offsetForAmount(edition.points, 2_000_00)).toBeNull();
  });

  it("does not know when a series that starts above the amount reached it", () => {
    expect(offsetForAmount([[1100, 4_000_000_00], [1105, 4_100_000_00]], 1_000_000_00)).toBeNull();
    expect(offsetForAmount([], 1)).toBeNull();
  });
});

describe("labels", () => {
  it("names the weekday and hour from the Friday 18:00 origin", () => {
    expect(weekdayLabel(0)).toBe("ven. 18h");
    expect(weekdayLabel(6 * 60)).toBe("sam. 00h");
    expect(weekdayLabel(-22 * 60)).toBe("jeu. 20h");
    expect(weekdayLabel(55 * 60 + 5, true)).toBe("lun. 01:05");
  });
  it("formats elapsed time", () => {
    expect(elapsedLabel(90)).toBe("1 h");
    expect(elapsedLabel(90, true)).toBe("1 h 30");
  });
  it("compacts amounts", () => {
    expect(compactEuros(16_179_096_00)).toBe("16,2 M€");
    expect(compactEuros(500_000_00)).toBe("500 k€");
  });
});

describe("alignment", () => {
  it("shifts points so that the opening is zero", () => {
    expect(alignPoints(edition, "opening")[0]).toEqual([0, 0]);
    expect(alignPoints(edition, "marathon")[0]).toEqual([-1320, 0]);
  });
});

describe("compareAtStage", () => {
  it("computes the gap and the rank", () => {
    const [c] = compareAtStage([edition], { offset: 600, cents: 400_00 }, "marathon");
    expect(c?.reading?.cents).toBe(500_00);
    expect(c?.gapCents).toBe(-100_00);
    expect(c?.reachedCurrentAt).toBe(600);
    expect(rankAtStage([c!])).toBe(2);
  });
  it("uses the opening of each edition on the opening axis", () => {
    const current = currentEdition([[Date.parse("2026-09-03T18:00:00.000Z"), 0]], 0);
    expect(current.points[0]).toEqual([-1320, 0]);
    const [c] = compareAtStage([edition], { offset: -1320 + 30, cents: 0 }, "opening");
    expect(c?.reading?.cents).toBe(0);
  });
});

describe("niceAmountScale", () => {
  it("keeps between three and six ticks", () => {
    expect(niceAmountScale(4_200_000_00)).toEqual({ max: 5_000_000_00, step: 1_000_000_00 });
    expect(niceAmountScale(16_200_000_00)).toEqual({ max: 20_000_000_00, step: 5_000_000_00 });
  });
});

describe("dataset", () => {
  it("ships monotonic curves ending at the official total", () => {
    for (const e of PAST_EDITIONS) {
      let last = -1;
      for (const [, cents] of e.points) {
        expect(cents).toBeGreaterThanOrEqual(last);
        last = cents;
      }
      expect(last).toBeLessThanOrEqual(e.finalCents);
    }
  });
});
