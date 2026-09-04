import type { PublicStreamer } from "@zevent-radar/contracts";
import { deltaOver } from "@zevent-radar/radar-engine";
import clsx from "clsx";
import { Coins, ListChecks, Search, TrendingUp, Trophy } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { AreaChart } from "@/components/AreaChart";
import { Avatar } from "@/components/Avatar";
import { Counter } from "@/components/Counter";
import { ProgressBar } from "@/components/ProgressBar";
import { filterStreamers } from "@/components/SearchBox";
import { Sparkline } from "@/components/Sparkline";
import { StreamerCard } from "@/components/StreamerCard";
import { Button, Chips, EmptyState, Input, SectionTitle, Select, Skeleton } from "@/components/ui";
import { useBulkHistory, useEventHistory, useEventTotal, useLatest } from "@/hooks/useData";
import { compactNumber, count, euros, percent } from "@/lib/format";

type LiveFilter = "all" | "live" | "offline";
type PlaceFilter = "all" | "lan" | "remote";
type GoalFilter = "all" | "with" | "without";
type Sort = "amount" | "viewers" | "proximity" | "momentum" | "name";
type View = "ranking" | "cards";
const DISTANCES = [null, 50_000, 100_000, 200_000, 500_000] as const;
const TOP = 10;
const PAGE = 60;

const SORTS: Array<[Sort, string]> = [
  ["amount", "Cagnotte"],
  ["viewers", "Popularité"],
  ["momentum", "Momentum"],
  ["proximity", "Goal le plus proche"],
  ["name", "Nom"]
];

