import type { PublicStreamer } from "@zevent-radar/contracts";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { Bell, BellOff, Check, ChevronDown, ChevronRight, Compass, MonitorPlay, Plus, Search, Share2, Star, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Avatar } from "@/components/Avatar";
import { Countdown } from "@/components/Countdown";
import { EventFeed } from "@/components/EventFeed";
import { MissedBanner } from "@/components/MissedBanner";
import { filterStreamers } from "@/components/SearchBox";
import { StreamerCard } from "@/components/StreamerCard";
import { Badge, Button, Chips, EmptyState, Input, SectionTitle, Select, Skeleton } from "@/components/ui";
import { useLatest, useRealtimeAmounts, useStreamerMap, withRealtimeAmount } from "@/hooks/useData";
import { addFavorites, decodeShare, encodeShare, favoritesStore, setFavorites } from "@/lib/favorites";
import { count, euros } from "@/lib/format";
import { getExistingSubscription, pushSupported, syncPreferences } from "@/lib/push";
import { settingsStore } from "@/lib/settings";
import { showToast } from "@/lib/toast";

type Sort = "proximity" | "eta" | "viewers" | "amount" | "name" | "added";
type Tab = "streamers" | "events";

const SORTS: Array<[Sort, string]> = [
  ["proximity", "Goal le plus proche"],
  ["eta", "ETA la plus courte"],
  ["viewers", "Popularité"],
  ["amount", "Cagnotte"],
  ["name", "Nom"],
  ["added", "Ordre d'ajout"]
];

/** Realtime polling is limited to the live favorites closest to a goal, to keep requests to the ZEvent API reasonable. */
const REALTIME_LIMIT = 12;
const IMMINENT_SECONDS = 300;

export function FavoritesPage() {
  const latest = useLatest();
  const favorites = favoritesStore.use();
  const settings = settingsStore.use();
  const [params, setParams] = useSearchParams();
  const shared = params.get("share");
  const sharedTokens = useMemo(() => (shared ? decodeShare(shared) : []), [shared]);

  useEffect(() => {
    let cancelled = false;
    getExistingSubscription().then((sub) => {
      if (!sub || cancelled) return;
      syncPreferences(favorites.map((streamerId) => ({ streamerId, ...settings.notifications }))).catch(() => undefined);
    });
    return () => {
      cancelled = true;
    };
  }, [favorites, settings.notifications]);

  if (sharedTokens.length > 0) return <SharedSelection tokens={sharedTokens} onDone={() => setParams({})} />;
  if (latest.isPending) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20" />
        <Skeleton className="h-10" />
        <Skeleton className="h-64" />
      </div>
    );
  }
  if (!latest.data) return <EmptyState title="Données indisponibles" description="Le collecteur n'a pas encore publié d'état. Réessaie dans une minute." icon={<Star size={28} />} />;
  if (favorites.length === 0) return <NoFavorites streamers={latest.data.streamers} />;
  return <FavoritesDashboard />;
}

