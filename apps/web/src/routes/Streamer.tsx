import { ArrowLeft, ExternalLink, Flag, Heart, Star, Tv, Zap } from "lucide-react";
import { useMemo } from "react";
import { Link, useParams } from "react-router";
import { Avatar } from "@/components/Avatar";
import { GoalList } from "@/components/GoalList";
import { ProgressBar } from "@/components/ProgressBar";
import { Sparkline } from "@/components/Sparkline";
import { ConfidenceBadge } from "@/components/StreamerCard";
import { Badge, Button, Card, EmptyState, SectionTitle, Skeleton } from "@/components/ui";
import { useCommunity, useGoals, useLatest, useStreamerHistory, useStreamerMap } from "@/hooks/useData";
import { useNow } from "@/hooks/useNow";
import { favoritesStore, toggleFavorite } from "@/lib/favorites";
import { compactNumber, duration, euros, percent, relativeTime } from "@/lib/format";
import { CommunityList } from "./Community";

export function StreamerPage() {
  const { login = "" } = useParams();
  const latest = useLatest();
  const goalsFile = useGoals();
  const { byLogin } = useStreamerMap(latest.data);
  const streamer = byLogin.get(login.toLowerCase()) ?? null;
  const history = useStreamerHistory(streamer?.id ?? null);
  const community = useCommunity(streamer?.id);
  const favorites = favoritesStore.use();
  const now = useNow(10_000);
  const goals = useMemo(() => (goalsFile.data?.goals ?? []).filter((g) => streamer && g.streamerId === streamer.id && g.status !== "rejected" && g.status !== "superseded"), [goalsFile.data, streamer]);

  if (latest.isPending) return <Skeleton className="h-96" />;
  if (!streamer) return <EmptyState title="Streamer introuvable" description={`Aucun participant avec le login « ${login} ».`} />;

  const favorite = favorites.includes(streamer.id);
  const goal = streamer.nextGoal;
  const upcoming = goals.filter((g) => g.category === "donation" && (g.status === "pending" || g.status === "verified") && g.amountCents > streamer.amountCents).sort((a, b) => a.amountCents - b.amountCents).slice(1, 4);
  const spanHours = history.data && history.data.points.length > 1 ? Math.max(1, Math.round((history.data.points[history.data.points.length - 1]![0] - history.data.points[0]![0]) / 3_600_000)) : null;
  const sources = Array.from(new Set(goals.map((g) => g.sourceUrl).filter((v): v is string => Boolean(v))));

  return (
    <div className="space-y-5">
      <Link to={-1 as unknown as string} className="inline-flex items-center gap-1 text-xs text-muted"><ArrowLeft size={14} />Retour</Link>
      <div className="lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start lg:gap-8">
      <div className="space-y-5">
      <div className="flex items-center gap-4">
        <Avatar src={streamer.avatarUrl} name={streamer.displayName} size={72} online={streamer.online} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-extrabold">{streamer.displayName}</h1>
          <p className="text-sm text-muted">
            {streamer.online ? (
              <>
                <span className="font-semibold text-danger">En live</span> · {compactNumber(streamer.viewers)} viewers{streamer.game ? ` · ${streamer.game}` : ""}
              </>
            ) : (
              "Hors ligne"
            )}
          </p>
          <p className="text-2xl font-extrabold tabular-nums">{euros(streamer.amountCents)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <a href={`https://twitch.tv/${streamer.login}`} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#9146ff] px-3 text-sm font-bold text-white shadow-[inset_0_2px_0_#b48cff,inset_0_-2px_0_#5f2bb8]"><Tv size={16} />Regarder</a>
        <a href={streamer.donationUrl ?? "https://zevent.fr/don"} target="_blank" rel="noreferrer" className="bevel-gold inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-bold text-black"><Heart size={16} />Donner</a>
        <Button variant={favorite ? "secondary" : "primary"} onClick={() => toggleFavorite(streamer.id)}><Star size={16} fill={favorite ? "currentColor" : "none"} />{favorite ? "Suivi" : "Suivre"}</Button>
        <Link to={`/contribute?streamer=${streamer.id}`} className="bevel-neutral inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-surface-2 px-3 text-sm font-bold"><Flag size={16} />Signaler</Link>
      </div>

      <Card className="p-4">
        <SectionTitle>Prochain goal</SectionTitle>
        {goal ? (
          <>
            <p className="font-semibold">{goal.label}</p>
            <div className="mt-1 flex items-baseline justify-between text-sm">
              <span className="text-muted">{euros(streamer.amountCents)} / {euros(goal.amountCents)}</span>
              <span className="font-semibold">{percent(streamer.progress ?? 0)}</span>
            </div>
            <ProgressBar value={streamer.progress ?? 0} className="mt-2" tone={streamer.etaSeconds !== null && streamer.etaSeconds <= 300 ? "gold" : "accent"} />
            <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
              <Metric label="Reste" value={euros(streamer.remainingCents ?? 0)} />
              <Metric label="Vitesse" value={streamer.velocityCentsPerMinute !== null ? `${euros(streamer.velocityCentsPerMinute)}/min` : "—"} />
              <Metric label="ETA" value={streamer.etaSeconds !== null ? duration(streamer.etaSeconds) : "—"} />
            </dl>
            <div className="mt-2 flex items-center gap-2 text-xs text-muted">
              <ConfidenceBadge confidence={streamer.confidence} />
              {streamer.etaSeconds === null && <span>Estimation indisponible : cagnotte stable ou trop peu de données.</span>}
            </div>
            <Link to={`/streamers/${streamer.login}/watch`} className="bevel-gold mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg px-3 text-sm font-bold text-black"><Zap size={16} />Suivre ce goal en direct</Link>
            {upcoming.length > 0 && (
              <ul className="mt-4 divide-y divide-border border-t border-border text-sm">
                {upcoming.map((g) => (
                  <li key={g.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="truncate text-muted">{g.label}</span>
                    <span className="shrink-0 text-xs text-muted">reste <span className="font-semibold text-fg tabular-nums">{euros(g.amountCents - streamer.amountCents)}</span></span>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : goals.length > 0 ? (
          <p className="text-sm text-success">Tous les goals financiers sont atteints.</p>
        ) : (
          <p className="text-sm text-muted">Aucun goal connu. <Link to={`/contribute?streamer=${streamer.id}&kind=goal_added`} className="underline">Proposer un goal</Link></p>
        )}
      </Card>

      <Card className="p-4">
        <SectionTitle action={<span className="text-xs text-muted">{spanHours ? `${spanHours} dernière${spanHours > 1 ? "s" : ""} heure${spanHours > 1 ? "s" : ""}` : "historique"}</span>}>Progression</SectionTitle>
        {history.isPending ? <Skeleton className="h-28" /> : <Sparkline points={history.data?.points ?? []} goalCents={goal?.amountCents ?? null} className="h-32 w-full" />}
        <p className="mt-1 text-xs text-muted">Mis à jour {relativeTime(streamer.updatedAt, now)}</p>
      </Card>

      </div>
      <div className="mt-5 space-y-5 lg:mt-0">
      <Card className="p-4">
        <SectionTitle action={<span className="flex items-center gap-2"><a href="https://zevent.gdoc.fr/donation_goals" target="_blank" rel="noreferrer" className="text-xs text-muted underline">InGDoc</a><Badge>{goals.length} goals</Badge></span>}>Donation goals</SectionTitle>
        {goalsFile.isPending ? <Skeleton className="h-32" /> : <GoalList goals={goals} currentCents={streamer.amountCents} eventTotalCents={latest.data?.event.totalAmountCents ?? 0} nextGoalId={goal?.id} streamerId={streamer.id} />}
        {sources.length > 0 && (
          <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
            Sources :
            {sources.slice(0, 3).map((url) => (
              <a key={url} href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline"><ExternalLink size={11} />{new URL(url).hostname}</a>
            ))}
          </p>
        )}
      </Card>

      <section>
        <SectionTitle action={<Link to={`/contribute?streamer=${streamer.id}`} className="text-xs text-accent-strong">Signaler</Link>}>Communauté</SectionTitle>
        {community.data && community.data.reports.length > 0 ? <CommunityList reports={community.data.reports} confirmed={community.data.confirmed} compact /> : <p className="text-sm text-muted">Aucun signalement pour ce streamer.</p>}
      </section>
      </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-2 px-2 py-2">
      <dt className="text-[11px] text-muted uppercase">{label}</dt>
      <dd className="text-sm font-bold tabular-nums">{value}</dd>
    </div>
  );
}
