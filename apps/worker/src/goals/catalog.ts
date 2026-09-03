import {
  goalImportFileSchema,
  type GoalImportFile,
  type GoalRecord,
  type GoalsFile,
  type NotificationJob,
  type PublicState,
  type StreamerLocation
} from "@zevent-radar/contracts";
import type { Env } from "../env";
import { audit, loadAllGoals, loadStreamers, runBatch } from "../lib/db";
import { normalizeLabel, nowIso, uuid } from "../lib/ids";
import { KEYS, readJson, writeJson } from "../lib/r2";
import { formatEuros } from "../lib/format";

export interface ImportSummary {
  created: number;
  updated: number;
  unchanged: number;
  reached: number;
  accomplished: number;
  superseded: number;
  unresolved: string[];
  dryRun: boolean;
}

export interface ImportOptions {
  actor: string;
  mode: "sync" | "merge";
  dryRun?: boolean;
  locations?: Record<string, StreamerLocation>;
}

export async function publishGoals(env: Env, locations?: Record<string, StreamerLocation>): Promise<GoalsFile> {
  const [goals, previous] = await Promise.all([loadAllGoals(env.DB), readJson<GoalsFile>(env.DATA, KEYS.goals)]);
  const file: GoalsFile = {
    generatedAt: nowIso(),
    version: (previous?.version ?? 0) + 1,
    goals,
    locations: locations ?? previous?.locations ?? {}
  };
  await writeJson(env.DATA, KEYS.goals, file, "public, max-age=15, stale-while-revalidate=120");
  return file;
}

function goalMatchKey(streamerId: string, amountCents: number, label: string): string {
  return `${streamerId}|${amountCents}|${normalizeLabel(label)}`;
}

