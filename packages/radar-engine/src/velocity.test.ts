import type { HistoryPoint } from "@zevent-radar/contracts";
import { computeConfidence, computeEta, computeVelocity } from "./velocity";

const MIN = 60_000;

function linear(now: number, perMinute: number, minutes: number, start = 100_000): HistoryPoint[] {
  const points: HistoryPoint[] = [];
  for (let i = minutes; i >= 0; i -= 1) {
    points.push([now - i * MIN, start + (minutes - i) * perMinute]);
  }
  return points;
}

describe("computeVelocity", () => {
  it("returns the median increase per minute on a steady series", () => {
    const now = 10_000_000;
    const v = computeVelocity(linear(now, 5_000, 5), now);
    expect(v.centsPerMinute).toBe(5_000);
    expect(v.samples).toBe(5);
    expect(v.accelerating).toBe(false);
  });

  it("ignores exceptional spikes thanks to the median", () => {
    const now = 10_000_000;
    const series = linear(now, 5_000, 5);
    series[3] = [series[3]![0], series[3]![1] + 500_000];
    series[4] = [series[4]![0], series[4]![1] + 500_000];
    series[5] = [series[5]![0], series[5]![1] + 500_000];
    const v = computeVelocity(series, now);
    expect(v.centsPerMinute).toBe(5_000);
  });

  it("returns null with fewer than three samples", () => {
    const now = 10_000_000;
    const series: HistoryPoint[] = [
      [now - 10 * MIN, 100_000],
      [now - 2 * MIN, 120_000]
    ];
    expect(computeVelocity(series, now).centsPerMinute).toBeNull();
  });

  it("returns null when the amount does not move", () => {
    const now = 10_000_000;
    const series: HistoryPoint[] = [
      [now - 4 * MIN, 100_000],
      [now - 3 * MIN, 100_000],
      [now - 2 * MIN, 100_000],
      [now - 1 * MIN, 100_000]
    ];
    expect(computeVelocity(series, now).centsPerMinute).toBeNull();
  });

  it("flags acceleration when the last minute doubles the median", () => {
    const now = 10_000_000;
    const series = linear(now, 5_000, 5);
    series[5] = [series[5]![0], series[4]![1] + 20_000];
    expect(computeVelocity(series, now).accelerating).toBe(true);
  });
});

describe("computeEta", () => {
  const now = 10_000_000;
  const velocity = computeVelocity(linear(now, 10_000, 5), now);

  it("estimates remaining time in seconds", () => {
    expect(computeEta(50_000, velocity, 30)).toBe(300);
  });

  it("returns zero when the goal is already reached", () => {
    expect(computeEta(0, velocity, 30)).toBe(0);
  });

  it("refuses stale data", () => {
    expect(computeEta(50_000, velocity, 200)).toBeNull();
  });

  it("refuses estimates over one hour", () => {
    expect(computeEta(10_000_000, velocity, 30)).toBeNull();
  });

  it("refuses when volatility is too high", () => {
    expect(computeEta(50_000, { ...velocity, volatility: 3 }, 30)).toBeNull();
  });
});

describe("computeConfidence", () => {
  const now = 10_000_000;
  it("is high on a stable fresh series", () => {
    expect(computeConfidence(computeVelocity(linear(now, 10_000, 5), now), 30)).toBe("high");
  });
  it("is medium when the data is older", () => {
    expect(computeConfidence(computeVelocity(linear(now, 10_000, 5), now), 100)).toBe("medium");
  });
  it("is null without velocity", () => {
    expect(computeConfidence(computeVelocity([], now), 10)).toBeNull();
  });
});
