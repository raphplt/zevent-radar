import type { CommunityReport, GoalsFile, PublicState, PublicStatusFile, StreamerHistoryResponse } from "@zevent-radar/contracts";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { api, getData } from "@/lib/api";
import { LATEST_POLL_MS, LATEST_POLL_SAVER_MS, TOTAL_POLL_MS, TOTAL_POLL_SAVER_MS, ZEVENT_AMOUNT_URL } from "@/lib/config";
import { getInstallationId } from "@/lib/installation";
import { settingsStore } from "@/lib/settings";

export function useLatest() {
  const settings = settingsStore.use();
  return useQuery({
    queryKey: ["latest"],
    queryFn: ({ signal }) => getData<PublicState>("/latest.json", signal),
    refetchInterval: settings.dataSaver ? LATEST_POLL_SAVER_MS : LATEST_POLL_MS,
    staleTime: 10_000,
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
    queryFn: ({ signal }) => getData<StreamerHistoryResponse>(`/history/${streamerId}`, signal),
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
    refetchInterval: 45_000
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

export function useEventHistory() {
  return useQuery({
    queryKey: ["history", "event"],
    queryFn: ({ signal }) => getData<StreamerHistoryResponse>("/history/event", signal),
    refetchInterval: 60_000
  });
}
