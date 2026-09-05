import type { BulkHistoryResponse, CommunityReport, EventsResponse, EventTotalFile, GoalsFile, HistoryPoint, PublicEventKind, PublicState, PublicStatusFile, StreamerHistoryResponse } from "@zevent-radar/contracts";
import { useInfiniteQuery, useQueries, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { api, getData } from "@/lib/api";
import { LATEST_POLL_MS, LATEST_POLL_SAVER_MS, TOTAL_POLL_MS, TOTAL_POLL_SAVER_MS, ZEVENT_AMOUNT_URL, ZEVENT_STREAMER_URL } from "@/lib/config";
import { getInstallationId } from "@/lib/installation";
import { settingsStore } from "@/lib/settings";

export function useLatest() {
  const settings = settingsStore.use();
  return useQuery({
    queryKey: ["latest"],
    queryFn: ({ signal }) => getData<PublicState>("/latest.json", signal),
    refetchInterval: settings.dataSaver ? LATEST_POLL_SAVER_MS : LATEST_POLL_MS,
    staleTime: 5_000,
    retry: 2
  });
}

export function useGoals() {
  return useQuery({
    queryKey: ["goals"],
    queryFn: ({ signal }) => getData<GoalsFile>("/goals.json", signal),
    refetchInterval: 2 * 60_000,
    staleTime: 60_000
  });
}

export function useStatus() {
  return useQuery({
    queryKey: ["status"],
    queryFn: ({ signal }) => getData<PublicStatusFile>("/status.json", signal),
    refetchInterval: 30_000
  });
}

export function useStreamerHistory(streamerId: string | null) {
  return useQuery({
    queryKey: ["history", streamerId],
    queryFn: ({ signal }) => api<StreamerHistoryResponse>(`/data/history/${streamerId}`, { signal }),
    enabled: streamerId !== null,
    refetchInterval: 60_000
  });
}

export function useEventTotal(fallbackCents: number | undefined) {
  const settings = settingsStore.use();
  const query = useQuery({
    queryKey: ["event-total"],
    queryFn: async ({ signal }) => {
      const res = await fetch(ZEVENT_AMOUNT_URL, { signal, headers: { accept: "application/json" } });
      if (!res.ok) throw new Error(`total ${res.status}`);
      const data = (await res.json()) as { total: number };
      if (typeof data.total !== "number" || !Number.isFinite(data.total)) throw new Error("invalid total");
      return Math.round(data.total * 100);
    },
    refetchInterval: settings.dataSaver ? TOTAL_POLL_SAVER_MS : TOTAL_POLL_MS,
    staleTime: 5_000,
    retry: 1
  });
  return { cents: query.data ?? fallbackCents ?? null, live: query.isSuccess, updatedAt: query.dataUpdatedAt };
}

export function useStreamerMap(state: PublicState | undefined) {
  return useMemo(() => {
    const byId = new Map<string, PublicState["streamers"][number]>();
    const byLogin = new Map<string, PublicState["streamers"][number]>();
    for (const streamer of state?.streamers ?? []) {
      byId.set(streamer.id, streamer);
      byLogin.set(streamer.login, streamer);
    }
    return { byId, byLogin };
  }, [state]);
}

export function useCommunity(streamerId?: string) {
  return useQuery({
    queryKey: ["community", streamerId ?? "all"],
    queryFn: () => api<{ reports: CommunityReport[]; confirmed: string[]; visibleThreshold: number }>(`/api/community?installationId=${getInstallationId()}${streamerId ? `&streamerId=${streamerId}` : ""}`),
    refetchInterval: 60_000
  });
}

export function useHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: () => api<{ ok: boolean; ageSeconds: number; stale: boolean }>("/api/health"),
    refetchInterval: 60_000,
    retry: 0
  });
}

/** Downsampled history for several streamers in one request. Pass "event" to include the global total. */
export function useBulkHistory(ids: string[]) {
  const key = [...ids].sort().join(",");
  return useQuery({
    queryKey: ["history", "bulk", key],
    queryFn: ({ signal }) => api<BulkHistoryResponse>(`/api/history?ids=${encodeURIComponent(key)}`, { signal }),
    enabled: key.length > 0,
    refetchInterval: 60_000,
    staleTime: 30_000
  });
}

const EVENTS_PAGE = 100;

