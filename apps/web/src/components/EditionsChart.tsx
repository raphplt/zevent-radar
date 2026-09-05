import clsx from "clsx";
import { useMemo, useState } from "react";
import { useElementWidth } from "@/hooks/useElementWidth";
import { axisLabel, compactEuros, niceAmountScale, valueAtOffset, type Alignment, type Edition, type OffsetPoint } from "@/lib/editions";
import { euros } from "@/lib/format";

export interface ChartSeries {
  edition: Edition;
  /** Points already shifted for the chosen alignment. */
  points: OffsetPoint[];
  current: boolean;
}

const KNOWN_COLOR_YEARS = new Set([2018, 2019, 2020, 2021, 2022, 2024, 2025, 2026]);
const PAD = { top: 14, right: 40, bottom: 24, left: 8 };
const SNAP_MINUTES = 5;
const LABEL_GAP = 12;

/** Every edition keeps its own colour (see styles.css); unknown years reuse the neutral one. */
export function editionColor(year: number): string {
  return `var(--ed-${KNOWN_COLOR_YEARS.has(year) ? year : 2018})`;
}

interface Drawn {
  series: ChartSeries;
  coords: Array<readonly [number, number]>;
  path: string;
  labelY: number;
}

/**
 * Global total of several editions on one axis. The current edition is the thick line; past ones are thin and
 * direct-labelled at their end, so identity never rests on colour alone. Drawn in pixels for crisp strokes.
 */