function FavoritesDashboard() {
  const latest = useLatest();
  const favorites = favoritesStore.use();
  const [params, setParams] = useSearchParams();
  const sort = (SORTS.find(([key]) => key === params.get("sort"))?.[0] ?? "proximity") as Sort;
  const [tab, setTab] = useState<Tab>("streamers");
  const [showOffline, setShowOffline] = useState(false);
  const [copied, setCopied] = useState(false);
  const state = latest.data;
  const all = useMemo(() => state?.streamers ?? [], [state]);

  const base = useMemo(() => {
    const order = new Map(favorites.map((id, index) => [id, index]));
    return all.filter((s) => order.has(s.id)).map((s) => ({ streamer: s, added: order.get(s.id) ?? 0 }));
  }, [all, favorites]);

  const realtimeLogins = useMemo(
    () =>
      base
        .map((b) => b.streamer)
        .filter((s) => s.online && s.nextGoal)
        .sort((a, b) => (a.etaSeconds ?? Infinity) - (b.etaSeconds ?? Infinity) || (a.remainingCents ?? Infinity) - (b.remainingCents ?? Infinity))
        .slice(0, REALTIME_LIMIT)
        .map((s) => s.login),
    [base]
  );
  const realtime = useRealtimeAmounts(realtimeLogins);

  const streamers = useMemo(() => base.map(({ streamer, added }) => ({ added, streamer: withRealtimeAmount(streamer, realtime.amounts.get(streamer.login) ?? null) })), [base, realtime.amounts]);

  const sorted = useMemo(() => {
    const sorters: Record<Sort, (a: (typeof streamers)[number], b: (typeof streamers)[number]) => number> = {
      proximity: (a, b) => (a.streamer.remainingCents ?? Infinity) - (b.streamer.remainingCents ?? Infinity) || b.streamer.viewers - a.streamer.viewers,
      eta: (a, b) => (a.streamer.etaSeconds ?? Infinity) - (b.streamer.etaSeconds ?? Infinity) || (a.streamer.remainingCents ?? Infinity) - (b.streamer.remainingCents ?? Infinity),
      viewers: (a, b) => b.streamer.viewers - a.streamer.viewers,
      amount: (a, b) => b.streamer.amountCents - a.streamer.amountCents,
      name: (a, b) => a.streamer.displayName.localeCompare(b.streamer.displayName, "fr"),
      added: (a, b) => a.added - b.added
    };
    return [...streamers].sort(sorters[sort]).map((s) => s.streamer);
  }, [streamers, sort]);

  const live = sorted.filter((s) => s.online);
  const offline = sorted.filter((s) => !s.online);
  const events = (state?.recentEvents ?? []).filter((e) => favorites.includes(e.streamerId));
  const imminent = live.filter((s) => s.etaSeconds !== null && s.etaSeconds <= IMMINENT_SECONDS);
  const totalCents = sorted.reduce((sum, s) => sum + s.amountCents, 0);
  const next = live.filter((s) => s.etaSeconds !== null).sort((a, b) => (a.etaSeconds ?? Infinity) - (b.etaSeconds ?? Infinity))[0] ?? null;

  function setSort(value: Sort) {
    setParams(
      (prev) => {
        const nextParams = new URLSearchParams(prev);
        if (value === "proximity") nextParams.delete("sort");
        else nextParams.set("sort", value);
        return nextParams;
      },
      { replace: true }
    );
  }

  async function share() {
    const url = `${location.origin}/favorites?share=${encodeShare(sorted.map((s) => s.login))}`;
    if (navigator.share) {
      await navigator.share({ title: "Mes favoris ZEvent Radar", url }).catch(() => undefined);
    } else {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  const streamerColumn = (
    <div className="space-y-6">
      <section>
        <SectionTitle>{live.length > 0 ? `${live.length} en live` : "Personne en live"}</SectionTitle>
        {live.length === 0 ? (
          <p className="text-sm text-muted">Aucun de tes favoris ne stream en ce moment.</p>
        ) : (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {live.map((s) => (
              <StreamerCard key={s.id} streamer={s} />
            ))}
          </div>
        )}
      </section>
      {offline.length > 0 && (
        <section>
          <button type="button" onClick={() => setShowOffline((v) => !v)} aria-expanded={showOffline} className="mb-2 flex w-full items-center gap-2 text-left text-base font-bold tracking-tight">
            {showOffline ? <ChevronDown size={18} className="text-muted" /> : <ChevronRight size={18} className="text-muted" />}
            {offline.length} hors ligne
            {!showOffline && <span className="ml-auto text-xs font-medium text-muted">Afficher</span>}
          </button>
          {showOffline && (
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {offline.map((s) => (
                <StreamerCard key={s.id} streamer={s} compact />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );

  const eventColumn = (
    <section>
      <SectionTitle>Événements de tes favoris</SectionTitle>
      <EventFeed events={events} limit={50} />
    </section>
  );

  return (
    <div className="space-y-5">
      <MissedBanner events={state?.recentEvents ?? []} />

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Tile label="En live" value={`${count(live.length)} / ${count(sorted.length)}`} accent={live.length > 0} />
        <Tile label="Goals imminents" hint="ETA sous 5 min" value={count(imminent.length)} accent={imminent.length > 0} gold={imminent.length > 0} />
        <Tile label="Collecté par ta sélection" value={euros(totalCents)} />
        {next && state ? (
          <Link to={`/streamers/${next.login}`} className="rounded-xl border border-border bg-surface p-3 transition hover:border-accent/60">
            <p className="text-[11px] font-semibold text-muted uppercase">Prochain palier</p>
            <p className="truncate text-lg font-extrabold">{next.displayName}</p>
            <p className="text-xs text-muted">
              <Countdown etaSeconds={next.etaSeconds} generatedAt={state.generatedAt} className="font-semibold text-fg tabular-nums" /> · reste {euros(next.remainingCents ?? 0)}
            </p>
          </Link>
        ) : (
          <Tile label="Prochain palier" value="—" hint="Aucune ETA fiable" />
        )}
      </div>

      <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
        <AddFavoriteSearch streamers={all} favorites={favorites} />
        <Select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="lg:!w-auto" aria-label="Trier">
          {SORTS.map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </Select>
        <div className="flex flex-wrap gap-2 lg:ml-auto">
          {live.length > 0 && (
            <Link to="/favorites/watch" className="bevel-gold inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-4 text-sm font-bold text-black">
              <MonitorPlay size={16} />Suivre en direct
            </Link>
          )}
          <Button variant="secondary" onClick={share} className="shrink-0">
            <Share2 size={16} />
            {copied ? "Lien copié" : "Partager"}
          </Button>
          <AlertsPill />
        </div>
      </div>

      <div className="lg:hidden">
        <Chips value={tab} onChange={setTab} options={[["streamers", "Streamers"], ["events", events.length > 0 ? `Événements (${events.length})` : "Événements"]]} />
      </div>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-8">
        <div className={clsx(tab !== "streamers" && "hidden lg:block")}>{streamerColumn}</div>
        <div className={clsx("lg:sticky lg:top-8 lg:max-h-[calc(100dvh-4rem)] lg:overflow-auto", tab !== "events" && "hidden lg:block")}>{eventColumn}</div>
      </div>
    </div>
  );
}

function Tile({ label, value, hint, accent = false, gold = false }: { label: string; value: string; hint?: string; accent?: boolean; gold?: boolean }) {
  return (
    <div className={clsx("rounded-xl border bg-surface p-3", gold ? "border-gold/60" : accent ? "border-accent-border" : "border-border")}>
      <p className="text-[11px] font-semibold text-muted uppercase">{label}</p>
      <p className={clsx("text-lg font-extrabold tabular-nums", gold && "text-gold-gradient")}>{value}</p>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

function AlertsPill() {
  const supported = pushSupported();
  const subscription = useQuery({ queryKey: ["push-subscription"], queryFn: getExistingSubscription, enabled: supported });
  const active = supported && Boolean(subscription.data) && typeof Notification !== "undefined" && Notification.permission === "granted";
  return (
    <Link
      to="/settings"
      className={clsx("inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg border px-3 text-sm font-semibold", active ? "border-accent-border bg-accent-dim text-accent-strong" : "border-border bg-surface text-muted hover:text-fg")}
      title={active ? "Les alertes push sont actives pour tes favoris" : "Active les alertes push dans les réglages"}
    >
      {active ? <Bell size={16} /> : <BellOff size={16} />}
      {active ? "Alertes actives" : "Alertes désactivées"}
    </Link>
  );
}

function AddFavoriteSearch({ streamers, favorites }: { streamers: PublicStreamer[]; favorites: string[] }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const results = useMemo(() => (query.trim() ? filterStreamers(streamers, query).slice(0, 8) : []), [streamers, query]);

  function add(streamer: PublicStreamer) {
    addFavorites([streamer.id]);
    showToast(`${streamer.displayName} ajouté aux favoris`);
  }

  return (
    <div className="relative lg:w-80">
      <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
      <Input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setQuery("");
          if (e.key === "Enter" && results[0] && !favorites.includes(results[0].id)) add(results[0]);
        }}
        placeholder="Ajouter un streamer"
        className="pl-9"
        aria-label="Ajouter un streamer aux favoris"
      />
      {query && (
        <button type="button" onClick={() => setQuery("")} className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-1 text-muted" aria-label="Effacer">
          <X size={14} />
        </button>
      )}
      {open && results.length > 0 && (
        <ul className="absolute top-full right-0 left-0 z-20 mt-1 max-h-80 overflow-auto rounded-xl border border-border bg-surface p-1 shadow-lg">
          {results.map((s) => {
            const already = favorites.includes(s.id);
            return (
              <li key={s.id}>
                <button
                  type="button"
                  disabled={already}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => add(s)}
                  className={clsx("flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left", already ? "opacity-60" : "hover:bg-surface-2")}
                >
                  <Avatar src={s.avatarUrl} name={s.displayName} size={32} online={s.online} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{s.displayName}</span>
                    <span className="block text-xs text-muted">{s.online ? "En live" : "Hors ligne"} · {euros(s.amountCents)}</span>
                  </span>
                  {already ? <Check size={16} className="text-accent-strong" /> : <Plus size={16} className="text-muted" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function NoFavorites({ streamers }: { streamers: PublicStreamer[] }) {
  const suggestions = useMemo(() => [...streamers].filter((s) => s.online).sort((a, b) => b.viewers - a.viewers).slice(0, 5), [streamers]);
  return (
    <div className="space-y-6">
      <EmptyState title="Aucun favori" description="Ajoute des streamers pour suivre leurs goals, voir leurs paliers en temps réel et recevoir des alertes." icon={<Star size={28} />} />
      <div className="mx-auto max-w-xl space-y-3">
        <AddFavoriteSearch streamers={streamers} favorites={[]} />
        <Link to="/streamers" className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-surface-2 px-4 text-sm font-semibold hover:bg-border">
          <Compass size={16} />Parcourir tous les streamers
        </Link>
      </div>
      {suggestions.length > 0 && (
        <section className="mx-auto max-w-xl">
          <SectionTitle>Les plus suivis en ce moment</SectionTitle>
          <div className="space-y-2">
            {suggestions.map((s) => (
              <StreamerCard key={s.id} streamer={s} compact />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function SharedSelection({ tokens, onDone }: { tokens: string[]; onDone: () => void }) {
  const latest = useLatest();
  const favorites = favoritesStore.use();
  const { byId, byLogin } = useStreamerMap(latest.data);

  if (latest.isPending) return <Skeleton className="h-64" />;

  const resolved: PublicStreamer[] = [];
  const seen = new Set<string>();
  for (const token of tokens) {
    const streamer = byId.get(token) ?? byLogin.get(token.toLowerCase());
    if (streamer && !seen.has(streamer.id)) {
      seen.add(streamer.id);
      resolved.push(streamer);
    }
  }
  const fresh = resolved.filter((s) => !favorites.includes(s.id));
  const known = resolved.length - fresh.length;

  if (resolved.length === 0) {
    return (
      <div className="space-y-4">
        <EmptyState title="Sélection introuvable" description="Ce lien ne contient aucun streamer connu." icon={<Share2 size={28} />} />
        <div className="flex justify-center">
          <Button variant="secondary" onClick={onDone}>Retour à mes favoris</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SectionTitle>Sélection partagée</SectionTitle>
      <p className="text-sm text-muted">
        {resolved.length} {resolved.length > 1 ? "streamers" : "streamer"} dans cette sélection
        {known > 0 && <> · {fresh.length} {fresh.length > 1 ? "nouveaux" : "nouveau"}, {known} déjà {known > 1 ? "suivis" : "suivi"}</>}.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={fresh.length === 0}
          onClick={() => {
            addFavorites(fresh.map((s) => s.id));
            showToast(`${fresh.length} ${fresh.length > 1 ? "streamers ajoutés" : "streamer ajouté"} à tes favoris`);
            onDone();
          }}
        >
          <Plus size={16} />
          {fresh.length === 0 ? "Déjà tous suivis" : `Ajouter ${fresh.length > 1 ? `les ${fresh.length}` : "le"} ${fresh.length > 1 ? "nouveaux" : "nouveau"}`}
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            setFavorites(resolved.map((s) => s.id));
            showToast("Tes favoris ont été remplacés");
            onDone();
          }}
        >
          Remplacer mes favoris
        </Button>
        <Button variant="ghost" onClick={onDone}>Annuler</Button>
      </div>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
        {resolved.map((s) => (
          <div key={s.id} className="relative">
            <StreamerCard streamer={s} compact />
            {favorites.includes(s.id) && (
              <Badge tone="accent" className="absolute bottom-2 right-2">
                <Check size={12} />Déjà suivi
              </Badge>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
