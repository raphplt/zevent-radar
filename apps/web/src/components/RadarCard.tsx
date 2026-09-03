import type { PublicStreamer, RadarEntry } from "@zevent-radar/contracts";
import clsx from "clsx";
import { Flame, Radar, Timer, TrendingUp, Zap } from "lucide-react";
import { Link } from "react-router";
import { duration, euros, percent } from "@/lib/format";
import { Avatar } from "./Avatar";
import { Countdown } from "./Countdown";
import { ProgressBar } from "./ProgressBar";
import { ConfidenceBadge } from "./StreamerCard";
import { Badge } from "./ui";

export const RADAR_LABELS: Record<RadarEntry["category"], { label: string; tone: "gold" | "accent" | "warning" | "neutral"; icon: typeof Timer }> = {
  imminent: { label: "Imminent", tone: "gold", icon: Timer },
  very_close: { label: "Très proche", tone: "accent", icon: Radar },
  accelerating: { label: "En accélération", tone: "warning", icon: TrendingUp },
  watch: { label: "À surveiller", tone: "neutral", icon: Flame }
};

export function RadarHero({ entry, streamer, generatedAt }: { entry: RadarEntry; streamer: PublicStreamer; generatedAt: string }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-gold/60 bg-surface p-4 shadow-[0_0_0_1px_#e7b22b33,0_0_32px_#e7b22b22]">
      <div className="flex items-center gap-3">
        <Avatar src={streamer.avatarUrl} name={streamer.displayName} online={streamer.online} size={56} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-bold">{streamer.displayName}</p>
          <p className="truncate text-sm text-muted">{entry.goal.label}</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-semibold text-muted uppercase">ETA</p>
          <Countdown etaSeconds={entry.etaSeconds} generatedAt={generatedAt} className="text-gold-gradient text-2xl font-extrabold tabular-nums" />
        </div>
      </div>
      <ProgressBar value={entry.progress} tone="gold" size="lg" tick={0.9} className="mt-3" />
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="font-bold tabular-nums">{euros(streamer.amountCents)}</span>
        <span className="text-muted">/ {euros(entry.goal.amountCents)}</span>
        <span className="font-semibold text-gold-light">reste {euros(entry.remainingCents)}</span>
        {entry.velocityCentsPerMinute !== null && <span className="text-muted">{euros(entry.velocityCentsPerMinute)}/min</span>}
        <span className="ml-auto"><ConfidenceBadge confidence={entry.confidence} /></span>
      </div>
      <div className="mt-3 flex gap-2">
        <Link to={`/streamers/${streamer.login}/watch`} className="bevel-gold inline-flex min-h-9 flex-1 items-center justify-center gap-2 rounded-lg px-3 text-sm font-bold text-black"><Zap size={15} />Suivre en direct</Link>
        <Link to={`/streamers/${streamer.login}`} className="bevel-neutral inline-flex min-h-9 items-center justify-center rounded-lg bg-surface-2 px-3 text-sm font-bold">Fiche</Link>
      </div>
    </div>
  );
}

export function RadarCard({ entry, streamer }: { entry: RadarEntry; streamer: PublicStreamer }) {
  const meta = RADAR_LABELS[entry.category];
  const Icon = meta.icon;
  return (
    <Link to={`/streamers/${streamer.login}`} className={clsx("block rounded-xl border bg-surface p-3 transition hover:border-accent/60", entry.category === "imminent" ? "border-gold/60" : "border-border")}>
      <div className="flex items-center gap-3">
        <Avatar src={streamer.avatarUrl} name={streamer.displayName} online={streamer.online} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{streamer.displayName}</p>
          <p className="truncate text-xs text-muted">{entry.goal.label}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-bold tabular-nums">{euros(entry.goal.amountCents)}</p>
          <p className="text-xs text-muted">reste {euros(entry.remainingCents)}</p>
        </div>
      </div>
      <ProgressBar value={entry.progress} tone={entry.category === "imminent" ? "gold" : "accent"} tick={0.9} className="mt-2" size="sm" />
      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted">
        <Badge tone={meta.tone}><Icon size={11} />{meta.label}</Badge>
        <span>{percent(entry.progress)}</span>
        {entry.etaSeconds !== null && <span className="font-semibold text-fg">ETA {duration(entry.etaSeconds)}</span>}
        {entry.velocityCentsPerMinute !== null && <span className="ml-auto">{euros(entry.velocityCentsPerMinute)}/min</span>}
      </div>
    </Link>
  );
}