export function EditionsChart({ series, alignment, xMax, height = 300 }: { series: ChartSeries[]; alignment: Alignment; xMax: number; height?: number }) {
  const { ref, width } = useElementWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const chart = useMemo(() => {
    const visible = series.filter((s) => s.points.length > 0);
    if (visible.length === 0) return null;
    const xMin = Math.min(...visible.map((s) => s.points[0]![0]));
    const spanX = Math.max(60, xMax - xMin);
    let maxY = 0;
    for (const s of visible) for (const [m, c] of s.points) if (m <= xMax && c > maxY) maxY = c;
    const scale = niceAmountScale(maxY);
    const innerW = Math.max(10, width - PAD.left - PAD.right);
    const innerH = height - PAD.top - PAD.bottom;
    const x = (m: number) => PAD.left + ((m - xMin) / spanX) * innerW;
    const y = (c: number) => PAD.top + innerH - (c / scale.max) * innerH;
    const baseline = PAD.top + innerH;

    const drawn: Drawn[] = visible.map((s) => {
      const clipped: OffsetPoint[] = s.points.filter(([m]) => m <= xMax);
      const last = s.points[s.points.length - 1]!;
      if (last[0] > xMax) clipped.push([xMax, valueAtOffset(s.points, xMax)?.cents ?? clipped[clipped.length - 1]?.[1] ?? 0]);
      const coords = clipped.map(([m, c]) => [x(m), y(c)] as const);
      const path = coords.map(([px, py], i) => `${i === 0 ? "M" : "L"}${px.toFixed(1)},${py.toFixed(1)}`).join(" ");
      const end = coords[coords.length - 1] ?? [x(xMin), baseline];
      return { series: s, coords, path, labelY: end[1] };
    });
    // Spread end labels so they never overlap: walk from the top and push each label below the previous one.
    const ordered = [...drawn].sort((a, b) => a.labelY - b.labelY);
    for (let i = 1; i < ordered.length; i += 1) {
      const prev = ordered[i - 1]!;
      const cur = ordered[i]!;
      if (cur.labelY - prev.labelY < LABEL_GAP) cur.labelY = prev.labelY + LABEL_GAP;
    }
    const overflow = (ordered[ordered.length - 1]?.labelY ?? 0) - (baseline + 4);
    if (overflow > 0) for (const d of ordered) d.labelY -= overflow;

    const hoursSpan = spanX / 60;
    const pxPerHour = innerW / hoursSpan;
    const stepHours = pxPerHour * 6 >= 64 ? 6 : pxPerHour * 12 >= 64 ? 12 : 24;
    const ticks: Array<{ x: number; label: string }> = [];
    const firstTick = Math.ceil(xMin / (stepHours * 60)) * stepHours * 60;
    for (let m = firstTick; m <= xMax; m += stepHours * 60) ticks.push({ x: x(m), label: axisLabel(m, alignment) });
    const gridlines: Array<{ y: number; label: string }> = [];
    for (let c = scale.step; c <= scale.max; c += scale.step) gridlines.push({ y: y(c), label: compactEuros(c) });

    return { drawn, xMin, spanX, innerW, innerH, baseline, ticks, gridlines, x, y };
  }, [series, alignment, xMax, width, height]);

  const hovered = useMemo(() => {
    if (!chart || hover === null) return null;
    const rows = chart.drawn
      .map((d) => ({ series: d.series, reading: valueAtOffset(d.series.points, hover) }))
      .filter((r) => r.reading !== null)
      .sort((a, b) => (b.reading?.cents ?? 0) - (a.reading?.cents ?? 0));
    return { offset: hover, x: chart.x(hover), rows };
  }, [chart, hover]);

  function onMove(event: React.PointerEvent<SVGSVGElement>) {
    if (!chart) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const px = event.clientX - rect.left;
    const raw = chart.xMin + ((px - PAD.left) / chart.innerW) * chart.spanX;
    const snapped = Math.round(raw / SNAP_MINUTES) * SNAP_MINUTES;
    setHover(Math.min(xMax, Math.max(chart.xMin, snapped)));
  }

  const tooltipLeft = hovered ? (hovered.x > width * 0.6 ? Math.max(0, hovered.x - 196) : Math.min(width - 190, hovered.x + 12)) : 0;

  return (
    <div ref={ref} className="relative w-full select-none">
      {!chart ? (
        <div className="flex items-center justify-center text-xs text-muted" style={{ height }}>Aucune édition à afficher</div>
      ) : (
        <svg width={width} height={height} role="img" aria-label="Cagnotte globale par édition" onPointerMove={onMove} onPointerLeave={() => setHover(null)} className="block touch-none">
          {chart.gridlines.map((g) => (
            <g key={g.label}>
              <line x1={PAD.left} x2={width - PAD.right} y1={g.y} y2={g.y} stroke="currentColor" strokeOpacity="0.08" />
              <text x={PAD.left + 2} y={g.y - 3} fontSize="10" fill="currentColor" fillOpacity="0.55">{g.label}</text>
            </g>
          ))}
          <line x1={PAD.left} x2={width - PAD.right} y1={chart.baseline} y2={chart.baseline} stroke="currentColor" strokeOpacity="0.2" />
          {chart.ticks.map((tick) => (
            <g key={tick.label + tick.x}>
              <line x1={tick.x} x2={tick.x} y1={chart.baseline} y2={chart.baseline + 4} stroke="currentColor" strokeOpacity="0.3" />
              <text x={tick.x} y={height - 7} textAnchor="middle" fontSize="10" fill="currentColor" fillOpacity="0.6">{tick.label}</text>
            </g>
          ))}
          {chart.drawn.map((d) => (
            <path key={d.series.edition.year} d={d.path} fill="none" stroke={editionColor(d.series.edition.year)} strokeWidth={d.series.current ? 3 : 1.5} strokeOpacity={d.series.current ? 1 : 0.85} strokeDasharray={d.series.edition.approximate ? "4 4" : undefined} strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {chart.drawn.map((d) => {
            const end = d.coords[d.coords.length - 1];
            if (!end) return null;
            return (
              <text key={`label-${d.series.edition.year}`} x={end[0] + 6} y={d.labelY + 3.5} fontSize="10" fontWeight={d.series.current ? 700 : 500} fill="currentColor" fillOpacity={d.series.current ? 0.95 : 0.7}>
                {d.series.edition.year}
              </text>
            );
          })}
          {hovered === null
            ? chart.drawn
                .filter((d) => d.series.current)
                .map((d) => {
                  const end = d.coords[d.coords.length - 1];
                  return end ? <circle key="now" cx={end[0]} cy={end[1]} r="4.5" fill={editionColor(d.series.edition.year)} stroke="var(--surface)" strokeWidth="2" /> : null;
                })
            : (
                <g>
                  <line x1={hovered.x} x2={hovered.x} y1={PAD.top} y2={chart.baseline} stroke="currentColor" strokeOpacity="0.35" strokeDasharray="3 3" />
                  {hovered.rows.map((row) => (
                    <circle key={row.series.edition.year} cx={hovered.x} cy={chart.y(row.reading!.cents)} r={row.series.current ? 5 : 3.5} fill={editionColor(row.series.edition.year)} stroke="var(--surface)" strokeWidth="2" />
                  ))}
                </g>
              )}
        </svg>
      )}
      {chart && hovered && (
        <div className="pointer-events-none absolute top-1 w-[184px] rounded-lg border border-border bg-surface px-2.5 py-2 text-xs shadow-lg" style={{ left: tooltipLeft }}>
          <p className="mb-1 font-semibold text-muted">{axisLabel(hovered.offset, alignment, true)}</p>
          <ul className="space-y-0.5">
            {hovered.rows.map((row) => (
              <li key={row.series.edition.year} className={clsx("flex items-center gap-1.5", row.series.current && "font-bold")}>
                <span className="inline-block h-2 w-2 shrink-0 rounded-sm" style={{ background: editionColor(row.series.edition.year) }} />
                <span className="w-9 shrink-0 text-muted">{row.series.edition.year}</span>
                <span className="ml-auto tabular-nums">{euros(row.reading!.cents)}</span>
                {row.reading!.ended && <span className="text-[10px] text-muted">fin</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
