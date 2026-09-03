import { duration, euros, percent, relativeTime } from "./format";

describe("format", () => {
  it("formats euros from cents", () => {
    expect(euros(150000).replace(/ | /g, " ")).toBe("1 500 €");
    expect(euros(1250).replace(/ | /g, " ")).toBe("12,50 €");
  });

  it("formats durations", () => {
    expect(duration(0)).toBe("maintenant");
    expect(duration(45)).toBe("45 s");
    expect(duration(300)).toBe("5 min");
    expect(duration(3900)).toBe("1 h 05");
  });

  it("formats relative time", () => {
    const now = Date.parse("2026-09-05T12:00:00Z");
    expect(relativeTime("2026-09-05T11:59:58Z", now)).toBe("à l'instant");
    expect(relativeTime("2026-09-05T11:58:00Z", now)).toBe("il y a 2 min");
  });

  it("clamps percentages", () => {
    expect(percent(1.4)).toBe("100 %");
    expect(percent(0.256)).toBe("26 %");
  });
});
