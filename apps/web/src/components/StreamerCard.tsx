import type { PublicStreamer } from "@zevent-radar/contracts";
import clsx from "clsx";
import { Eye, Gamepad2, Star } from "lucide-react";
import { Link } from "react-router";
import { favoritesStore, toggleFavorite } from "@/lib/favorites";
import { compactNumber, duration, euros, percent } from "@/lib/format";
import { Avatar } from "./Avatar";
import { ProgressBar } from "./ProgressBar";
import { Badge } from "./ui";

export function ConfidenceBadge({ confidence }: { confidence: PublicStreamer["confidence"] }) {
  if (!confidence) return null;
  const map = { high: ["success", "Confiance haute"], medium: ["warning", "Confiance moyenne"], low: ["neutral", "Confiance faible"] } as const;
  const [tone, label] = map[confidence];
  return <Badge tone={tone}>{label}</Badge>;
}

export function StreamerCard({ streamer, compact = false, highlight }: { streamer: PublicStreamer; compact?: boolean; highlight?: string }) {
  const favorites = favoritesStore.use();
  const favorite = favorites.includes(streamer.id);
  const goal = streamer.nextGoal;
  const dim = !streamer.online && !compact;
  return (
    <div className={clsx("relative rounded-xl border bg-surface p-3 transition hover:border-accent/60", dim ? "border-border/60 opacity-75 hover:opacity-100" : "border-border", highlight && "ring-1 ring-accent/40")}>
      <Link to={`/streamers/${streamer.login}`} className="flex gap-3">
        <Avatar src={streamer.avatarUrl} name={streamer.displayName} online={streamer.online} size={compact || dim ? 40 : 48} />
        <div className="min-w-0 flex-1">
          <p className="truncate pr-8 font-semibold">{streamer.displayName}</p>
          {highlight && <Badge tone="accent" className="mt-0.5">{highlight}</Badge>}
          <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
            {streamer.online ? (
              <>
                <span className="inline-flex items-center gap-1"><Eye size={12} />{compactNumber(streamer.viewers)}</span>
                {streamer.game && <span className="inline-flex items-center gap-1 truncate"><Gamepad2 size={12} />{streamer.game}</span>}
              </>
            ) : (
              <span>Hors ligne</span>
            )}
            {(!goal || compact || dim) && <span className="font-bold text-fg tabular-nums">{euros(streamer.amountCents)}</span>}
          </p>
          {goal && !compact && !dim && (
            <div className="mt-2">
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="truncate text-muted">{goal.label}</span>
                <span className="shrink-0 tabular-nums"><span className="font-semibold">{euros(streamer.amountCents)}</span><span className="text-muted"> / {euros(goal.amountCents)}</span></span>
              </div>
              <ProgressBar value={streamer.progress ?? 0} className="mt-1" tick={0.9} tone={streamer.etaSeconds !== null && streamer.etaSeconds <= 300 ? "gold" : "accent"} />
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                <span>{percent(streamer.progress ?? 0)}</span>
                <span>·</span>
                <span>reste {euros(streamer.remainingCents ?? 0)}</span>
                {streamer.etaSeconds !== null && (
                  <>
                    <span>·</span>
                    <span className="font-semibold text-fg">ETA {duration(streamer.etaSeconds)}</span>
                  </>
                )}
                {streamer.velocityCentsPerMinute !== null && <span className="ml-auto">{euros(streamer.velocityCentsPerMinute)}/min</span>}
              </div>
            </div>
          )}
          {goal && dim && <p className="mt-1 truncate text-xs text-muted">Prochain : {goal.label} · reste {euros(streamer.remainingCents ?? 0)}</p>}
          {!goal && !compact && streamer.goalsCount > 0 && <p className="mt-1 text-xs text-accent-strong">Tous les goals sont atteints</p>}
          {!goal && !compact && streamer.goalsCount === 0 && <p className="mt-1 text-xs text-muted">Pas de donation goal connu</p>}
        </div>
      </Link>
      <button
        type="button"
        onClick={() => toggleFavorite(streamer.id)}
        aria-label={favorite ? "Retirer des favoris" : "Ajouter aux favoris"}
        aria-pressed={favorite}
        className={clsx("absolute top-2 right-2 rounded-full p-2 transition", favorite ? "text-gold" : "text-muted hover:text-fg")}
      >
        <Star size={18} fill={favorite ? "currentColor" : "none"} />
      </button>
    </div>
  );
}
