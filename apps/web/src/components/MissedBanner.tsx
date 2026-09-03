import type { PublicEvent } from "@zevent-radar/contracts";
import { History, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { favoritesStore } from "@/lib/favorites";
import { euros } from "@/lib/format";
import { lastSeenStore, markSeen, missedEvents } from "@/lib/lastSeen";

export function MissedBanner({ events }: { events: PublicEvent[] }) {
  const favorites = favoritesStore.use();
  const [since] = useState(() => lastSeenStore.get());
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    markSeen();
    const timer = setInterval(markSeen, 60_000);
    return () => clearInterval(timer);
  }, []);
  const missed = missedEvents(events, favorites, since);
  if (dismissed || missed.length === 0) return null;
  return (
    <div className="flex items-start gap-3 rounded-xl border border-accent-border bg-accent-dim px-3 py-2 text-sm">
      <History size={16} className="mt-0.5 shrink-0 text-accent-strong" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">Depuis ta dernière visite : {missed.length} {missed.length > 1 ? "paliers atteints" : "palier atteint"} chez tes favoris</p>
        <p className="truncate text-xs text-muted">
          {missed.slice(0, 3).map((e) => `${e.streamerDisplayName} ${e.amountCents !== null ? euros(e.amountCents) : ""}`).join(" · ")}
          {missed.length > 3 && ` · +${missed.length - 3}`}
        </p>
        <Link to="/favorites" className="text-xs text-accent-strong underline">Voir mes favoris</Link>
      </div>
      <button type="button" onClick={() => setDismissed(true)} className="rounded-full p-1 text-muted hover:text-fg" aria-label="Fermer"><X size={14} /></button>
    </div>
  );
}
