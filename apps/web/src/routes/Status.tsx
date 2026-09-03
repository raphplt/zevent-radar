import clsx from "clsx";
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
  return (
    <div className="space-y-4 lg:max-w-3xl">
      <SectionTitle>État des sources</SectionTitle>
      <Card className="p-4">
        <p className="flex items-center gap-2 text-sm"><Activity size={16} className={s.stale ? "text-warning" : "text-success"} />{s.stale ? "Données figées" : "Collecte en bonne santé"}</p>
        <p className="mt-1 text-xs text-muted">Dernière collecte {s.lastRunAt ? relativeTime(s.lastRunAt, now) : "jamais"}{s.lastRunDurationMs !== null ? ` · ${s.lastRunDurationMs} ms` : ""}</p>
        <p className="text-xs text-muted">Goals synchronisés {s.goalsSyncedAt ? relativeTime(s.goalsSyncedAt, now) : "jamais"} · version {s.goalsVersion}</p>
      </Card>
      <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {s.sources.map((source) => (
          <li key={source.name} className="rounded-xl border border-border bg-surface p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">{source.name}</span>
              <span className={clsx("rounded-full px-2 py-0.5 text-[11px] font-semibold", source.ok ? "bg-success/15 text-accent-strong" : "bg-danger/15 text-red-700 dark:text-danger")}>{source.ok ? "OK" : "KO"}</span>
            </div>
            <p className="mt-1 text-xs text-muted">
              Succès {source.lastSuccessAt ? relativeTime(source.lastSuccessAt, now) : "jamais"}
              {source.latencyMs !== null && ` · ${source.latencyMs} ms`}
              {source.consecutiveFailures > 0 && ` · ${source.consecutiveFailures} échecs consécutifs`}
            </p>
            {source.lastError && <p className="mt-1 text-xs text-danger">{source.lastError}</p>}
          </li>
        ))}
      </ul>
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
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-2 px-3 py-2">
      <dt className="text-[11px] text-muted uppercase">{label}</dt>
      <dd className="font-bold tabular-nums">{value}</dd>
    </div>
  );
}
