import type { PublicStreamer } from "@zevent-radar/contracts";
import clsx from "clsx";
import { Search } from "lucide-react";
import { useDeferredValue, useMemo } from "react";
import { useSearchParams } from "react-router";
import { filterStreamers } from "@/components/SearchBox";
import { StreamerCard } from "@/components/StreamerCard";
import { EmptyState, Input, Skeleton } from "@/components/ui";
import { useLatest } from "@/hooks/useData";

type LiveFilter = "all" | "live" | "offline";
type PlaceFilter = "all" | "lan" | "remote";
type GoalFilter = "all" | "with" | "without";
const DISTANCES = [null, 50_000, 100_000, 200_000, 500_000] as const;

export function ExplorePage() {
  const latest = useLatest();
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const deferred = useDeferredValue(query);
  const live = (params.get("live") as LiveFilter | null) ?? "all";
  const place = (params.get("place") as PlaceFilter | null) ?? "all";
  const goal = (params.get("goal") as GoalFilter | null) ?? "all";
  const distanceParam = Number(params.get("max") ?? "");
  const distance = DISTANCES.find((d) => d !== null && d === distanceParam) ?? null;
  function update(key: string, value: string | null) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value === null || value === "" || value === "all") next.delete(key);
        else next.set(key, value);
        return next;
      },
      { replace: true }
    );
  }
  const setQuery = (v: string) => update("q", v);
  const setLive = (v: LiveFilter) => update("live", v);
  const setPlace = (v: PlaceFilter) => update("place", v);
  const setGoal = (v: GoalFilter) => update("goal", v);
  const setDistance = (v: (typeof DISTANCES)[number]) => update("max", v === null ? null : String(v));

  const results = useMemo(() => {
    let list: PublicStreamer[] = latest.data?.streamers ?? [];
    list = filterStreamers(list, deferred);
    if (live !== "all") list = list.filter((s) => (live === "live" ? s.online : !s.online));
    if (place !== "all") list = list.filter((s) => (place === "lan" ? s.location === "lan" : s.location !== "lan" && s.location !== "unknown"));
    if (goal !== "all") list = list.filter((s) => (goal === "with" ? s.goalsCount > 0 : s.goalsCount === 0));
    if (distance !== null) list = list.filter((s) => s.remainingCents !== null && s.remainingCents <= distance);
    return [...list].sort((a, b) => Number(b.online) - Number(a.online) || b.amountCents - a.amountCents);
  }, [latest.data, deferred, live, place, goal, distance]);

  const hasLocation = (latest.data?.streamers ?? []).some((s) => s.location !== "unknown");

  return (
    <div className="space-y-4">
      <div className="lg:flex lg:flex-wrap lg:items-center lg:gap-3">
        <div className="relative lg:w-80">
          <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nom, login ou jeu" className="pl-9" aria-label="Rechercher" />
        </div>
        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1 lg:mt-0 lg:flex-wrap lg:overflow-visible lg:pb-0">
          <Chips value={live} onChange={setLive} options={[["all", "Tous"], ["live", "En live"], ["offline", "Hors ligne"]]} />
          {hasLocation && <Chips value={place} onChange={setPlace} options={[["all", "Partout"], ["lan", "Sur place"], ["remote", "À distance"]]} />}
          <Chips value={goal} onChange={setGoal} options={[["all", "Goals ou non"], ["with", "Avec goals"], ["without", "Sans goals"]]} />
        </div>
      </div>
      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1 lg:flex-wrap lg:overflow-visible">
        {DISTANCES.map((d) => (
          <button key={d ?? "any"} type="button" onClick={() => setDistance(d)} className={clsx("shrink-0 rounded-full border px-3 py-1 text-xs font-medium", distance === d ? "border-accent bg-accent/15 text-accent-strong" : "border-border text-muted")}>
            {d === null ? "Toute distance" : `Goal à moins de ${d / 100} €`}
          </button>
        ))}
      </div>
      {latest.isPending ? (
        <Skeleton className="h-64" />
      ) : results.length === 0 ? (
        <EmptyState title="Aucun résultat" description="Essaie un autre nom ou retire des filtres." />
      ) : (
        <>
          <p className="text-xs text-muted">{results.length} streamers</p>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
            {results.slice(0, 150).map((s) => (
              <StreamerCard key={s.id} streamer={s} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Chips<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: Array<[T, string]> }) {
  return (
    <div className="flex shrink-0 rounded-full border border-border p-0.5">
      {options.map(([key, label]) => (
        <button key={key} type="button" onClick={() => onChange(key)} className={clsx("rounded-full px-3 py-1 text-xs font-medium", value === key ? "bg-accent text-slate-950" : "text-muted")}>
          {label}
        </button>
      ))}
    </div>
  );
}
