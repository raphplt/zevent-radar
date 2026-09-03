import { REPORT_KIND_LABELS, type CommunityReport } from "@zevent-radar/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { CheckCircle2, ExternalLink, Megaphone, Tv } from "lucide-react";
import { Link } from "react-router";
import { Badge, Button, EmptyState, SectionTitle, Skeleton } from "@/components/ui";
import { useCommunity, useLatest, useStreamerMap } from "@/hooks/useData";
import { useNow } from "@/hooks/useNow";
import { api } from "@/lib/api";
import { relativeTime } from "@/lib/format";
import { getInstallationId } from "@/lib/installation";

const TONES: Record<CommunityReport["kind"], "accent" | "gold" | "warning" | "success" | "danger" | "neutral"> = {
  goal_added: "accent",
  goal_updated: "accent",
  goal_accomplished: "success",
  challenge_live: "gold",
  important_announcement: "warning",
  interesting_moment: "gold",
  data_error: "danger"
};

export function CommunityList({ reports, confirmed, compact = false }: { reports: CommunityReport[]; confirmed: string[]; compact?: boolean }) {
  const now = useNow(15_000);
  const queryClient = useQueryClient();
  const confirm = useMutation({
    mutationFn: (id: string) => api(`/api/reports/${id}/confirm`, { method: "POST", body: JSON.stringify({ installationId: getInstallationId() }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["community"] })
  });
  return (
    <ul className={clsx("grid grid-cols-1 gap-2", !compact && "md:grid-cols-2")}>
      {reports.map((report) => {
        const done = confirmed.includes(report.id);
        return (
          <li key={report.id} className={clsx("rounded-xl border bg-surface p-3", report.status === "pending" ? "border-dashed border-border" : "border-border")}>
            <div className="flex items-center gap-2">
              <Badge tone={TONES[report.kind]}>{REPORT_KIND_LABELS[report.kind]}</Badge>
              {report.status === "pending" && <Badge>En attente</Badge>}
              <span className="ml-auto text-xs text-muted">{relativeTime(report.createdAt, now)}</span>
            </div>
            <p className="mt-2 text-sm">
              {report.streamerLogin && <Link to={`/streamers/${report.streamerLogin}`} className="font-semibold">{report.streamerDisplayName ?? report.streamerLogin}</Link>}
              {report.streamerLogin && " · "}
              {report.message}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              {report.sourceUrl && <a href={report.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-muted underline"><ExternalLink size={11} />source</a>}
              {report.streamerLogin && <a href={`https://twitch.tv/${report.streamerLogin}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-muted underline"><Tv size={11} />live</a>}
              {!compact && (
                <button type="button" disabled={done || confirm.isPending} onClick={() => confirm.mutate(report.id)} className={clsx("ml-auto inline-flex items-center gap-1 rounded-full px-2 py-1 font-semibold", done ? "text-success" : "bg-surface-2 text-fg")}>
                  <CheckCircle2 size={12} />
                  {done ? "Confirmé" : "Je confirme"} · {report.confirmations}
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function CommunityPage() {
  const community = useCommunity();
  const latest = useLatest();
  const { byId } = useStreamerMap(latest.data);
  const reports = community.data?.reports ?? [];
  const goalsInProgress = (latest.data?.radar ?? []).slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SectionTitle>Communauté</SectionTitle>
        <Link to="/contribute"><Button><Megaphone size={16} />Signaler</Button></Link>
      </div>
      <p className="text-sm text-muted">Les signalements deviennent visibles après validation ou après {community.data?.visibleThreshold ?? 3} confirmations d'installations différentes.</p>
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-8">
      <div>
      {community.isPending ? (
        <Skeleton className="h-40" />
      ) : reports.length === 0 ? (
        <EmptyState title="Rien à signaler pour l'instant" description="Sois le premier à partager un moment, une annonce ou un goal." />
      ) : (
        <CommunityList reports={reports} confirmed={community.data?.confirmed ?? []} />
      )}
      </div>
      {goalsInProgress.length > 0 && (
        <section className="mt-6 lg:mt-0">
          <SectionTitle>Goals en cours</SectionTitle>
          <ul className="space-y-1 text-sm">
            {goalsInProgress.map((entry) => {
              const s = byId.get(entry.streamerId);
              if (!s) return null;
              return (
                <li key={entry.goal.id}>
                  <Link to={`/streamers/${s.login}`} className="flex justify-between gap-2 rounded-xl border border-border bg-surface px-3 py-2 hover:border-accent/60">
                    <span className="truncate"><span className="font-semibold">{s.displayName}</span> · {entry.goal.label}</span>
                    <span className="shrink-0 text-muted">{Math.round(entry.progress * 100)} %</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      </div>
    </div>
  );
}
