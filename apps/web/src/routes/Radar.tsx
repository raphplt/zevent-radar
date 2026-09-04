import { Radar as RadarIcon } from "lucide-react";
import { Link } from "react-router";
import { AssociationsBanner } from "@/components/AssociationsBanner";
import { Feed } from "@/components/Feed";
import { MissedBanner } from "@/components/MissedBanner";
import { RADAR_LABELS, RadarCard, RadarHero } from "@/components/RadarCard";
import { SearchBox } from "@/components/SearchBox";
import { StreamerCard } from "@/components/StreamerCard";
import { Badge, EmptyState, SectionTitle, Skeleton } from "@/components/ui";
import { useCommunity, useLatest, useStreamerMap } from "@/hooks/useData";
import { count } from "@/lib/format";

export function RadarPage() {
  const latest = useLatest();
  const { byId } = useStreamerMap(latest.data);
  const community = useCommunity();
  const state = latest.data;

  if (latest.isPending) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
    );
  }
  if (!state) {
    return <EmptyState title="Données indisponibles" description="Le collecteur n'a pas encore publié d'état. Réessaie dans une minute." icon={<RadarIcon size={28} />} />;
  }

  const radar = state.radar.filter((e) => byId.has(e.streamerId));
  const imminent = radar.filter((e) => e.category === "imminent");
  const others = radar.filter((e) => e.category !== "imminent");
  const live = [...state.streamers].filter((s) => s.online).sort((a, b) => b.viewers - a.viewers).slice(0, 6);
  const moments = (community.data?.reports ?? []).filter((r) => r.kind === "challenge_live" || r.kind === "interesting_moment" || r.kind === "important_announcement");

  return (
    <div className="space-y-6">
      <MissedBanner events={state.recentEvents} />
      <div className="lg:flex lg:items-center lg:gap-4">
        <div className="lg:flex-1"><SearchBox streamers={state.streamers} /></div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center lg:mt-0 lg:w-[420px]">
          <Stat label="En live" value={count(state.event.onlineCount)} />
          <Stat label="Viewers" value={count(state.event.viewerCount)} />
          <Stat label="Goals proches" value={count(radar.length)} />
        </div>
      </div>
      <AssociationsBanner />

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-8">
        <div className="space-y-6">
          {imminent.length > 0 && (
            <section>
              <SectionTitle action={<Badge tone="gold">{imminent.length} imminent{imminent.length > 1 ? "s" : ""}</Badge>}>Ça va tomber</SectionTitle>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                {imminent.map((entry) => (
                  <RadarHero key={entry.goal.id} entry={entry} streamer={byId.get(entry.streamerId)!} generatedAt={state.generatedAt} />
                ))}
              </div>
            </section>
          )}
          <section>
            <SectionTitle action={<span className="text-xs text-muted">{others.length} en vue</span>}>Goals à portée</SectionTitle>
            {others.length === 0 && imminent.length === 0 ? (
              <EmptyState title="Rien d'imminent pour le moment" description="Le radar se remplit dès qu'une cagnotte approche un palier." icon={<RadarIcon size={28} />} />
            ) : (
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                {others.slice(0, 16).map((entry) => (
                  <RadarCard key={entry.goal.id} entry={entry} streamer={byId.get(entry.streamerId)!} />
                ))}
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {(Object.keys(RADAR_LABELS) as Array<keyof typeof RADAR_LABELS>).map((key) => (
                <Badge key={key} tone={RADAR_LABELS[key].tone}>
                  {RADAR_LABELS[key].label} · {radar.filter((e) => e.category === key).length}
                </Badge>
              ))}
            </div>
          </section>
        </div>

        <div className="mt-6 space-y-6 lg:mt-0">
          <section>
            <SectionTitle action={<Link to="/feed" className="text-xs text-accent-strong">Tout le fil</Link>}>Fil</SectionTitle>
            <Feed events={state.recentEvents} reports={moments} limit={12} />
          </section>
          <section>
            <SectionTitle action={<Link to="/live" className="text-xs text-accent-strong">Tous les lives</Link>}>En ce moment</SectionTitle>
            {live.length === 0 ? (
              <p className="text-sm text-muted">Personne n'est en live actuellement.</p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
                {live.map((s) => (
                  <StreamerCard key={s.id} streamer={s} compact />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-2 py-2">
      <p className="text-lg font-bold tabular-nums">{value}</p>
      <p className="text-[11px] text-muted uppercase">{label}</p>
    </div>
  );
}
