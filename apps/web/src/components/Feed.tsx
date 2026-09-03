import type { CommunityReport, PublicEvent } from "@zevent-radar/contracts";
import { REPORT_KIND_LABELS } from "@zevent-radar/contracts";
import { CheckCheck, Megaphone, Radio, Trophy } from "lucide-react";
import { Link } from "react-router";
import { useNow } from "@/hooks/useNow";
import { euros, relativeTime } from "@/lib/format";

type Item = { key: string; at: string; node: React.ReactNode };

export function Feed({ events, reports, limit = 12 }: { events: PublicEvent[]; reports: CommunityReport[]; limit?: number }) {
  const now = useNow(15_000);
  const items: Item[] = [
    ...events.map((event) => ({
      key: `e-${event.id}`,
      at: event.createdAt,
      node: (
        <Link to={`/streamers/${event.streamerLogin}`} className="flex items-start gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-sm hover:border-accent/60">
          {event.kind === "live_started" ? <Radio size={16} className="mt-0.5 text-danger" /> : event.kind === "goal_accomplished" ? <CheckCheck size={16} className="mt-0.5 text-accent" /> : <Trophy size={16} className="mt-0.5 text-accent" />}
          <span className="min-w-0 flex-1">
            <span className="font-semibold">{event.streamerDisplayName}</span>{" "}
            {event.kind === "live_started" && <span>est en live</span>}
            {event.kind === "goal_reached" && <span>a atteint {event.amountCents !== null ? euros(event.amountCents) : "un palier"}</span>}
            {event.kind === "goal_accomplished" && <span>a accompli un goal</span>}
            {event.goalLabel && <span className="block truncate text-xs text-muted">{event.goalLabel}</span>}
          </span>
          <span className="shrink-0 text-xs text-muted">{relativeTime(event.createdAt, now)}</span>
        </Link>
      )
    })),
    ...reports.map((report) => ({
      key: `r-${report.id}`,
      at: report.createdAt,
      node: (
        <Link to={report.streamerLogin ? `/streamers/${report.streamerLogin}` : "/community"} className="flex items-start gap-3 rounded-lg border border-gold/40 bg-surface px-3 py-2 text-sm hover:border-gold">
          <Megaphone size={16} className="mt-0.5 text-gold" />
          <span className="min-w-0 flex-1">
            <span className="font-semibold">{report.streamerDisplayName ?? "Communauté"}</span> <span className="text-xs text-gold-light">{REPORT_KIND_LABELS[report.kind]}</span>
            <span className="block truncate text-xs text-muted">{report.message}</span>
          </span>
          <span className="shrink-0 text-xs text-muted">{relativeTime(report.createdAt, now)}</span>
        </Link>
      )
    }))
  ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  if (items.length === 0) return <p className="text-sm text-muted">Rien pour le moment.</p>;
  return (
    <ul className="space-y-2">
      {items.slice(0, limit).map((item) => (
        <li key={item.key}>{item.node}</li>
      ))}
    </ul>
  );
}
