import { GOAL_CATEGORY_LABELS, type GoalCategory, type GoalRecord, type PublicStreamer } from "@zevent-radar/contracts";
import clsx from "clsx";
import { Check, CheckCheck, ListChecks, Search } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Avatar } from "@/components/Avatar";
import { Badge, Button, Chips, EmptyState, Input, Select, Skeleton } from "@/components/ui";
import { useEventTotal, useGoals, useLatest, useStreamerMap } from "@/hooks/useData";
import { euros } from "@/lib/format";

type StatusFilter = "upcoming" | "reached" | "accomplished" | "all";
type CategoryFilter = "all" | "donation" | "global" | "recurrent" | "other";
type LiveFilter = "all" | "live";
type Sort = "near" | "amount_asc" | "amount_desc" | "recent" | "streamer";
const DISTANCES = [null, 10_000, 50_000, 100_000, 500_000] as const;
const PAGE = 100;

interface Row {
  goal: GoalRecord;
  streamer: PublicStreamer;
  reference: number | null;
  remaining: number | null;
  progress: number | null;
}

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function categoryOf(goal: GoalRecord): CategoryFilter {
  if (goal.category === "donation" || goal.category === "global" || goal.category === "recurrent") return goal.category;
  return "other";
}

export function GoalsPage() {
  const latest = useLatest();
  const goalsFile = useGoals();
  const { byId } = useStreamerMap(latest.data);
  const total = useEventTotal(latest.data?.event.totalAmountCents);
  const [params, setParams] = useSearchParams();
  const [limit, setLimit] = useState(PAGE);
  const query = params.get("q") ?? "";
  const deferred = useDeferredValue(query);
  const status = (params.get("status") as StatusFilter | null) ?? "upcoming";
  const category = (params.get("cat") as CategoryFilter | null) ?? "all";
  const live = (params.get("live") as LiveFilter | null) ?? "all";
  const sort = (params.get("sort") as Sort | null) ?? "near";
  const min = Number(params.get("min") ?? "");
  const max = Number(params.get("max") ?? "");
  const nearParam = Number(params.get("near") ?? "");
  const near = DISTANCES.find((d) => d !== null && d === nearParam) ?? null;

  function update(key: string, value: string | null) {
    setLimit(PAGE);
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value === null || value === "" || value === "all" || (key === "status" && value === "upcoming") || (key === "sort" && value === "near")) next.delete(key);
        else next.set(key, value);
        return next;
      },
      { replace: true }
    );
  }

  const rows = useMemo(() => {
    const eventTotal = total.cents;
    const q = normalize(deferred.trim());
    const list: Row[] = [];
    for (const goal of goalsFile.data?.goals ?? []) {
      if (goal.status === "rejected" || goal.status === "superseded") continue;
      const streamer = byId.get(goal.streamerId);
      if (!streamer) continue;
      const done = goal.status === "reached" || goal.status === "accomplished";
      if (status === "upcoming" && done) continue;
      if (status === "reached" && goal.status !== "reached") continue;
      if (status === "accomplished" && goal.status !== "accomplished") continue;
      if (category !== "all" && categoryOf(goal) !== category) continue;
      if (live === "live" && !streamer.online) continue;
      if (min > 0 && goal.amountCents < min * 100) continue;
      if (max > 0 && goal.amountCents > max * 100) continue;
      if (q && !normalize(goal.label).includes(q) && !normalize(streamer.displayName).includes(q) && !normalize(streamer.login).includes(q)) continue;
      const reference = goal.category === "donation" ? streamer.amountCents : goal.category === "global" ? eventTotal : null;
      const remaining = reference !== null && !done ? Math.max(0, goal.amountCents - reference) : null;
      if (near !== null && (remaining === null || remaining > near)) continue;
      const progress = reference !== null && goal.amountCents > 0 ? Math.min(1, reference / goal.amountCents) : null;
      list.push({ goal, streamer, reference, remaining, progress });
    }
    const recent = (r: Row) => Date.parse(r.goal.accomplishedAt ?? r.goal.reachedAt ?? r.goal.updatedAt);
    list.sort((a, b) => {
      switch (sort) {
        case "amount_asc":
          return a.goal.amountCents - b.goal.amountCents;
        case "amount_desc":
          return b.goal.amountCents - a.goal.amountCents;
        case "recent":
          return recent(b) - recent(a);
        case "streamer":
          return a.streamer.displayName.localeCompare(b.streamer.displayName, "fr") || a.goal.amountCents - b.goal.amountCents;
        default:
          return (a.remaining ?? Infinity) - (b.remaining ?? Infinity) || a.goal.amountCents - b.goal.amountCents;
      }
    });
    return list;
  }, [goalsFile.data, byId, total.cents, deferred, status, category, live, min, max, near, sort]);

  const visible = rows.slice(0, limit);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-extrabold"><ListChecks size={22} className="text-accent-strong" />Tous les goals</h1>
        <p className="text-sm text-muted">Les donation goals de tous les participants, filtrables par statut, type, montant et distance.</p>
      </div>
      <div className="lg:flex lg:flex-wrap lg:items-center lg:gap-3">
        <div className="relative lg:w-80">
          <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
          <Input value={query} onChange={(e) => update("q", e.target.value)} placeholder="Goal ou streamer" className="pl-9" aria-label="Rechercher un goal" />
        </div>
        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1 lg:mt-0 lg:flex-wrap lg:overflow-visible lg:pb-0">
          <Chips value={status} onChange={(v) => update("status", v)} options={[["upcoming", "À venir"], ["reached", "Atteints"], ["accomplished", "Accomplis"], ["all", "Tous"]]} />
          <Chips value={category} onChange={(v) => update("cat", v)} options={[["all", "Tous types"], ["donation", "Cagnotte"], ["global", "Global"], ["recurrent", "Paliers"], ["other", "Autres"]]} />
          <Chips value={live} onChange={(v) => update("live", v)} options={[["all", "Tous"], ["live", "En live"]]} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2">
          <Input type="number" inputMode="numeric" min={0} value={min > 0 ? min : ""} onChange={(e) => update("min", e.target.value)} placeholder="Min €" className="w-28" aria-label="Montant minimum en euros" />
          <span className="text-xs text-muted">à</span>
          <Input type="number" inputMode="numeric" min={0} value={max > 0 ? max : ""} onChange={(e) => update("max", e.target.value)} placeholder="Max €" className="w-28" aria-label="Montant maximum en euros" />
        </div>
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1 lg:flex-wrap lg:overflow-visible lg:pb-0">
          {[1_000, 5_000, 10_000, 50_000, 100_000].map((v) => (
            <button key={v} type="button" onClick={() => update("min", min === v ? "" : String(v))} className={clsx("shrink-0 rounded-full border px-3 py-1 text-xs font-medium", min === v ? "border-accent bg-accent/15 text-accent-strong" : "border-border text-muted")}>
              ≥ {euros(v * 100)}
            </button>
          ))}
        </div>
        <Select value={sort} onChange={(e) => update("sort", e.target.value)} className="w-auto" aria-label="Trier">
          <option value="near">Les plus proches</option>
          <option value="amount_asc">Montant croissant</option>
          <option value="amount_desc">Montant décroissant</option>
          <option value="recent">Derniers atteints</option>
          <option value="streamer">Par streamer</option>
        </Select>
      </div>
      {status === "upcoming" && (
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1 lg:flex-wrap lg:overflow-visible">
          {DISTANCES.map((d) => (
            <button key={d ?? "any"} type="button" onClick={() => update("near", d === null ? null : String(d))} className={clsx("shrink-0 rounded-full border px-3 py-1 text-xs font-medium", near === d ? "border-accent bg-accent/15 text-accent-strong" : "border-border text-muted")}>
              {d === null ? "Toute distance" : `À moins de ${euros(d)}`}
            </button>
          ))}
        </div>
      )}
      {latest.isPending || goalsFile.isPending ? (
        <Skeleton className="h-64" />
      ) : rows.length === 0 ? (
        <EmptyState title="Aucun goal" description="Essaie un autre mot-clé ou retire des filtres." />
      ) : (
        <>
          <p className="text-xs text-muted">{rows.length} goals</p>
          <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
            {visible.map((row) => (
              <GoalRow key={row.goal.id} row={row} />
            ))}
          </ul>
          {visible.length < rows.length && (
            <div className="flex justify-center">
              <Button variant="secondary" onClick={() => setLimit((v) => v + PAGE)}>Afficher plus ({rows.length - visible.length} restants)</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function GoalRow({ row }: { row: Row }) {
  const { goal, streamer, remaining, progress } = row;
  const done = goal.status === "reached" || goal.status === "accomplished";
  const isNext = streamer.nextGoal?.id === goal.id;
  return (
    <li className={clsx("flex items-start gap-3 px-3 py-3", isNext && "bg-accent-dim/40")}>
      <Link to={`/streamers/${streamer.login}`} className="shrink-0">
        <Avatar src={streamer.avatarUrl} name={streamer.displayName} size={36} online={streamer.online} />
      </Link>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
          <Link to={`/streamers/${streamer.login}`} className="font-semibold text-fg hover:text-accent-strong">{streamer.displayName}</Link>
          <span className="tabular-nums">{euros(streamer.amountCents)}</span>
        </p>
        <p className={clsx("text-sm", done && "text-muted")}>{goal.label}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
          {goal.category !== "donation" && <Badge>{GOAL_CATEGORY_LABELS[goal.category as GoalCategory]}</Badge>}
          {goal.status === "pending" && <Badge tone="warning">À vérifier</Badge>}
          {goal.status === "reached" && <Badge tone="success"><Check size={11} />Atteint</Badge>}
          {goal.status === "accomplished" && <Badge tone="success"><CheckCheck size={11} />Accompli</Badge>}
          {isNext && !done && <Badge tone="accent">Prochain</Badge>}
          {remaining !== null && <span>reste <span className="font-semibold text-fg tabular-nums">{euros(remaining)}</span>{goal.category === "global" ? " sur la cagnotte globale" : ""}</span>}
          {progress !== null && !done && <span>{Math.round(progress * 100)} %</span>}
        </div>
        {progress !== null && !done && (
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-2">
            <div className="progress-fill h-full rounded-full" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        )}
      </div>
      <span className={clsx("shrink-0 text-sm font-bold tabular-nums", done && "text-muted line-through")}>{euros(goal.amountCents)}</span>
    </li>
  );
}
