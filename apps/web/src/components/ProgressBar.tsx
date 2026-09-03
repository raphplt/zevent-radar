import clsx from "clsx";

export function ProgressBar({ value, tone = "accent", className, tick, size = "md" }: { value: number; tone?: "accent" | "success" | "warning" | "gold"; className?: string; tick?: number; size?: "sm" | "md" | "lg" }) {
  const width = `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`;
  const tones = { accent: "progress-fill", success: "progress-fill", warning: "bg-warning", gold: "progress-fill-gold" };
  const heights = { sm: "h-1.5", md: "h-2", lg: "h-3" };
  return (
    <div className={clsx("relative w-full overflow-hidden rounded-full bg-surface-2", heights[size], className)} role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div className={clsx("h-full rounded-full transition-[width] duration-700", tones[tone])} style={{ width }} />
      {tick !== undefined && <span className="absolute top-0 bottom-0 w-0.5 bg-fg/40" style={{ left: `${Math.round(tick * 100)}%` }} aria-hidden />}
    </div>
  );
}