export async function importGoals(env: Env, input: unknown, options: ImportOptions): Promise<{ summary: ImportSummary; jobs: NotificationJob[] }> {
  const file: GoalImportFile = goalImportFileSchema.parse(input);
  const at = nowIso();
  const [streamers, existing, latest] = await Promise.all([loadStreamers(env.DB), loadAllGoals(env.DB), readJson<PublicState>(env.DATA, KEYS.latest)]);
  const byTwitchId = new Map(streamers.filter((s) => s.twitch_id).map((s) => [s.twitch_id as string, s]));
  const byLogin = new Map(streamers.map((s) => [s.twitch_login.toLowerCase(), s]));
  const byId = new Map(streamers.map((s) => [s.id, s]));
  const amounts = new Map((latest?.streamers ?? []).map((s) => [s.id, s.amountCents]));
  const eventTotal = latest?.event.totalAmountCents ?? 0;
  const existingById = new Map(existing.map((g) => [g.id, g]));
  const existingByKey = new Map(existing.map((g) => [goalMatchKey(g.streamerId, g.amountCents, g.label), g]));
  const seenIds = new Set<string>();
  const statements: D1PreparedStatement[] = [];
  const jobs: NotificationJob[] = [];
  const summary: ImportSummary = { created: 0, updated: 0, unchanged: 0, reached: 0, accomplished: 0, superseded: 0, unresolved: [], dryRun: options.dryRun === true };
  const sourceName = file.source?.name ?? "import";

  for (const entry of file.streamers) {
    const login = entry.twitchLogin.toLowerCase();
    const streamer = (entry.twitchId ? byTwitchId.get(entry.twitchId) : undefined) ?? byLogin.get(login) ?? (entry.twitchId ? byId.get(entry.twitchId) : undefined);
    if (!streamer) {
      summary.unresolved.push(login);
      continue;
    }
    const streamerId = streamer.id;
    const current = amounts.get(streamerId) ?? 0;
    for (const goal of entry.goals) {
      const amountCents = Math.round(goal.amount * 100);
      const reference = goal.category === "global" ? eventTotal : current;
      const found = (goal.id ? existingById.get(goal.id) : undefined) ?? existingByKey.get(goalMatchKey(streamerId, amountCents, goal.label));
      if (found) {
        seenIds.add(found.id);
        const changed = found.amountCents !== amountCents || found.label !== goal.label || found.category !== goal.category || (goal.sourceUrl !== undefined && goal.sourceUrl !== null && found.sourceUrl !== goal.sourceUrl);
        let status = found.status;
        let reachedAt = found.reachedAt;
        let accomplishedAt = found.accomplishedAt;
        if (goal.accomplished && status !== "accomplished" && status !== "rejected") {
          status = "accomplished";
          accomplishedAt = at;
          reachedAt = reachedAt ?? at;
          summary.accomplished += 1;
          jobs.push({
            eventKey: `accomplished:${found.id}`,
            type: "accomplished",
            streamerId,
            streamerLogin: streamer.twitch_login,
            title: `${streamer.display_name} : goal accompli`,
            body: `${goal.label} (${formatEuros(amountCents)})`,
            url: `/streamers/${streamer.twitch_login}`,
            tag: `accomplished:${found.id}`,
            createdAt: at
          });
        } else if ((status === "pending" || status === "verified") && (goal.reached || (goal.category === "donation" && amountCents <= reference && reference > 0))) {
          status = "reached";
          reachedAt = at;
          summary.reached += 1;
        } else if (status === "reached" && changed && goal.category === "donation" && amountCents > reference && !goal.reached) {
          status = "verified";
          reachedAt = null;
        }
        const statusChanged = status !== found.status;
        if (!changed && !statusChanged) {
          summary.unchanged += 1;
          continue;
        }
        if (changed) {
          summary.updated += 1;
          statements.push(
            env.DB.prepare("INSERT INTO goal_versions (id, goal_id, amount_cents, label, category, status, source_url, changed_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(uuid(), found.id, found.amountCents, found.label, found.category, found.status, found.sourceUrl, options.actor, at)
          );
        }
        statements.push(
          env.DB.prepare("UPDATE goals SET amount_cents = ?, label = ?, category = ?, status = ?, source_url = ?, source_name = ?, reached_at = ?, accomplished_at = ?, updated_at = ? WHERE id = ?").bind(
            amountCents,
            goal.label,
            goal.category,
            status,
            goal.sourceUrl ?? found.sourceUrl,
            found.sourceName ?? sourceName,
            reachedAt,
            accomplishedAt,
            at,
            found.id
          )
        );
        if (statusChanged && status === "accomplished") {
          statements.push(
            env.DB.prepare("INSERT OR IGNORE INTO events (id, event_key, kind, public, streamer_id, streamer_login, streamer_display_name, goal_id, goal_label, amount_cents, created_at) VALUES (?, ?, 'goal_accomplished', 1, ?, ?, ?, ?, ?, ?, ?)").bind(uuid(), `accomplished:${found.id}`, streamerId, streamer.twitch_login, streamer.display_name, found.id, goal.label, amountCents, at)
          );
        }
        continue;
      }
      const id = goal.id && !existingById.has(goal.id) ? goal.id : uuid();
      seenIds.add(id);
      let status: GoalRecord["status"] = "verified";
      let reachedAt: string | null = null;
      let accomplishedAt: string | null = null;
      if (goal.accomplished) {
        status = "accomplished";
        accomplishedAt = at;
        reachedAt = at;
      } else if (goal.reached || (goal.category === "donation" && reference > 0 && amountCents <= reference)) {
        status = "reached";
        reachedAt = at;
      }
      summary.created += 1;
      statements.push(
        env.DB.prepare("INSERT INTO goals (id, streamer_id, amount_cents, label, category, status, source_url, source_name, verified_at, reached_at, accomplished_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(
          id,
          streamerId,
          amountCents,
          goal.label,
          goal.category,
          status,
          goal.sourceUrl ?? null,
          sourceName,
          at,
          reachedAt,
          accomplishedAt,
          at,
          at
        )
      );
    }
  }

  if (options.mode === "sync") {
    const syncedStreamers = new Set<string>();
    for (const entry of file.streamers) {
      const login = entry.twitchLogin.toLowerCase();
      const streamer = (entry.twitchId ? byTwitchId.get(entry.twitchId) : undefined) ?? byLogin.get(login);
      if (streamer) syncedStreamers.add(streamer.id);
    }
    for (const goal of existing) {
      if (goal.sourceName === sourceName && syncedStreamers.has(goal.streamerId) && !seenIds.has(goal.id) && goal.status !== "superseded" && goal.status !== "rejected") {
        summary.superseded += 1;
        statements.push(env.DB.prepare("UPDATE goals SET status = 'superseded', updated_at = ? WHERE id = ?").bind(at, goal.id));
      }
    }
  }

  if (options.dryRun) return { summary, jobs: [] };
  statements.push(audit(env.DB, options.actor, `goals.${options.mode}`, "goals", null, { ...summary, source: sourceName }));
  await runBatch(env.DB, statements);
  await publishGoals(env, options.locations);
  return { summary, jobs };
}
