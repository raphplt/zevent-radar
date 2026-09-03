import { Activity } from "lucide-react";
import { Card, SectionTitle, Skeleton } from "@/components/ui";
import { useStatus } from "@/hooks/useData";
import { useNow } from "@/hooks/useNow";
import { count, relativeTime } from "@/lib/format";

export function StatusPage() {
  const status = useStatus();
  const now = useNow(5_000);
  if (status.isPending) return <Skeleton className="h-64" />;
  if (!status.data) return <p className="text-sm text-muted">Statut indisponible.</p>;
  const s = status.data;
  const tone = s.stale ? "text-danger" : s.degraded ? "text-warning" : "text-success";
  const label = s.stale ? "Données figées : la collecte n'a pas abouti récemment" : s.degraded ? "Service dégradé : une source répond mal, les données affichées restent les dernières valides" : "Tout fonctionne";
  return (
    <div className="space-y-4 lg:max-w-2xl">
      <SectionTitle>État du service</SectionTitle>
      <Card className="p-4">
        <p className={`flex items-center gap-2 text-sm font-semibold ${tone}`}><Activity size={16} />{label}</p>
        <p className="mt-2 text-xs text-muted">Dernière collecte {s.lastRunAt ? relativeTime(s.lastRunAt, now) : "jamais"}</p>
        <p className="text-xs text-muted">Donation goals synchronisés {s.goalsSyncedAt ? relativeTime(s.goalsSyncedAt, now) : "en cours"}</p>
      </Card>
      <Card className="p-4">
        <dl className="grid grid-cols-2 gap-2 text-sm md:grid-cols-3">
          <Row label="Streamers" value={count(s.counts.streamers)} />
          <Row label="En live" value={count(s.counts.online)} />
          <Row label="Goals" value={count(s.counts.goals)} />
          <Row label="Atteints" value={count(s.counts.goalsReached)} />
          <Row label="Accomplis" value={count(s.counts.goalsAccomplished)} />
          <Row label="Sur le radar" value={count(s.counts.radarEntries)} />
        </dl>
      </Card>
      <p className="text-xs text-muted">Les cagnottes viennent des API publiques de zevent.fr, rafraîchies chaque minute. Les donation goals viennent de l'InGDoc et de la communauté.</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-2 px-3 py-2">
      <dt className="text-[11px] text-muted uppercase">{label}</dt>
      <dd className="font-bold tabular-nums">{value}</dd>
    </div>
  );
}