/** The "Cagnottes" page: global total over time, leaderboard, momentum, then the full searchable list. */
export function ExplorePage() {
  const latest = useLatest();
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const deferred = useDeferredValue(query);
  const live = (params.get("live") as LiveFilter | null) ?? "all";
  const place = (params.get("place") as PlaceFilter | null) ?? "all";
  const goal = (params.get("goal") as GoalFilter | null) ?? "all";
  const sort = (SORTS.find(([key]) => key === params.get("sort"))?.[0] ?? "amount") as Sort;
  const view = (params.get("view") === "cards" ? "cards" : "ranking") as View;
  const distanceParam = Number(params.get("max") ?? "");
  const distance = DISTANCES.find((d) => d !== null && d === distanceParam) ?? null;
  const [limit, setLimit] = useState(PAGE);
  const filtering = Boolean(deferred.trim()) || live !== "all" || place !== "all" || goal !== "all" || distance !== null;

  function update(key: string, value: string | null) {
    setLimit(PAGE);
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value === null || value === "" || value === "all" || (key === "sort" && value === "amount") || (key === "view" && value === "ranking")) next.delete(key);
        else next.set(key, value);
        return next;
      },
      { replace: true }
    );
  }

  const all = useMemo(() => latest.data?.streamers ?? [], [latest.data]);
  const results = useMemo(() => {
    let list: PublicStreamer[] = all;
    list = filterStreamers(list, deferred);
    if (live !== "all") list = list.filter((s) => (live === "live" ? s.online : !s.online));
    if (place !== "all") list = list.filter((s) => (place === "lan" ? s.location === "lan" : s.location !== "lan" && s.location !== "unknown"));
    if (goal !== "all") list = list.filter((s) => (goal === "with" ? s.goalsCount > 0 : s.goalsCount === 0));
    if (distance !== null) list = list.filter((s) => s.remainingCents !== null && s.remainingCents <= distance);
    const sorters: Record<Sort, (a: PublicStreamer, b: PublicStreamer) => number> = {
      amount: (a, b) => b.amountCents - a.amountCents,
      viewers: (a, b) => Number(b.online) - Number(a.online) || b.viewers - a.viewers,
      momentum: (a, b) => (b.velocityCentsPerMinute ?? 0) - (a.velocityCentsPerMinute ?? 0) || b.amountCents - a.amountCents,
      proximity: (a, b) => (a.remainingCents ?? Infinity) - (b.remainingCents ?? Infinity) || b.amountCents - a.amountCents,
      name: (a, b) => a.displayName.localeCompare(b.displayName, "fr")
    };
    return [...list].sort(sorters[sort]);
  }, [all, deferred, live, place, goal, distance, sort]);

  const rankByAmount = useMemo(() => new Map([...all].sort((a, b) => b.amountCents - a.amountCents).map((s, i) => [s.id, i + 1] as const)), [all]);
  const hasLocation = all.some((s) => s.location !== "unknown");

  if (latest.isPending) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-64" />
        <Skeleton className="h-10" />
        <Skeleton className="h-96" />
      </div>
    );
  }
  if (!latest.data) return <EmptyState title="Données indisponibles" description="Le collecteur n'a pas encore publié d'état. Réessaie dans une minute." icon={<Coins size={28} />} />;

  return (
    <div className="space-y-8">
      {!filtering && (
        <>
          <GlobalHero />
          <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <Leaderboard streamers={all} totalCents={latest.data.event.totalAmountCents} />
            <Momentum streamers={all} />
          </div>
        </>
      )}

      <section className="space-y-3">
        <SectionTitle action={<Link to="/goals" className="inline-flex items-center gap-1 text-xs font-semibold text-accent-strong"><ListChecks size={14} />Tous les goals</Link>}>Toutes les cagnottes</SectionTitle>
        <div className="lg:flex lg:flex-wrap lg:items-center lg:gap-3">
          <div className="relative lg:w-72">
            <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
            <Input value={query} onChange={(e) => update("q", e.target.value)} placeholder="Nom, login ou jeu" className="pl-9" aria-label="Rechercher" />
          </div>
          <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1 lg:mt-0 lg:flex-wrap lg:overflow-visible lg:pb-0">
            <Chips value={live} onChange={(v) => update("live", v)} options={[["all", "Tous"], ["live", "En live"], ["offline", "Hors ligne"]]} />
            {hasLocation && <Chips value={place} onChange={(v) => update("place", v)} options={[["all", "Partout"], ["lan", "Sur place"], ["remote", "À distance"]]} />}
            <Chips value={goal} onChange={(v) => update("goal", v)} options={[["all", "Goals ou non"], ["with", "Avec goals"], ["without", "Sans goals"]]} />
          </div>
        </div>
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1 lg:flex-wrap lg:overflow-visible">
          {DISTANCES.map((d) => (
            <button key={d ?? "any"} type="button" onClick={() => update("max", d === null ? null : String(d))} className={clsx("shrink-0 rounded-full border px-3 py-1 text-xs font-medium", distance === d ? "border-accent bg-accent/15 text-accent-strong" : "border-border text-muted")}>
              {d === null ? "Toute distance" : `Goal à moins de ${d / 100} €`}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs text-muted">{count(results.length)} streamers</p>
          <div className="ml-auto flex items-center gap-2">
            <Select value={sort} onChange={(e) => update("sort", e.target.value)} className="!w-auto" aria-label="Trier">
              {SORTS.map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </Select>
            <Chips value={view} onChange={(v) => update("view", v)} options={[["ranking", "Classement"], ["cards", "Cartes"]]} />
          </div>
        </div>

        {results.length === 0 ? (
          <EmptyState title="Aucun résultat" description="Essaie un autre nom ou retire des filtres." />
        ) : view === "cards" ? (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
            {results.slice(0, limit).map((s) => (
              <StreamerCard key={s.id} streamer={s} />
            ))}
          </div>
        ) : (
          <RankingList streamers={results.slice(0, limit)} rankByAmount={rankByAmount} maxCents={results[0]?.amountCents ?? 1} />
        )}
        {results.length > limit && (
          <div className="flex justify-center">
            <Button variant="secondary" onClick={() => setLimit((v) => v + PAGE)}>Afficher plus ({count(results.length - limit)} restants)</Button>
          </div>
        )}
      </section>
    </div>
  );
}

function GlobalHero() {
  const latest = useLatest();
  const total = useEventTotal(latest.data?.event.totalAmountCents);
  const history = useEventHistory();
  const state = latest.data;
  const delta5 = history.data ? deltaOver(history.data.points, Date.parse(history.data.updatedAt), 5 * 60_000) : null;
  const delta60 = history.data ? deltaOver(history.data.points, Date.parse(history.data.updatedAt), 60 * 60_000) : null;
  return (
    <section className="rounded-xl border border-border bg-surface p-4 lg:p-5">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <p className="text-[11px] font-semibold text-muted uppercase">Cagnotte globale</p>
          <p className="text-gold-gradient text-4xl font-extrabold tabular-nums lg:text-5xl">{total.cents !== null ? <Counter value={total.cents} format={(v) => euros(v)} /> : "—"}</p>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
          <Stat label="5 min" value={delta5 !== null ? `+${euros(delta5)}` : "—"} accent />
          <Stat label="1 h" value={delta60 !== null ? `+${euros(delta60)}` : "—"} accent />
          <Stat label="En live" value={state ? `${count(state.event.onlineCount)} / ${count(state.event.streamerCount)}` : "—"} />
          <Stat label="Viewers" value={state ? compactNumber(state.event.viewerCount) : "—"} />
        </div>
      </div>
      <div className="mt-4 text-fg">
        {history.isPending ? <Skeleton className="h-48" /> : <AreaChart points={history.data?.points ?? []} height={200} tone="gold" label="cagnotte globale" />}
      </div>
    </section>
  );
}

function Stat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-muted uppercase">{label}</p>
      <p className={clsx("text-base font-bold tabular-nums", accent && "text-accent-strong")}>{value}</p>
    </div>
  );
}

function Leaderboard({ streamers, totalCents }: { streamers: PublicStreamer[]; totalCents: number }) {
  const top = useMemo(() => [...streamers].sort((a, b) => b.amountCents - a.amountCents).slice(0, TOP), [streamers]);
  const history = useBulkHistory(top.map((s) => s.id));
  const max = top[0]?.amountCents ?? 1;
  const topShare = totalCents > 0 ? top.reduce((sum, s) => sum + s.amountCents, 0) / totalCents : 0;
  return (
    <section>
      <SectionTitle action={<span className="text-xs text-muted">{percent(topShare)} de la cagnotte</span>}>
        <span className="inline-flex items-center gap-2"><Trophy size={16} className="text-gold" />Top {TOP} des cagnottes</span>
      </SectionTitle>
      <ol className="space-y-1.5">
        {top.map((s, i) => (
          <li key={s.id}>
            <Link to={`/streamers/${s.login}`} className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2 transition hover:border-accent/60">
              <span className={clsx("w-5 shrink-0 text-center text-sm font-extrabold tabular-nums", i < 3 ? "text-gold" : "text-muted")}>{i + 1}</span>
              <Avatar src={s.avatarUrl} name={s.displayName} size={36} online={s.online} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-sm font-semibold">{s.displayName}</p>
                  <p className="shrink-0 text-sm font-bold tabular-nums">{euros(s.amountCents)}</p>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                  <div className={clsx("h-full rounded-full", i < 3 ? "progress-fill-gold" : "progress-fill")} style={{ width: `${Math.max(2, (s.amountCents / max) * 100)}%` }} />
                </div>
              </div>
              <div className="hidden w-20 shrink-0 text-accent sm:block">
                {history.data?.series[s.id] && history.data.series[s.id]!.length > 1 ? <Sparkline points={history.data.series[s.id]!} height={28} className="h-7 w-full" /> : <div className="h-7" />}
              </div>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Momentum({ streamers }: { streamers: PublicStreamer[] }) {
  const hot = useMemo(
    () =>
      streamers
        .filter((s) => s.online && s.velocityCentsPerMinute !== null && s.velocityCentsPerMinute > 0)
        .sort((a, b) => (b.velocityCentsPerMinute ?? 0) - (a.velocityCentsPerMinute ?? 0))
        .slice(0, 8),
    [streamers]
  );
  const max = hot[0]?.velocityCentsPerMinute ?? 1;
  return (
    <section>
      <SectionTitle action={<span className="text-xs text-muted">€ par minute</span>}>
        <span className="inline-flex items-center gap-2"><TrendingUp size={16} className="text-accent-strong" />Ça monte vite</span>
      </SectionTitle>
      {hot.length === 0 ? (
        <p className="text-sm text-muted">Pas encore de tendance mesurable.</p>
      ) : (
        <ol className="space-y-1.5">
          {hot.map((s) => (
            <li key={s.id}>
              <Link to={`/streamers/${s.login}`} className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2 transition hover:border-accent/60">
                <Avatar src={s.avatarUrl} name={s.displayName} size={32} online={s.online} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-sm font-semibold">{s.displayName}</p>
                    <p className="shrink-0 text-sm font-bold text-accent-strong tabular-nums">+{euros(s.velocityCentsPerMinute ?? 0)}/min</p>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                      <div className="progress-fill h-full rounded-full" style={{ width: `${Math.max(2, ((s.velocityCentsPerMinute ?? 0) / max) * 100)}%` }} />
                    </div>
                    <span className="shrink-0 text-[11px] text-muted tabular-nums">{euros(s.amountCents)}</span>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function RankingList({ streamers, rankByAmount, maxCents }: { streamers: PublicStreamer[]; rankByAmount: Map<string, number>; maxCents: number }) {
  return (
    <ol className="space-y-1.5">
      {streamers.map((s) => {
        const goal = s.nextGoal;
        return (
          <li key={s.id}>
            <Link to={`/streamers/${s.login}`} className={clsx("flex items-center gap-3 rounded-xl border bg-surface px-3 py-2 transition hover:border-accent/60", s.online ? "border-border" : "border-border/60 opacity-80")}>
              <span className="w-7 shrink-0 text-center text-xs font-bold text-muted tabular-nums">#{rankByAmount.get(s.id) ?? "—"}</span>
              <Avatar src={s.avatarUrl} name={s.displayName} size={36} online={s.online} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-sm font-semibold">{s.displayName}</p>
                  <p className="shrink-0 text-sm font-bold tabular-nums">{euros(s.amountCents)}</p>
                </div>
                <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-surface-2">
                  <div className="progress-fill h-full rounded-full" style={{ width: `${Math.max(1, (s.amountCents / Math.max(1, maxCents)) * 100)}%` }} />
                </div>
                <div className="mt-1 flex items-center gap-2 text-[11px] text-muted">
                  {s.online ? <span className="shrink-0">{compactNumber(s.viewers)} viewers</span> : <span className="shrink-0">Hors ligne</span>}
                  {goal ? (
                    <>
                      <span>·</span>
                      <span className="truncate">{goal.label}</span>
                      <ProgressBar value={s.progress ?? 0} size="sm" className="ml-auto !w-16 shrink-0" tone={s.etaSeconds !== null && s.etaSeconds <= 300 ? "gold" : "accent"} />
                      <span className="shrink-0 tabular-nums">{percent(s.progress ?? 0)}</span>
                    </>
                  ) : s.goalsCount > 0 ? (
                    <span className="ml-auto shrink-0 text-accent-strong">Tous les goals atteints</span>
                  ) : null}
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
