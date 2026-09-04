import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { euros } from "@/lib/format";
import { crossedMilestones, nextMilestone } from "@/lib/milestones";
import { settingsStore } from "@/lib/settings";

const STORAGE_KEY = "zr:last-total";
const DURATION_MS = 9_000;
const COLORS = ["#00bd00", "#33ca33", "#66d766", "#e7b22b", "#ffe095", "#ffffff"];

export function useMilestoneCelebration(totalCents: number | null): { milestone: number | null; dismiss: () => void } {
  const [milestone, setMilestone] = useState<number | null>(null);
  const [params, setParams] = useSearchParams();
  const preview = params.get("celebrate");

  useEffect(() => {
    if (preview === null || totalCents === null) return;
    setMilestone(nextMilestone(totalCents));
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("celebrate");
        return next;
      },
      { replace: true }
    );
  }, [preview, totalCents, setParams]);

  useEffect(() => {
    if (totalCents === null) return;
    let previous: number | null = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      previous = raw === null ? null : Number(raw);
      localStorage.setItem(STORAGE_KEY, String(totalCents));
    } catch {
      return;
    }
    if (previous === null || !Number.isFinite(previous) || previous >= totalCents) return;
    const crossed = crossedMilestones(previous, totalCents);
    if (crossed.length > 0) setMilestone(crossed[crossed.length - 1]!);
  }, [totalCents]);

  useEffect(() => {
    if (milestone === null) return;
    const timer = setTimeout(() => setMilestone(null), DURATION_MS);
    return () => clearTimeout(timer);
  }, [milestone]);

  return { milestone, dismiss: () => setMilestone(null) };
}

export function Celebration({ milestone, onDismiss }: { milestone: number; onDismiss: () => void }) {
  const settings = settingsStore.use();
  const pieces = useMemo(
    () =>
      Array.from({ length: 90 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 2.5,
        duration: 3.5 + Math.random() * 3,
        size: 6 + Math.random() * 8,
        color: COLORS[i % COLORS.length]!,
        drift: (Math.random() - 0.5) * 200,
        spin: Math.random() > 0.5 ? 1 : -1
      })),
    [milestone]
  );

  useEffect(() => {
    if (!("vibrate" in navigator)) return;
    try {
      navigator.vibrate([80, 60, 80, 60, 200]);
    } catch {}
  }, [milestone]);

  return (
    <div className="celebration fixed inset-0 z-50 flex items-center justify-center" role="status" aria-live="polite" onClick={onDismiss}>
      {!settings.reduceMotion &&
        pieces.map((p) => (
          <span
            key={p.id}
            className="confetti"
            style={{
              left: `${p.left}%`,
              width: p.size,
              height: p.size * 0.6,
              background: p.color,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
              ["--drift" as string]: `${p.drift}px`,
              ["--spin" as string]: `${p.spin * 720}deg`
            }}
          />
        ))}
      <div className="celebration-card relative mx-4 max-w-md rounded-2xl border border-gold/60 bg-bg/95 px-8 py-7 text-center shadow-[0_0_80px_rgba(231,178,43,0.35)] backdrop-blur">
        <p className="text-xs font-bold tracking-[0.3em] text-accent-strong uppercase">Palier franchi</p>
        <p className="text-gold-gradient milestone-amount mt-2 text-5xl font-extrabold tabular-nums sm:text-6xl">{euros(milestone)}</p>
        <p className="mt-3 text-sm text-muted">La cagnotte globale du ZEVENT vient de passer ce cap. Merci à tous les viewers !</p>
        <p className="mt-4 text-[11px] text-muted">Touche pour fermer</p>
      </div>
    </div>
  );
}
