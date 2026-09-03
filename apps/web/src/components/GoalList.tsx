import { GOAL_CATEGORY_LABELS, type PublicGoal } from "@zevent-radar/contracts";
import { nextRecurrentMilestone } from "@zevent-radar/radar-engine";
import clsx from "clsx";
import { Check, CheckCheck, ExternalLink, Flag } from "lucide-react";
import { Link } from "react-router";
import { euros } from "@/lib/format";
import { Badge } from "./ui";

export function GoalList({ goals, currentCents, eventTotalCents, nextGoalId, streamerId }: { goals: PublicGoal[]; currentCents: number; eventTotalCents: number; nextGoalId?: string | null; streamerId: string }) {
  if (goals.length === 0) return <p className="text-sm text-muted">Aucun donation goal connu pour ce streamer.</p>;
  const sorted = [...goals].sort((a, b) => a.amountCents - b.amountCents);
  return (
    <ul className="divide-y divide-border">
      {sorted.map((goal) => {
        const done = goal.status === "reached" || goal.status === "accomplished";
        const isNext = goal.id === nextGoalId;
        const reference = goal.category === "global" ? eventTotalCents : currentCents;
        const comparable = goal.category === "donation" || goal.category === "global";
        const progress = comparable && goal.amountCents > 0 ? Math.min(1, reference / goal.amountCents) : null;
        const milestone = goal.category === "recurrent" ? nextRecurrentMilestone(goal.amountCents, currentCents) : null;
        return (
          <li key={goal.id} className={clsx("flex items-start gap-3 py-3", isNext && "-mx-2 rounded-lg border border-accent-border bg-accent-dim px-2")}>
            <span className={clsx("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs", goal.status === "accomplished" ? "bg-accent text-black" : goal.status === "reached" ? "bg-accent-dim text-accent-strong" : "bg-surface-2 text-muted")}>
              {goal.status === "accomplished" ? <CheckCheck size={14} /> : goal.status === "reached" ? <Check size={14} /> : null}
            </span>
            <div className="min-w-0 flex-1">
              <p className={clsx("text-sm", done && "text-muted")}>{goal.label}</p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                {goal.category !== "donation" && <Badge>{GOAL_CATEGORY_LABELS[goal.category]}</Badge>}
                {goal.status === "pending" && <Badge tone="warning">À vérifier</Badge>}
                {goal.status === "accomplished" && <Badge tone="success">Accompli</Badge>}
                {goal.status === "reached" && <Badge tone="success">Atteint</Badge>}
                {isNext && <Badge tone="accent">Prochain</Badge>}
                {progress !== null && !done && <span>{Math.round(progress * 100)} %{goal.category === "global" ? " de la cagnotte globale" : ""}</span>}
                {milestone !== null && <span>prochain palier {euros(milestone)}</span>}
                {goal.sourceUrl && (
                  <a href={goal.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-fg">
                    <ExternalLink size={11} />source
                  </a>
                )}
                {goal.status === "reached" && (
                  <Link to={`/contribute?streamer=${streamerId}&kind=goal_accomplished&goal=${encodeURIComponent(goal.label)}`} className="inline-flex items-center gap-1 hover:text-fg">
                    <Flag size={11} />signaler accompli
                  </Link>
                )}
              </div>
            </div>
            <span className={clsx("shrink-0 text-sm font-semibold tabular-nums", done && "text-muted line-through")}>{euros(goal.amountCents)}</span>
          </li>
        );
      })}
    </ul>
  );
}
