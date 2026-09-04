import type { PublicStreamer } from "@zevent-radar/contracts";
import clsx from "clsx";
import { ArrowLeft, Heart, Radio, Tv } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { Link } from "react-router";
import { Avatar } from "@/components/Avatar";
import { Counter } from "@/components/Counter";
import { Countdown } from "@/components/Countdown";
import { ProgressBar } from "@/components/ProgressBar";
import { EmptyState, Skeleton } from "@/components/ui";
import { useLatest, useRealtimeAmounts, withRealtimeAmount } from "@/hooks/useData";
import { useNow } from "@/hooks/useNow";
import { favoritesStore } from "@/lib/favorites";
import { euros, percent, relativeTime } from "@/lib/format";

const REALTIME_LIMIT = 12;
const IMMINENT_SECONDS = 300;

/** Full-width live board for the favorites currently streaming. Meant to stay open on a second screen. */
export function FavoritesWatchPage() {
  const latest = useLatest();
  const favorites = favoritesStore.use();
  const now = useNow(5_000);
  const state = latest.data;

  const live = useMemo(() => {
    const set = new Set(favorites);
    return (state?.streamers ?? []).filter((s) => set.has(s.id) && s.online);
  }, [state, favorites]);

  const realtimeLogins = useMemo(
    () =>
      [...live]
        .filter((s) => s.nextGoal)
        .sort((a, b) => (a.etaSeconds ?? Infinity) - (b.etaSeconds ?? Infinity) || (a.remainingCents ?? Infinity) - (b.remainingCents ?? Infinity))
        .slice(0, REALTIME_LIMIT)
        .map((s) => s.login),
    [live]
  );
  const realtime = useRealtimeAmounts(realtimeLogins);

  const boards = useMemo(
    () =>
      live
        .map((s) => withRealtimeAmount(s, realtime.amounts.get(s.login) ?? null))
        .sort((a, b) => (a.etaSeconds ?? Infinity) - (b.etaSeconds ?? Infinity) || (a.remainingCents ?? Infinity) - (b.remainingCents ?? Infinity) || b.viewers - a.viewers),
    [live, realtime.amounts]
  );

  if (latest.isPending) return <Skeleton className="h-96" />;
  if (!state) return <EmptyState title="Données indisponibles" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Link to="/favorites" className="inline-flex items-center gap-1 text-xs text-muted"><ArrowLeft size={14} />Mes favoris</Link>
        <span className="text-xs text-muted">
          {realtime.live ? (
            <span className="inline-flex items-center gap-1"><span className="live-dot relative inline-block h-2 w-2 rounded-full bg-accent text-accent" />temps réel</span>
          ) : (
            `maj ${relativeTime(state.generatedAt, now)}`
          )}
        </span>
      </div>

      {boards.length === 0 ? (
        <EmptyState title="Aucun favori en live" description="Cette vue se remplira dès qu'un de tes favoris lancera son stream." icon={<Radio size={28} />} />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {boards.map((s) => (
            <Board key={s.id} streamer={s} generatedAt={state.generatedAt} />
          ))}
        </div>
      )}
      <p className="text-center text-xs text-muted">Cette vue se met à jour toute seule. Garde-la ouverte à côté des streams.</p>
    </div>
  );
}

function Board({ streamer, generatedAt }: { streamer: PublicStreamer; generatedAt: string }) {
  const goal = streamer.nextGoal;
  const imminent = streamer.etaSeconds !== null && streamer.etaSeconds <= IMMINENT_SECONDS;
  return (
    <div className={clsx("flex flex-col gap-3 rounded-xl border bg-surface p-4", imminent ? "border-gold/60 shadow-[0_0_32px_#e7b22b22]" : "border-border")}>
      <Link to={`/streamers/${streamer.login}`} className="flex items-center gap-3">
        <Avatar src={streamer.avatarUrl} name={streamer.displayName} size={44} online />
        <div className="min-w-0">
          <p className="truncate text-lg font-extrabold">{streamer.displayName}</p>
          <p className="truncate text-xs text-muted">{streamer.game ?? "En live"}</p>
        </div>
      </Link>
      {goal ? (
        <>
          <p className="truncate text-center text-xs text-muted" title={goal.label}>{goal.label}</p>
          <p className="text-center text-3xl font-extrabold tabular-nums"><Counter value={streamer.amountCents} format={(v) => euros(v)} durationMs={1200} /></p>
          <p className="-mt-2 text-center text-xs text-muted">objectif {euros(goal.amountCents)}</p>
          <ProgressBar value={streamer.progress ?? 0} tone={imminent ? "gold" : "accent"} size="lg" tick={0.9} />
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat label="Reste" value={euros(streamer.remainingCents ?? 0)} gold />
            <Stat label="ETA" value={<Countdown etaSeconds={streamer.etaSeconds} generatedAt={generatedAt} />} />
            <Stat label="Progression" value={percent(streamer.progress ?? 0)} />
          </div>
        </>
      ) : (
        <>
          <p className="text-center text-3xl font-extrabold tabular-nums"><Counter value={streamer.amountCents} format={(v) => euros(v)} durationMs={1200} /></p>
          <p className="text-center text-xs text-muted">{streamer.goalsCount > 0 ? "Tous les goals sont atteints" : "Pas de donation goal connu"}</p>
        </>
      )}
      <div className="mt-auto grid grid-cols-2 gap-2">
        <a href={streamer.donationUrl ?? "https://zevent.fr/don"} target="_blank" rel="noreferrer" className="bevel-gold inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-bold text-black"><Heart size={16} />Donner</a>
        <a href={`https://twitch.tv/${streamer.login}`} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#9146ff] px-3 text-sm font-bold text-white shadow-[inset_0_2px_0_#b48cff,inset_0_-2px_0_#5f2bb8]"><Tv size={16} />Regarder</a>
      </div>
    </div>
  );
}

function Stat({ label, value, gold = false }: { label: string; value: ReactNode; gold?: boolean }) {
  return (
    <div className="rounded-lg bg-surface-2 py-2">
      <p className="text-[11px] text-muted uppercase">{label}</p>
      <p className={clsx("text-base font-extrabold tabular-nums", gold && "text-gold-gradient")}>{value}</p>
    </div>
  );
}
