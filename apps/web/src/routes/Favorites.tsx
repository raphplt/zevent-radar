import { Bell, Share2, Star } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { EventFeed } from "@/components/EventFeed";
import { MissedBanner } from "@/components/MissedBanner";
import { StreamerCard } from "@/components/StreamerCard";
import { Button, EmptyState, SectionTitle, Skeleton } from "@/components/ui";
import { useLatest } from "@/hooks/useData";
import { decodeShare, encodeShare, favoritesStore, setFavorites } from "@/lib/favorites";
import { syncPreferences, getExistingSubscription } from "@/lib/push";
import { settingsStore } from "@/lib/settings";

export function FavoritesPage() {
  const latest = useLatest();
  const favorites = favoritesStore.use();
  const settings = settingsStore.use();
  const [params, setParams] = useSearchParams();
  const [copied, setCopied] = useState(false);
  const shared = params.get("share");
  const sharedIds = useMemo(() => (shared ? decodeShare(shared) : []), [shared]);

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

  const streamers = (latest.data?.streamers ?? []).filter((s) => favorites.includes(s.id));
  const events = (latest.data?.recentEvents ?? []).filter((e) => favorites.includes(e.streamerId));

  async function share() {
    const url = `${location.origin}/favorites?share=${encodeShare(favorites)}`;
    if (navigator.share) {
      await navigator.share({ title: "Mes favoris ZEvent Radar", url }).catch(() => undefined);
    } else {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  if (sharedIds.length > 0) {
    const preview = (latest.data?.streamers ?? []).filter((s) => sharedIds.includes(s.id));
    return (
      <div className="space-y-4">
        <SectionTitle>Sélection partagée</SectionTitle>
        <p className="text-sm text-muted">{preview.length} streamers dans cette sélection.</p>
        <div className="flex gap-2">
          <Button onClick={() => { setFavorites([...favorites, ...sharedIds]); setParams({}); }}>Ajouter à mes favoris</Button>
          <Button variant="secondary" onClick={() => { setFavorites(sharedIds); setParams({}); }}>Remplacer</Button>
        </div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">{preview.map((s) => <StreamerCard key={s.id} streamer={s} compact />)}</div>
      </div>
    );
  }

  if (latest.isPending) return <Skeleton className="h-64" />;

  if (favorites.length === 0) {
    return (
      <EmptyState title="Aucun favori" description="Ajoute des streamers avec l'étoile pour suivre leurs goals et recevoir des alertes." icon={<Star size={28} />} />
    );
  }

  return (
    <div className="space-y-6">
      <MissedBanner events={latest.data?.recentEvents ?? []} />
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={share}><Share2 size={16} />{copied ? "Lien copié" : "Partager la sélection"}</Button>
        <Link to="/settings" className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-surface-2 px-4 text-sm font-semibold"><Bell size={16} />Notifications</Link>
      </div>
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-8">
        <section>
          <SectionTitle>{streamers.length} streamers suivis</SectionTitle>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {streamers
              .sort((a, b) => (a.remainingCents ?? Infinity) - (b.remainingCents ?? Infinity))
              .map((s) => (
                <StreamerCard key={s.id} streamer={s} />
              ))}
          </div>
        </section>
        <section className="mt-6 lg:mt-0">
          <SectionTitle>Événements de tes favoris</SectionTitle>
          <EventFeed events={events} limit={10} />
        </section>
      </div>
    </div>
  );
}
