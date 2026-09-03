import {
  ingdocGoalsSchema,
  ingdocOverviewSchema,
  mapIngdocToImport,
  type IngdocGoal,
  type StreamerLocation
} from "@zevent-radar/contracts";
import type { Env } from "../env";
import { fetchWithRetry } from "../lib/http";
import { loadState, markFailure, markSuccess, saveState } from "../collector/state";
import { importGoals, type ImportSummary } from "./catalog";

export const SOURCE_INGDOC = "ingdoc";

async function getJson(url: string): Promise<unknown> {
  const res = await fetchWithRetry(url, { timeoutMs: 8000, retries: 2 });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

export async function syncFromIngdoc(env: Env, actor = "ingdoc-sync"): Promise<ImportSummary> {
  const at = new Date().toISOString();
  const state = await loadState(env.DATA);
  const started = Date.now();
  try {
    const overview = ingdocOverviewSchema.parse(await getJson(`${env.INGDOC_API_BASE}/events/${env.INGDOC_EVENT_ID}/donation_goals/overview`));
    const withGoals = overview.filter((p) => p.donation_goals_count > 0);
    const goalsByParticipation = new Map<string, IngdocGoal[]>();
    let index = 0;
    async function worker() {
      while (index < withGoals.length) {
        const entry = withGoals[index];
        index += 1;
        if (!entry) return;
        goalsByParticipation.set(entry.id, ingdocGoalsSchema.parse(await getJson(`${env.INGDOC_API_BASE}/participations/${entry.id}/donation_goals`)));
      }
    }
    await Promise.all(Array.from({ length: 6 }, worker));
    const file = mapIngdocToImport(overview, goalsByParticipation, at);
    const locations: Record<string, StreamerLocation> = {};
    for (const entry of overview) {
      const twitch = entry.socials?.twitch ?? entry.streamers?.[0]?.socials?.twitch;
      const key = twitch?.id ?? twitch?.login?.toLowerCase();
      if (key && entry.location) locations[key] = entry.location as StreamerLocation;
    }
    const { summary, jobs } = await importGoals(env, file, { actor, mode: "sync", locations });
    if (jobs.length > 0) await env.NOTIFICATIONS.sendBatch(jobs.map((body) => ({ body })));
    const fresh = await loadState(env.DATA);
    markSuccess(fresh, SOURCE_INGDOC, Date.now() - started, at);
    fresh.goalsSyncedAt = at;
    await saveState(env.DATA, fresh);
    return summary;
  } catch (error) {
    markFailure(state, SOURCE_INGDOC, error, at);
    await saveState(env.DATA, state);
    throw error;
  }
}
