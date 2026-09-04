import type { HistoryPoint } from "@zevent-radar/contracts";
import { useMemo, useState } from "react";
import { useElementWidth } from "@/hooks/useElementWidth";
import { clockTime, euros } from "@/lib/format";

const PAD = { top: 12, right: 12, bottom: 22, left: 8 };

/** Single-series area chart with a hover crosshair and tooltip. Draws in pixels so strokes and text stay crisp. */
export function AreaChart({ points, height = 200, tone = "accent", label = "Cagnotte" }: { points: HistoryPoint[]; height?: number; tone?: "accent" | "gold"; label?: string }) {
  const { ref, width } = useElementWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const stroke = tone === "gold" ? "#e7b22b" : "#00bd00";
  const gradientId = `area-${tone}`;

  const chart = useMemo(() => {
    if (points.length < 2) return null;
    const minX = points[0]![0];
    const maxX = points[points.length - 1]![0];
    let minY = Infinity;
    let maxY = -Infinity;
    for (const [, y] of points) {
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    const spanX = Math.max(1, maxX - minX);
    const spanY = Math.max(1, maxY - minY);
    const innerW = Math.max(10, width - PAD.left - PAD.right);
    const innerH = height - PAD.top - PAD.bottom;
    const x = (t: number) => PAD.left + ((t - minX) / spanX) * innerW;
    const y = (v: number) => PAD.top + innerH - ((v - minY) / spanY) * innerH;
    const coords = points.map(([t, v]) => [x(t), y(v)] as const);
    const line = coords.map(([px, py], i) => `${i === 0 ? "M" : "L"}${px.toFixed(1)},${py.toFixed(1)}`).join(" ");
    const baseline = PAD.top + innerH;
    const area = `${line} L${coords[coords.length - 1]![0].toFixed(1)},${baseline} L${coords[0]![0].toFixed(1)},${baseline} Z`;
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({ x: PAD.left + f * innerW, t: minX + f * spanX }));
    return { coords, line, area, baseline, minX, spanX, innerW, ticks, minY, maxY };
  }, [points, width, height]);

  function onMove(event: React.PointerEvent<SVGSVGElement>) {
    if (!chart) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const px = event.clientX - rect.left;
    const t = chart.minX + ((px - PAD.left) / chart.innerW) * chart.spanX;
    let lo = 0;
    let hi = points.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (points[mid]![0] < t) lo = mid + 1;
      else hi = mid;
    }
    const prev = Math.max(0, lo - 1);
    setHover(Math.abs(points[prev]![0] - t) < Math.abs(points[lo]![0] - t) ? prev : lo);
  }

  return (
    <div ref={ref} className="relative w-full select-none">
      {!chart ? (
        <div className="flex items-center justify-center text-xs text-muted" style={{ height }}>Pas encore assez de points</div>
      ) : (
        <svg width={width} height={height} role="img" aria-label={`Évolution : ${label}`} onPointerMove={onMove} onPointerLeave={() => setHover(null)} className="block touch-none">
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={stroke} stopOpacity="0.35" />
              <stop offset="1" stopColor={stroke} stopOpacity="0" />
            </linearGradient>
          </defs>
          {chart.ticks.map((tick, i) => (
            <g key={i}>
              <line x1={tick.x} x2={tick.x} y1={PAD.top} y2={chart.baseline} stroke="currentColor" strokeOpacity="0.08" />
              <text x={tick.x} y={height - 6} textAnchor={i === 0 ? "start" : i === chart.ticks.length - 1 ? "end" : "middle"} fontSize="10" fill="currentColor" fillOpacity="0.6">
                {clockTime(new Date(tick.t).toISOString())}
              </text>
            </g>
          ))}
          <path d={chart.area} fill={`url(#${gradientId})`} />
          <path d={chart.line} fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          {hover === null ? (
            <circle cx={chart.coords[chart.coords.length - 1]![0]} cy={chart.coords[chart.coords.length - 1]![1]} r="4" fill={stroke} stroke="var(--surface)" strokeWidth="2" />
          ) : (
            <g>
              <line x1={chart.coords[hover]![0]} x2={chart.coords[hover]![0]} y1={PAD.top} y2={chart.baseline} stroke="currentColor" strokeOpacity="0.35" strokeDasharray="3 3" />
              <circle cx={chart.coords[hover]![0]} cy={chart.coords[hover]![1]} r="5" fill={stroke} stroke="var(--surface)" strokeWidth="2" />
            </g>
          )}
        </svg>
      )}
      {chart && hover !== null && (
        <div
          className="pointer-events-none absolute top-2 rounded-lg border border-border bg-surface px-2 py-1 text-xs shadow-lg"
          style={{ left: Math.min(Math.max(0, chart.coords[hover]![0] - 60), Math.max(0, width - 130)) }}
        >
          <p className="text-muted">{clockTime(new Date(points[hover]![0]).toISOString())}</p>
          <p className="font-bold tabular-nums">{euros(points[hover]![1])}</p>
        </div>
      )}
    </div>
  );
}
