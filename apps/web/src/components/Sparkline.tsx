import type { HistoryPoint } from "@zevent-radar/contracts";
import { useMemo } from "react";

export function Sparkline({ points, goalCents, height = 120, className }: { points: HistoryPoint[]; goalCents?: number | null; height?: number; className?: string }) {
  const width = 320;
  const path = useMemo(() => {
    if (points.length < 2) return null;
    const xs = points.map((p) => p[0]);
    const ys = points.map((p) => p[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys, goalCents ?? -Infinity);
    const spanX = Math.max(1, maxX - minX);
    const spanY = Math.max(1, maxY - minY);
    const project = (p: HistoryPoint) => [((p[0] - minX) / spanX) * (width - 8) + 4, height - 4 - ((p[1] - minY) / spanY) * (height - 8)] as const;
    const coords = points.map(project);
    const line = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
    const first = coords[0]!;
    const last = coords[coords.length - 1]!;
    const area = `${line} L${last[0].toFixed(1)},${height - 4} L${first[0].toFixed(1)},${height - 4} Z`;
    const goalY = goalCents !== null && goalCents !== undefined ? height - 4 - ((goalCents - minY) / spanY) * (height - 8) : null;
    return { line, area, goalY, last };
  }, [points, goalCents, height]);

  if (!path) {
    return <div className="flex h-24 items-center justify-center text-xs text-muted">Pas encore assez de points</div>;
  }
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={className} preserveAspectRatio="none" role="img" aria-label="Évolution de la cagnotte">
      <defs>
        <linearGradient id="spark" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#00bd00" stopOpacity="0.4" />
          <stop offset="1" stopColor="#00bd00" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={path.area} fill="url(#spark)" />
      <path d={path.line} fill="none" stroke="#00bd00" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {path.goalY !== null && path.goalY >= 0 && <line x1="0" x2={width} y1={path.goalY} y2={path.goalY} stroke="#e7b22b" strokeDasharray="4 4" strokeWidth="1.5" />}
      <circle cx={path.last[0]} cy={path.last[1]} r="4" fill="#00bd00" />
    </svg>
  );
}
