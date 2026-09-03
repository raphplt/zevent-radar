import type { PublicEvent } from "@zevent-radar/contracts";
import { CheckCheck, Radio, Trophy } from "lucide-react";
import { Link } from "react-router";
import { euros, relativeTime } from "@/lib/format";
import { useNow } from "@/hooks/useNow";

const ICONS = { goal_reached: Trophy, goal_accomplished: CheckCheck, live_started: Radio, goal_added: Trophy, goal_updated: Trophy } as const;

export function EventFeed({ events, limit = 10 }: { events: PublicEvent[]; limit?: number }) {
  const now = useNow(15_000);
  if (events.length === 0) return <p className="text-sm text-muted">Aucun événement récent.</p>;
  return (
    <ul className="space-y-2">
      {events.slice(0, limit).map((event) => {
        const Icon = ICONS[event.kind];
        return (
          <li key={event.id}>
            <Link to={`/streamers/${event.streamerLogin}`} className="flex items-start gap-3 rounded-xl border border-border bg-surface px-3 py-2 text-sm hover:border-accent/60">
              <Icon size={16} className={event.kind === "live_started" ? "mt-0.5 text-danger" : "mt-0.5 text-success"} />
              <span className="min-w-0 flex-1">
                <span className="font-semibold">{event.streamerDisplayName}</span>{" "}
                {event.kind === "live_started" && <span>est en live</span>}
                {event.kind === "goal_reached" && <span>a atteint {event.amountCents !== null ? euros(event.amountCents) : "un palier"}</span>}
                {event.kind === "goal_accomplished" && <span>a accompli un goal</span>}
                {event.goalLabel && <span className="block truncate text-xs text-muted">{event.goalLabel}</span>}
              </span>
              <span className="shrink-0 text-xs text-muted">{relativeTime(event.createdAt, now)}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
