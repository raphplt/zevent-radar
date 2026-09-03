import { useNow } from "@/hooks/useNow";
import { countdown, liveEtaSeconds } from "@/lib/eta";

export function Countdown({ etaSeconds, generatedAt, className }: { etaSeconds: number | null; generatedAt: string; className?: string }) {
  const now = useNow(1_000);
  const live = liveEtaSeconds(etaSeconds, generatedAt, now);
  if (live === null) return <span className={className}>—</span>;
  return <span className={className}>{live === 0 ? "imminent" : countdown(live)}</span>;
}
