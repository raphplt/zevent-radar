import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { alignPoints, currentEdition, PAST_EDITIONS } from "@/lib/editions";
import { EditionsChart } from "./EditionsChart";

describe("EditionsChart", () => {
  it("draws one path and one end label per edition, the current one thicker", () => {
    const current = currentEdition([[Date.parse("2026-09-03T18:50:00.000Z"), 99_000_00], [Date.parse("2026-09-05T09:46:00.000Z"), 4_118_870_76]], 4_118_870_76);
    const series = [...PAST_EDITIONS.filter((e) => !e.approximate).map((e) => ({ edition: e, points: alignPoints(e, "marathon"), current: false })), { edition: current, points: alignPoints(current, "marathon"), current: true }];
    const { container } = render(<EditionsChart series={series} alignment="marathon" xMax={60 * 60} />);
    const paths = container.querySelectorAll("path");
    expect(paths).toHaveLength(series.length);
    expect([...paths].filter((p) => p.getAttribute("stroke-width") === "3")).toHaveLength(1);
    const labels = [...container.querySelectorAll("text")].map((t) => t.textContent);
    for (const s of series) expect(labels).toContain(String(s.edition.year));
    expect(labels).toContain("ven. 18h");
    expect(labels.some((l) => l?.endsWith("M€"))).toBe(true);
  });

  it("shows an empty state without series", () => {
    const { getByText } = render(<EditionsChart series={[]} alignment="opening" xMax={100} />);
    expect(getByText("Aucune édition à afficher")).toBeTruthy();
  });
});
