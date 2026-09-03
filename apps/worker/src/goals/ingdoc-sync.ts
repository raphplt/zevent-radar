import {
  ingdocGoalsSchema,
  ingdocOverviewSchema,
  mapIngdocToImport,
  type IngdocGoal,
  type IngdocOverviewEntry,
  type StreamerLocation
} from "@zevent-radar/contracts";
import type { Env } from "../env";
import { fetchWithRetry } from "../lib/http";
import { loadState, markFailure, markSuccess, saveState } from "../collector/state";
import { importGoals, type ImportSummary } from "./catalog";

export const SOURCE_INGDOC = "ingdoc";
const BATCH_SIZE = 20;

async function getJson(url: string): Promise<unknown> {
  const res = await fetchWithRetry(url, { timeoutMs: 8000, retries: 2 });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

function signature(entry: IngdocOverviewEntry): string {
  return `${entry.donation_goals_count}:${entry.next_donation_goal?.id ?? ""}:${entry.next_donation_goal?.amount ?? ""}`;
}

export interface SyncResult extends ImportSummary {
  fetched: number;
  changed: number;
  remaining: number;
  cycleCompleted: boolean;
}

export async function syncFromIngdoc(env: Env, actor = "ingdoc-sync", batchSize = BATCH_SIZE): Promise<SyncResult> {
  const at = new Date().toISOString();
  const state = await loadState(env.DATA);
  const started = Date.now();
  try {
    const overview = ingdocOverviewSchema.parse(await getJson(`${env.INGDOC_API_BASE}/events/${env.INGDOC_EVENT_ID}/donation_goals/overview`));
    const withGoals = overview.filter((p) => p.donation_goals_count > 0).sort((a, b) => a.id.localeCompare(b.id));
    const signatures = state.ingdocSignatures ?? {};
    const changed = withGoals.filter((p) => signatures[p.id] !== signature(p));
    const cursor = state.ingdocCursor ?? "";
    const rotation = withGoals.filter((p) => p.id > cursor);
    const wrapped = rotation.length === 0 ? withGoals : rotation;
    const picked: IngdocOverviewEntry[] = [];
    const seen = new Set<string>();
    for (const entry of [...changed, ...wrapped]) {
      if (picked.length >= batchSize) break;
      if (seen.has(entry.id)) continue;
      seen.add(entry.id);
      picked.push(entry);
    }
    const goalsByParticipation = new Map<string, IngdocGoal[]>();
    let index = 0;
    async function worker() {
      while (index < picked.length) {
        const entry = picked[index];
        index += 1;
        if (!entry) return;
        goalsByParticipation.set(entry.id, ingdocGoalsSchema.parse(await getJson(`${env.INGDOC_API_BASE}/participations/${entry.id}/donation_goals`)));
      }
    }
    await Promise.all(Array.from({ length: 5 }, worker));
    const file = mapIngdocToImport(picked, goalsByParticipation, at);
    const locations: Record<string, StreamerLocation> = {};
    for (const entry of overview) {
      const twitch = entry.socials?.twitch ?? entry.streamers?.[0]?.socials?.twitch;
      const key = twitch?.id ?? twitch?.login?.toLowerCase();
      if (key && entry.location) locations[key] = entry.location as StreamerLocation;
    }
    const { summary, jobs } = await importGoals(env, file, { actor, mode: "sync", locations });
    if (jobs.length > 0) await env.NOTIFICATIONS.sendBatch(jobs.map((body) => ({ body })));
    const fresh = await loadState(env.DATA);
    const nextSignatures = { ...(fresh.ingdocSignatures ?? {}) };
    for (const entry of picked) nextSignatures[entry.id] = signature(entry);
    const rotationPicked = picked.filter((p) => !changed.includes(p) || p.id > cursor);
    const lastRotation = rotationPicked.length > 0 ? rotationPicked[rotationPicked.length - 1]!.id : cursor;
    const cycleCompleted = rotation.length === 0 || rotation.every((p) => seen.has(p.id));
    fresh.ingdocSignatures = nextSignatures;
    fresh.ingdocCursor = cycleCompleted ? "" : lastRotation;
    if (cycleCompleted) fresh.goalsSyncedAt = at;
    markSuccess(fresh, SOURCE_INGDOC, Date.now() - started, at);
    await saveState(env.DATA, fresh);
    const remaining = cycleCompleted ? 0 : withGoals.filter((p) => p.id > lastRotation).length;
    return { ...summary, fetched: picked.length, changed: changed.length, remaining, cycleCompleted };
  } catch (error) {
    markFailure(state, SOURCE_INGDOC, error, at);
    await saveState(env.DATA, state);
    throw error;
  }
}
