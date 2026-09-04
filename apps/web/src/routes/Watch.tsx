import { deltaOver } from "@zevent-radar/radar-engine";
import { ArrowLeft, Heart, Tv } from "lucide-react";
import { Link, useParams } from "react-router";
import { Avatar } from "@/components/Avatar";
import { Counter } from "@/components/Counter";
import { Countdown } from "@/components/Countdown";
import { ProgressBar } from "@/components/ProgressBar";
import { ConfidenceBadge } from "@/components/StreamerCard";
import { EmptyState, Skeleton } from "@/components/ui";
import { useLatest, useRealtimeAmount, useStreamerHistory, useStreamerMap, withRealtimeAmount } from "@/hooks/useData";
import { useNow } from "@/hooks/useNow";
import { euros, percent, relativeTime } from "@/lib/format";

export function WatchPage() {
  const { login = "" } = useParams();
  const latest = useLatest();
  const { byLogin } = useStreamerMap(latest.data);
  const base = byLogin.get(login.toLowerCase()) ?? null;
  const realtime = useRealtimeAmount(base?.login ?? null);
  const streamer = base ? withRealtimeAmount(base, realtime.cents) : null;
  const history = useStreamerHistory(streamer?.id ?? null);
  const now = useNow(5_000);

  if (latest.isPending) return <Skeleton className="h-96" />;
  if (!streamer || !latest.data) return <EmptyState title="Streamer introuvable" />;
  const goal = streamer.nextGoal;
  const delta5 = history.data ? deltaOver(history.data.points, Date.parse(history.data.updatedAt), 5 * 60_000) : null;
  const imminent = streamer.etaSeconds !== null && streamer.etaSeconds <= 300;

  return (
    <div className="mx-auto flex min-h-[70dvh] max-w-xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <Link to={`/streamers/${streamer.login}`} className="inline-flex items-center gap-1 text-xs text-muted"><ArrowLeft size={14} />Fiche</Link>
        <span className="text-xs text-muted">{realtime.live ? <span className="inline-flex items-center gap-1"><span className="live-dot relative inline-block h-2 w-2 rounded-full bg-accent text-accent" />temps réel</span> : `maj ${relativeTime(latest.data.generatedAt, now)}`}</span>
      </div>
      <div className="flex items-center gap-4">
        <Avatar src={streamer.avatarUrl} name={streamer.displayName} size={64} online={streamer.online} />
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-extrabold">{streamer.displayName}</h1>
          <p className="text-sm text-muted">{streamer.online ? `En live · ${streamer.game ?? ""}` : "Hors ligne"}</p>
        </div>
      </div>

      {goal ? (
        <div className={imminent ? "rounded-xl border border-gold/60 bg-surface p-5 shadow-[0_0_48px_#e7b22b22]" : "rounded-xl border border-border bg-surface p-5"}>
          <p className="text-center text-sm text-muted">{goal.label}</p>
          <p className="mt-3 text-center text-5xl font-extrabold tabular-nums"><Counter value={streamer.amountCents} format={(v) => euros(v)} durationMs={1500} /></p>
          <p className="mt-1 text-center text-sm text-muted">objectif {euros(goal.amountCents)}</p>
          <ProgressBar value={streamer.progress ?? 0} tone={imminent ? "gold" : "accent"} size="lg" tick={0.9} className="mt-5" />
          <div className="mt-5 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-surface-2 py-3">
              <p className="text-[11px] text-muted uppercase">Reste</p>
              <p className="text-gold-gradient text-xl font-extrabold tabular-nums">{euros(streamer.remainingCents ?? 0)}</p>
            </div>
            <div className="rounded-lg bg-surface-2 py-3">
              <p className="text-[11px] text-muted uppercase">ETA</p>
              <Countdown etaSeconds={streamer.etaSeconds} generatedAt={latest.data.generatedAt} className="text-xl font-extrabold tabular-nums" />
            </div>
            <div className="rounded-lg bg-surface-2 py-3">
              <p className="text-[11px] text-muted uppercase">5 min</p>
              <p className="text-xl font-extrabold tabular-nums">{delta5 !== null ? `+${euros(delta5)}` : "—"}</p>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-center gap-2 text-xs text-muted">
            <span>{percent(streamer.progress ?? 0)}</span>
            {streamer.velocityCentsPerMinute !== null && <span>· {euros(streamer.velocityCentsPerMinute)}/min</span>}
            <ConfidenceBadge confidence={streamer.confidence} />
          </div>
        </div>
      ) : (
        <EmptyState title="Aucun goal en cours" description="Tous les paliers connus sont atteints, ou aucun goal n'est renseigné." />
      )}

      <div className="grid grid-cols-2 gap-2">
        <a href={streamer.donationUrl ?? "https://zevent.fr/don"} target="_blank" rel="noreferrer" className="bevel-gold inline-flex min-h-12 items-center justify-center gap-2 rounded-lg px-3 text-base font-bold text-black"><Heart size={18} />Donner</a>
        <a href={`https://twitch.tv/${streamer.login}`} target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#9146ff] px-3 text-base font-bold text-white shadow-[inset_0_2px_0_#b48cff,inset_0_-2px_0_#5f2bb8]"><Tv size={18} />Regarder</a>
      </div>
      <p className="text-center text-xs text-muted">Cette vue se met à jour toute seule. Garde-la ouverte à côté du stream.</p>
    </div>
  );
}