/** Paginated public event feed, newest first. */
export function useEvents(kind: PublicEventKind | null, streamerId?: string) {
  return useInfiniteQuery({
    queryKey: ["events", kind ?? "all", streamerId ?? "all"],
    queryFn: ({ pageParam, signal }) => {
      const params = new URLSearchParams({ limit: String(EVENTS_PAGE) });
      if (kind) params.set("kind", kind);
      if (streamerId) params.set("streamerId", streamerId);
      if (pageParam) params.set("before", pageParam);
      return api<EventsResponse>(`/api/events?${params.toString()}`, { signal });
    },
    initialPageParam: "" as string,
    getNextPageParam: (last) => last.nextBefore ?? undefined,
    refetchInterval: 30_000,
    staleTime: 15_000
  });
}

/** Whole-edition global total, one point every five minutes. Falls back to the 24 h history while the file is not published. */
export function useEventTotalHistory() {
  const long = useQuery({
    queryKey: ["event-total-history"],
    queryFn: ({ signal }) => getData<EventTotalFile>("/event-total.json", signal),
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: 1
  });
  const short = useEventHistory();
  const points = useMemo(() => {
    if (!long.data && !short.data) return undefined;
    return mergeHistoryPoints(long.data?.points ?? [], short.data?.points ?? []);
  }, [long.data, short.data]);
  return { points, partial: !long.data && long.isError, isPending: long.isPending || (long.isError && short.isPending), updatedAt: long.data?.updatedAt ?? short.data?.updatedAt };
}

/** Union of two histories keyed by timestamp, sorted; the first series wins on ties. */
export function mergeHistoryPoints(base: HistoryPoint[], extra: HistoryPoint[]): HistoryPoint[] {
  if (extra.length === 0) return base;
  if (base.length === 0) return extra;
  const byTs = new Map<number, number>();
  for (const [ts, cents] of extra) byTs.set(ts, cents);
  for (const [ts, cents] of base) byTs.set(ts, cents);
  return [...byTs.entries()].sort((a, b) => a[0] - b[0]);
}

export function useEventHistory() {
  return useQuery({
    queryKey: ["history", "event"],
    queryFn: ({ signal }) => api<StreamerHistoryResponse>("/data/history/event", { signal }),
    refetchInterval: 60_000
  });
}

async function fetchRealtimeAmount(login: string, signal?: AbortSignal): Promise<number> {
  const res = await fetch(`${ZEVENT_STREAMER_URL}${encodeURIComponent(login)}`, { signal, headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`streamer ${res.status}`);
  const data = (await res.json()) as { donationAmount?: { number?: number } };
  const number = data.donationAmount?.number;
  if (typeof number !== "number" || !Number.isFinite(number)) throw new Error("invalid amount");
  return Math.max(0, Math.round(number * 100));
}

function realtimeQuery(login: string, dataSaver: boolean) {
  return {
    queryKey: ["realtime", login],
    queryFn: ({ signal }: { signal?: AbortSignal }) => fetchRealtimeAmount(login, signal),
    refetchInterval: dataSaver ? TOTAL_POLL_SAVER_MS : TOTAL_POLL_MS,
    staleTime: 5_000,
    retry: 1
  };
}

export function useRealtimeAmount(login: string | null) {
  const settings = settingsStore.use();
  const query = useQuery({ ...realtimeQuery(login ?? "", settings.dataSaver), enabled: login !== null });
  return { cents: query.data ?? null, live: query.isSuccess, updatedAt: query.dataUpdatedAt };
}

/** Realtime amounts for several streamers at once. Returns a map keyed by login; missing entries mean no data yet. */
export function useRealtimeAmounts(logins: string[]): { amounts: Map<string, number>; live: boolean } {
  const settings = settingsStore.use();
  return useQueries({
    queries: logins.map((login) => realtimeQuery(login, settings.dataSaver)),
    combine: (results) => {
      const amounts = new Map<string, number>();
      results.forEach((result, index) => {
        const login = logins[index];
        if (login !== undefined && typeof result.data === "number") amounts.set(login, result.data);
      });
      return { amounts, live: results.some((r) => r.isSuccess) };
    }
  });
}

export function withRealtimeAmount(streamer: PublicState["streamers"][number], cents: number | null): PublicState["streamers"][number] {
  if (cents === null || cents <= streamer.amountCents) return streamer;
  const goal = streamer.nextGoal;
  if (!goal) return { ...streamer, amountCents: cents };
  const remainingCents = Math.max(0, goal.amountCents - cents);
  const progress = goal.amountCents > 0 ? Math.min(1, cents / goal.amountCents) : streamer.progress;
  const etaSeconds = remainingCents === 0 ? 0 : streamer.velocityCentsPerMinute && streamer.etaSeconds !== null ? Math.round((remainingCents / streamer.velocityCentsPerMinute) * 60) : streamer.etaSeconds;
  return { ...streamer, amountCents: cents, remainingCents, progress, etaSeconds };
}
