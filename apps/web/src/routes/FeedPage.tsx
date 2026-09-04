import type { CommunityReport, PublicEvent, PublicEventKind } from "@zevent-radar/contracts";
import { Newspaper, Star } from "lucide-react";
import { useMemo } from "react";
import { useSearchParams } from "react-router";
import { Feed } from "@/components/Feed";
import { Button, Chips, EmptyState, Skeleton, Spinner } from "@/components/ui";
import { useCommunity, useEvents, useLatest } from "@/hooks/useData";
import { favoritesStore } from "@/lib/favorites";

type Filter = "all" | "goal_reached" | "goal_accomplished" | "live_started" | "community";

const FILTERS: Array<[Filter, string]> = [
  ["all", "Tout"],
  ["goal_reached", "Paliers"],
  ["goal_accomplished", "Accomplis"],
  ["live_started", "Lives"],
  ["community", "Communauté"]
];

const COMMUNITY_KINDS = new Set<CommunityReport["kind"]>(["challenge_live", "interesting_moment", "important_announcement", "goal_accomplished", "goal_added", "goal_updated"]);

/** Full event feed: every public event with pagination, plus community moments. */
export function FeedPage() {
  const latest = useLatest();
  const favorites = favoritesStore.use();
  const [params, setParams] = useSearchParams();
  const filter = (FILTERS.find(([key]) => key === params.get("kind"))?.[0] ?? "all") as Filter;
  const onlyFavorites = params.get("fav") === "1";
  const eventKind: PublicEventKind | null = filter === "all" || filter === "community" ? null : filter;
  const events = useEvents(eventKind);
  const community = useCommunity();

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

  const avatars = useMemo(() => new Map((latest.data?.streamers ?? []).map((s) => [s.id, s.avatarUrl] as const)), [latest.data]);

  const items = useMemo(() => {
    const favoriteSet = new Set(favorites);
    const keep = (id: string) => !onlyFavorites || favoriteSet.has(id);
    const pageEvents: PublicEvent[] = filter === "community" ? [] : (events.data?.pages.flatMap((p) => p.events) ?? []).filter((e) => keep(e.streamerId));
    const reports = filter === "all" || filter === "community" ? (community.data?.reports ?? []).filter((r) => COMMUNITY_KINDS.has(r.kind) && keep(r.streamerId)) : [];
    return { events: pageEvents, reports };
  }, [events.data, community.data, filter, onlyFavorites, favorites]);

  const loading = events.isPending && filter !== "community";
  const empty = !loading && items.events.length === 0 && items.reports.length === 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="no-scrollbar flex max-w-full gap-2 overflow-x-auto pb-1">
          <Chips value={filter} onChange={(v) => update("kind", v)} options={FILTERS} />
        </div>
        {favorites.length > 0 && (
          <button
            type="button"
            onClick={() => update("fav", onlyFavorites ? null : "1")}
            aria-pressed={onlyFavorites}
            className={onlyFavorites ? "inline-flex items-center gap-1 rounded-full border border-gold/60 bg-gold/15 px-3 py-1 text-xs font-semibold text-gold-light" : "inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs font-medium text-muted"}
          >
            <Star size={12} fill={onlyFavorites ? "currentColor" : "none"} />
            Mes favoris
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      ) : events.isError && filter !== "community" ? (
        <EmptyState title="Fil indisponible" description="Impossible de charger les événements. Réessaie dans un instant." icon={<Newspaper size={28} />} />
      ) : empty ? (
        <EmptyState title="Rien à afficher" description={onlyFavorites ? "Aucun événement chez tes favoris pour ce filtre." : "Aucun événement pour ce filtre."} icon={<Newspaper size={28} />} />
      ) : (
        <Feed events={items.events} reports={items.reports} limit={Infinity} avatars={avatars} />
      )}

      {filter !== "community" && events.hasNextPage && (
        <div className="flex justify-center">
          <Button variant="secondary" onClick={() => events.fetchNextPage()} disabled={events.isFetchingNextPage}>
            {events.isFetchingNextPage ? <Spinner className="h-4 w-4" /> : null}
            Charger plus
          </Button>
        </div>
      )}
    </div>
  );
}
