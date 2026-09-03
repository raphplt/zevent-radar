import type { SourceHealth, ZeventApp } from "@zevent-radar/contracts";
import { KEYS, readJson, writeJson } from "../lib/r2";

export interface CollectorState {
  version: 1;
  lastRunAt: string | null;
  lastRunDurationMs: number | null;
  previousAmounts: Record<string, number>;
  previousEventTotal: number | null;
  suspectDrops: Record<string, { cents: number; seenAt: string }>;
  online: Record<string, boolean>;
  identityHash: Record<string, string>;
  etag: string | null;
  lastApp: ZeventApp | null;
  lastAppAt: string | null;
  sources: Record<string, SourceHealth>;
  goalsSyncedAt: string | null;
}

export function emptyState(): CollectorState {
  return {
    version: 1,
    lastRunAt: null,
    lastRunDurationMs: null,
    previousAmounts: {},
    previousEventTotal: null,
    suspectDrops: {},
    online: {},
    identityHash: {},
    etag: null,
    lastApp: null,
    lastAppAt: null,
    sources: {},
    goalsSyncedAt: null
  };
}

export async function loadState(bucket: R2Bucket): Promise<CollectorState> {
  const state = await readJson<CollectorState>(bucket, KEYS.state);
  return state ? { ...emptyState(), ...state } : emptyState();
}

export async function saveState(bucket: R2Bucket, state: CollectorState): Promise<void> {
  await writeJson(bucket, KEYS.state, state);
}

export function sourceHealth(state: CollectorState, name: string): SourceHealth {
  return (
    state.sources[name] ?? {
      name,
      ok: false,
      lastSuccessAt: null,
      lastErrorAt: null,
      lastError: null,
      latencyMs: null,
      consecutiveFailures: 0
    }
  );
}

export function markSuccess(state: CollectorState, name: string, latencyMs: number, at: string): void {
  const health = sourceHealth(state, name);
  state.sources[name] = { ...health, ok: true, lastSuccessAt: at, latencyMs, consecutiveFailures: 0, lastError: null };
}

export function markFailure(state: CollectorState, name: string, error: unknown, at: string): void {
  const health = sourceHealth(state, name);
  state.sources[name] = {
    ...health,
    ok: false,
    lastErrorAt: at,
    lastError: error instanceof Error ? error.message : String(error),
    consecutiveFailures: health.consecutiveFailures + 1
  };
}
