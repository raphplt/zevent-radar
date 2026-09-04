import { zeventAppSchema, zeventCurrentAmountSchema, zeventStreamerSchema, type ZeventApp } from "@zevent-radar/contracts";
import type { Env } from "../env";
import { fetchWithRetry } from "../lib/http";
import { markFailure, markSuccess, sourceHealth, type CollectorState } from "./state";

export const SOURCE_APP = "zevent.fr/api/app";
export const SOURCE_AMOUNT = "api.zevent.fr/current-amount";
export const SOURCE_STREAMER = "api.zevent.fr/streamer";
const REALTIME_CONCURRENCY = 12;
export const REALTIME_LIMIT = 150;
const BREAKER_THRESHOLD = 5;
const BREAKER_COOLDOWN_MS = 2 * 60 * 1000;

function breakerOpen(state: CollectorState, name: string, nowMs: number): boolean {
  const health = sourceHealth(state, name);
  if (health.consecutiveFailures < BREAKER_THRESHOLD || !health.lastErrorAt) return false;
  const since = nowMs - Date.parse(health.lastErrorAt);
  return since < BREAKER_COOLDOWN_MS * Math.min(8, health.consecutiveFailures - BREAKER_THRESHOLD + 1);
}

export interface AppFetchResult {
  app: ZeventApp | null;
  fromCache: boolean;
  fetchedAt: string | null;
}

export async function fetchApp(env: Env, state: CollectorState, nowIso: string): Promise<AppFetchResult> {
  const nowMs = Date.parse(nowIso);
  if (breakerOpen(state, SOURCE_APP, nowMs)) {
    return { app: state.lastApp, fromCache: true, fetchedAt: state.lastAppAt };
  }
  const started = Date.now();
  try {
    const headers: Record<string, string> = {};
    if (state.etag && state.lastApp) headers["if-none-match"] = state.etag;
    const res = await fetchWithRetry(env.ZEVENT_APP_URL, { timeoutMs: 6000, retries: 3, headers });
    if (res.status === 304 && state.lastApp) {
      markSuccess(state, SOURCE_APP, Date.now() - started, nowIso);
      state.lastAppAt = nowIso;
      return { app: state.lastApp, fromCache: false, fetchedAt: nowIso };
    }
    if (!res.ok) throw new Error(`status ${res.status}`);
    const raw = await res.json();
    const parsed = zeventAppSchema.safeParse(raw);
    if (!parsed.success) throw new Error(`schema mismatch: ${parsed.error.issues[0]?.path.join(".") ?? "unknown"}`);
    if (parsed.data.live.length === 0) throw new Error("empty streamer list");
    state.etag = res.headers.get("etag");
    state.lastApp = parsed.data;
    state.lastAppAt = nowIso;
    markSuccess(state, SOURCE_APP, Date.now() - started, nowIso);
    return { app: parsed.data, fromCache: false, fetchedAt: nowIso };
  } catch (error) {
    markFailure(state, SOURCE_APP, error, nowIso);
    return { app: state.lastApp, fromCache: true, fetchedAt: state.lastAppAt };
  }
}

export async function fetchEventTotal(env: Env, state: CollectorState, nowIso: string): Promise<number | null> {
  const nowMs = Date.parse(nowIso);
  if (breakerOpen(state, SOURCE_AMOUNT, nowMs)) return null;
  const started = Date.now();
  try {
    const res = await fetchWithRetry(env.ZEVENT_AMOUNT_URL, { timeoutMs: 4000, retries: 3 });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const parsed = zeventCurrentAmountSchema.safeParse(await res.json());
    if (!parsed.success || !Number.isFinite(parsed.data.total)) throw new Error("invalid total");
    markSuccess(state, SOURCE_AMOUNT, Date.now() - started, nowIso);
    return Math.round(parsed.data.total * 100);
  } catch (error) {
    markFailure(state, SOURCE_AMOUNT, error, nowIso);
    return null;
  }
}

export async function fetchRealtimeAmounts(env: Env, state: CollectorState, keys: string[], nowIso: string): Promise<Record<string, number>> {
  const nowMs = Date.parse(nowIso);
  const result: Record<string, number> = {};
  if (keys.length === 0 || breakerOpen(state, SOURCE_STREAMER, nowMs)) return result;
  const started = Date.now();
  const queue = [...keys];
  let failures = 0;
  let lastError: unknown = null;
  async function worker(): Promise<void> {
    while (queue.length > 0) {
      const key = queue.shift()!;
      try {
        const res = await fetchWithRetry(`${env.ZEVENT_STREAMER_URL}${encodeURIComponent(key)}`, { timeoutMs: 3000, retries: 1 });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const parsed = zeventStreamerSchema.safeParse(await res.json());
        if (!parsed.success || !Number.isFinite(parsed.data.donationAmount.number)) throw new Error("invalid streamer payload");
        result[key] = Math.max(0, Math.round(parsed.data.donationAmount.number * 100));
      } catch (error) {
        failures += 1;
        lastError = error;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(REALTIME_CONCURRENCY, keys.length) }, () => worker()));
  const fetched = Object.keys(result).length;
  console.log(JSON.stringify({ realtime: { keys: keys.length, fetched, failures, elapsedMs: Date.now() - started } }));
  if (fetched > 0) markSuccess(state, SOURCE_STREAMER, Math.round((Date.now() - started) / Math.max(1, fetched + failures)), nowIso);
  else markFailure(state, SOURCE_STREAMER, lastError ?? new Error("no realtime data"), nowIso);
  return result;
}
