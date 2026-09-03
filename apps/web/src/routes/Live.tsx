import { Radio } from "lucide-react";
import { useMemo, useState } from "react";
import { StreamerCard } from "@/components/StreamerCard";
import { EmptyState, SectionTitle, Select, Skeleton } from "@/components/ui";
import { useLatest } from "@/hooks/useData";

type Sort = "viewers" | "proximity" | "momentum" | "amount";

export function LivePage() {
  const latest = useLatest();
  const [sort, setSort] = useState<Sort>("viewers");
  const streamers = useMemo(() => {
    const live = (latest.data?.streamers ?? []).filter((s) => s.online);
    const sorters: Record<Sort, (a: (typeof live)[number], b: (typeof live)[number]) => number> = {
      viewers: (a, b) => b.viewers - a.viewers,
      amount: (a, b) => b.amountCents - a.amountCents,
      proximity: (a, b) => (a.remainingCents ?? Infinity) - (b.remainingCents ?? Infinity),
      momentum: (a, b) => (b.velocityCentsPerMinute ?? 0) - (a.velocityCentsPerMinute ?? 0)
    };
    return [...live].sort(sorters[sort]);
  }, [latest.data, sort]);

  if (latest.isPending) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-4">
      <SectionTitle
        action={
          <Select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="!w-auto" aria-label="Trier">
            <option value="viewers">Popularité</option>
            <option value="proximity">Proximité du goal</option>
            <option value="momentum">Momentum</option>
            <option value="amount">Cagnotte</option>
          </Select>
        }
      >
        {streamers.length} en direct
      </SectionTitle>
      {streamers.length === 0 ? (
        <EmptyState title="Aucun live en cours" description="Les streams reprendront bientôt." icon={<Radio size={28} />} />
      ) : (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
          {streamers.map((s) => (
            <StreamerCard key={s.id} streamer={s} />
          ))}
        </div>
      )}
    </div>
  );
}
