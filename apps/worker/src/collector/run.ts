import type {
  GoalRecord,
  GoalsFile,
  HistoryFile,
  HistoryPoint,
  NotificationJob,
  PublicEvent,
  PublicState,
  PublicStatusFile,
  PublicStreamer,
  RadarEntry,
  StatusFile,
  StreamerLocation,
  ZeventLiveEntry
} from "@zevent-radar/contracts";
import { appendPoint, detectReachedGoals, evaluateStreamer, rankRadar, toPublicGoal } from "@zevent-radar/radar-engine";
import type { Env } from "../env";
import { runBatch } from "../lib/db";
import { nowIso as isoNow, uuid } from "../lib/ids";
import { KEYS, readJson, writeJson } from "../lib/r2";
import { formatEuros } from "../lib/format";
import { fetchApp, fetchEventTotal, fetchRealtimeAmounts, REALTIME_LIMIT } from "./sources";
import { loadState, saveState, type CollectorState } from "./state";

const STALE_AFTER_MS = 3 * 60 * 1000;
const DROP_RATIO = 0.2;
const DROP_MIN_CENTS = 5_000;
const GLOBAL_DROP_RATIO = 0.1;
const RECENT_EVENTS_LIMIT = 40;
const SNAPSHOT_CACHE = "public, max-age=31536000, immutable";
const LATEST_CACHE = "public, max-age=5";

interface EventInsert {
  key: string;
  kind: PublicEvent["kind"];
  isPublic: boolean;
  streamerId: string;
  streamerLogin: string;
  streamerDisplayName: string;
  goalId: string | null;
  goalLabel: string | null;
  amountCents: number | null;
  job: NotificationJob | null;
}

interface EventRow {
  id: string;
  kind: PublicEvent["kind"];
  streamer_id: string;
  streamer_login: string;
  streamer_display_name: string;
  goal_id: string | null;
  goal_label: string | null;
  amount_cents: number | null;
  created_at: string;
}

function streamerKey(entry: ZeventLiveEntry): string {
  return entry.twitch_id && entry.twitch_id.length > 0 ? entry.twitch_id : entry.twitch.toLowerCase();
}

function identityHash(entry: ZeventLiveEntry): string {
  return [entry.twitch.toLowerCase(), entry.display, entry.profileUrl ?? "", entry.donationUrl ?? ""].join("|");
}

function toLocation(value: string | null | undefined): StreamerLocation {
  switch (value) {
    case "lan":
    case "remote":
    case "remote_zbase":
    case "remote_villa":
    case "remote_ankama":
      return value;
    default:
      return "unknown";
  }
}

function realtimeKeys(live: ZeventLiveEntry[], goalsByStreamer: Map<string, GoalRecord[]>): string[] {
  const seen = new Set<string>();
  const scored: Array<{ key: string; priority: number }> = [];
  for (const entry of live) {
    if (!entry.online) continue;
    const id = streamerKey(entry);
    if (seen.has(id)) continue;
    seen.add(id);
    const cents = Math.round((Number.isFinite(entry.donationAmount.number) ? entry.donationAmount.number : 0) * 100);
    const pending = (goalsByStreamer.get(id) ?? []).filter((g) => g.category === "donation" && (g.status === "pending" || g.status === "verified") && g.amountCents > cents);
    const nearest = pending.length > 0 ? Math.min(...pending.map((g) => g.amountCents - cents)) : Number.POSITIVE_INFINITY;
    scored.push({ key: id, priority: nearest });
  }
  return scored.sort((a, b) => a.priority - b.priority).slice(0, REALTIME_LIMIT).map((s) => s.key);
}

function acceptAmount(state: CollectorState, id: string, cents: number, nowIso: string): number {
  const previous = state.previousAmounts[id];
  if (previous === undefined) return cents;
  const drop = previous - cents;
  if (drop > 0 && drop >= DROP_MIN_CENTS && drop > previous * DROP_RATIO) {
    const suspect = state.suspectDrops[id];
    if (suspect && suspect.cents === cents) {
      delete state.suspectDrops[id];
      return cents;
    }
    state.suspectDrops[id] = { cents, seenAt: nowIso };
    return previous;
  }
  delete state.suspectDrops[id];
  return cents;
}

function acceptEventTotal(state: CollectorState, cents: number | null, fallback: number | null): number {
  const candidate = cents ?? fallback ?? state.previousEventTotal ?? 0;
  const previous = state.previousEventTotal;
  if (previous !== null && candidate < previous * (1 - GLOBAL_DROP_RATIO)) {
    const suspect = state.suspectDrops["__event__"];
    if (suspect && suspect.cents === candidate) {
      delete state.suspectDrops["__event__"];
      return candidate;
    }
    state.suspectDrops["__event__"] = { cents: candidate, seenAt: isoNow() };
    return previous;
  }
  delete state.suspectDrops["__event__"];
  return candidate;
}

function buildJob(type: NotificationJob["type"], key: string, streamer: { id: string; login: string; display: string }, title: string, body: string, createdAt: string): NotificationJob {
  return {
    eventKey: key,
    type,
    streamerId: streamer.id,
    streamerLogin: streamer.login,
    title,
    body,
    url: `/streamers/${streamer.login}`,
    tag: key,
    createdAt
  };
}

export interface CollectResult {
  ok: boolean;
  stale: boolean;
  streamers: number;
  events: number;
  durationMs: number;
}

export async function runCollector(env: Env, options: { trigger: string } = { trigger: "cron" }): Promise<CollectResult> {
  const started = Date.now();
  const nowIso = new Date(started).toISOString();
  const [state, goalsFile, history] = await Promise.all([
    loadState(env.DATA),
    readJson<GoalsFile>(env.DATA, KEYS.goals),
    readJson<HistoryFile>(env.DATA, KEYS.history)
  ]);
  const [appResult, eventTotalCents] = await Promise.all([fetchApp(env, state, nowIso), fetchEventTotal(env, state, nowIso)]);
  const app = appResult.app;
  if (!app) {
    state.lastRunAt = nowIso;
    state.lastRunDurationMs = Date.now() - started;
    await Promise.all([saveState(env.DATA, state), writeStatus(env, state, null, goalsFile, [], nowIso, true)]);
    return { ok: false, stale: true, streamers: 0, events: 0, durationMs: Date.now() - started };
  }
  const series: Record<string, HistoryPoint[]> = history?.series ?? {};
  const eventSeries: HistoryPoint[] = history?.eventTotal ?? [];
  const goals: GoalRecord[] = goalsFile?.goals ?? [];
  const goalsByStreamer = new Map<string, GoalRecord[]>();
  for (const goal of goals) {
    const list = goalsByStreamer.get(goal.streamerId) ?? [];
    list.push(goal);
    goalsByStreamer.set(goal.streamerId, list);
  }
  const realtime = await fetchRealtimeAmounts(env, state, realtimeKeys(app.live, goalsByStreamer), nowIso);
  const sourceUpdatedAt = Object.keys(realtime).length > 0 ? nowIso : (appResult.fetchedAt ?? nowIso);
  const stale = started - Date.parse(sourceUpdatedAt) > STALE_AFTER_MS;
  const dataAgeSec = Math.max(0, Math.round((started - Date.parse(sourceUpdatedAt)) / 1000));
  const previousTotal = state.previousEventTotal;
  const totalCents = acceptEventTotal(state, eventTotalCents, app.donationAmount ? Math.round(app.donationAmount.number * 100) : null);
  const nextEventSeries = appendPoint(eventSeries, [started, totalCents]);
  const statements: D1PreparedStatement[] = [];
  const inserts: EventInsert[] = [];
  const reachedGoalIds = new Set<string>();
  const publicStreamers: PublicStreamer[] = [];
  const radarEntries: RadarEntry[] = [];
  const nextAmounts: Record<string, number> = {};
  const nextOnline: Record<string, boolean> = {};
  const firstRun = Object.keys(state.previousAmounts).length === 0;
  const seenIds = new Set<string>();

  for (const entry of app.live) {
    const id = streamerKey(entry);
    if (seenIds.has(id)) continue;
    seenIds.add(id);
    const login = entry.twitch.toLowerCase();
    const appCents = Math.max(0, Math.round((Number.isFinite(entry.donationAmount.number) ? entry.donationAmount.number : 0) * 100));
    const liveCents = realtime[id];
    const rawCents = liveCents !== undefined ? Math.max(liveCents, appCents) : appCents;
    const amountCents = appResult.fromCache && liveCents === undefined ? (state.previousAmounts[id] ?? rawCents) : acceptAmount(state, id, rawCents, nowIso);
    const previousCents = state.previousAmounts[id] ?? amountCents;
    nextAmounts[id] = amountCents;
    nextOnline[id] = entry.online;
    const hash = identityHash(entry);
    if (state.identityHash[id] !== hash) {
      statements.push(
        env.DB.prepare(
          "INSERT INTO streamers (id, twitch_id, twitch_login, display_name, profile_url, donation_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET twitch_id = excluded.twitch_id, twitch_login = excluded.twitch_login, display_name = excluded.display_name, profile_url = excluded.profile_url, donation_url = excluded.donation_url, updated_at = excluded.updated_at"
        ).bind(id, entry.twitch_id ?? null, login, entry.display, entry.profileUrl ?? null, entry.donationUrl ?? null, nowIso, nowIso)
      );
      state.identityHash[id] = hash;
    }
    const streamerSeries = appendPoint(series[id] ?? [], [started, amountCents]);
    series[id] = streamerSeries;
    const streamerGoals = goalsByStreamer.get(id) ?? [];
    const identity = { id, login, display: entry.display };
    if (!firstRun) {
      for (const goal of detectReachedGoals(streamerGoals, previousCents, amountCents)) {
        reachedGoalIds.add(goal.id);
        goal.status = "reached";
        goal.reachedAt = nowIso;
        goal.updatedAt = nowIso;
        statements.push(env.DB.prepare("UPDATE goals SET status = 'reached', reached_at = ?, updated_at = ? WHERE id = ? AND status IN ('pending', 'verified')").bind(nowIso, nowIso, goal.id));
        inserts.push({
          key: `reached:${goal.id}`,
          kind: "goal_reached",
          isPublic: true,
          streamerId: id,
          streamerLogin: login,
          streamerDisplayName: entry.display,
          goalId: goal.id,
          goalLabel: goal.label,
          amountCents: goal.amountCents,
          job: buildJob("reached", `reached:${goal.id}`, identity, `${entry.display} : palier ${formatEuros(goal.amountCents)} atteint`, goal.label, nowIso)
        });
      }
      const wasOnline = state.online[id] ?? false;
      if (entry.online && !wasOnline) {
        const minute = Math.floor(started / 60_000);
        inserts.push({
          key: `live:${id}:${minute}`,
          kind: "live_started",
          isPublic: true,
          streamerId: id,
          streamerLogin: login,
          streamerDisplayName: entry.display,
          goalId: null,
          goalLabel: null,
          amountCents: null,
          job: buildJob("live", `live:${id}:${minute}`, identity, `${entry.display} est en live`, entry.game && entry.game !== "Offline" ? entry.game : "Le stream vient de commencer", nowIso)
        });
      }
    }
    const result = evaluateStreamer({ id, online: entry.online, amountCents, goals: streamerGoals, series: streamerSeries }, started, dataAgeSec, totalCents);
    if (result.entry) {
      radarEntries.push(result.entry);
      if (result.entry.category === "imminent" && result.nextGoal && !firstRun) {
        const key = `approaching:${result.nextGoal.id}`;
        inserts.push({
          key,
          kind: "goal_reached",
          isPublic: false,
          streamerId: id,
          streamerLogin: login,
          streamerDisplayName: entry.display,
          goalId: result.nextGoal.id,
          goalLabel: result.nextGoal.label,
          amountCents: result.nextGoal.amountCents,
          job: buildJob("approaching", key, identity, `${entry.display} : palier imminent`, `${formatEuros(result.remainingCents ?? 0)} restants pour « ${result.nextGoal.label} »`, nowIso)
        });
      }
    }
    publicStreamers.push({
      id,
      twitchId: entry.twitch_id ?? id,
      login,
      displayName: entry.display,
      avatarUrl: entry.profileUrl ?? null,
      donationUrl: entry.donationUrl ?? null,
      location: toLocation(goalsFile?.locations?.[id]),
      online: entry.online,
      game: entry.game && entry.game !== "Offline" ? entry.game : null,
      viewers: Math.max(0, Math.round(entry.viewersAmount.number || 0)),
      amountCents,
      goalsCount: streamerGoals.filter((g) => g.status !== "rejected" && g.status !== "superseded").length,
      reachedCount: streamerGoals.filter((g) => g.status === "reached" || g.status === "accomplished").length,
      nextGoal: result.nextGoal ? toPublicGoal(result.nextGoal) : null,
      remainingCents: result.remainingCents,
      progress: result.progress,
      velocityCentsPerMinute: result.velocity.centsPerMinute,
      etaSeconds: result.etaSeconds,
      confidence: result.confidence,
      updatedAt: sourceUpdatedAt
    });
  }

  if (!firstRun && previousTotal !== null) {
    for (const goal of detectReachedGoals(goals, previousTotal, totalCents, "global")) {
      const owner = publicStreamers.find((s) => s.id === goal.streamerId);
      goal.status = "reached";
      goal.reachedAt = nowIso;
      goal.updatedAt = nowIso;
      reachedGoalIds.add(goal.id);
      statements.push(env.DB.prepare("UPDATE goals SET status = 'reached', reached_at = ?, updated_at = ? WHERE id = ? AND status IN ('pending', 'verified')").bind(nowIso, nowIso, goal.id));
      inserts.push({
        key: `reached:${goal.id}`,
        kind: "goal_reached",
        isPublic: true,
        streamerId: goal.streamerId,
        streamerLogin: owner?.login ?? goal.streamerId,
        streamerDisplayName: owner?.displayName ?? goal.streamerId,
        goalId: goal.id,
        goalLabel: goal.label,
        amountCents: goal.amountCents,
        job: owner ? buildJob("reached", `reached:${goal.id}`, { id: owner.id, login: owner.login, display: owner.displayName }, `${owner.displayName} : goal global ${formatEuros(goal.amountCents)} atteint`, goal.label, nowIso) : null
      });
    }
  }

  const eventStatements = inserts.map((e) =>
    env.DB.prepare(
      "INSERT OR IGNORE INTO events (id, event_key, kind, public, streamer_id, streamer_login, streamer_display_name, goal_id, goal_label, amount_cents, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(uuid(), e.key, e.kind, e.isPublic ? 1 : 0, e.streamerId, e.streamerLogin, e.streamerDisplayName, e.goalId, e.goalLabel, e.amountCents, nowIso)
  );
  const jobs: NotificationJob[] = [];
  if (eventStatements.length > 0) {
    const results = await runBatch(env.DB, eventStatements);
    results.forEach((res, index) => {
      const insert = inserts[index];
      if (res.meta.changes > 0 && insert?.job) jobs.push(insert.job);
    });
  }
  if (statements.length > 0) await runBatch(env.DB, statements);
  if (jobs.length > 0) {
    await env.NOTIFICATIONS.sendBatch(jobs.map((body) => ({ body })));
  }

  const recentEvents = await loadRecentEvents(env.DB);
  const onlineCount = publicStreamers.filter((s) => s.online).length;
  const radar = rankRadar(radarEntries);
  const latest: PublicState = {
    generatedAt: nowIso,
    sourceUpdatedAt,
    stale,
    event: {
      totalAmountCents: totalCents,
      viewerCount: Math.round(app.viewersCount?.number ?? publicStreamers.reduce((acc, s) => acc + s.viewers, 0)),
      onlineCount,
      streamerCount: publicStreamers.length,
      websiteMode: app.websiteMode ?? null,
      globalDonationUrl: app.globalDonationUrl ?? null
    },
    streamers: publicStreamers.sort((a, b) => b.amountCents - a.amountCents),
    radar,
    recentEvents
  };
  const nextGoalsFile: GoalsFile | null = goalsFile && reachedGoalIds.size > 0 ? { ...goalsFile, generatedAt: nowIso, version: goalsFile.version + 1, goals } : null;
  const historyFile: HistoryFile = { updatedAt: nowIso, series, eventTotal: nextEventSeries };
  const snapshot = {
    generatedAt: nowIso,
    totalAmountCents: totalCents,
    viewerCount: latest.event.viewerCount,
    streamers: publicStreamers.map((s) => [s.id, s.amountCents, s.viewers, s.online ? 1 : 0])
  };
  state.previousAmounts = nextAmounts;
  state.online = nextOnline;
  state.previousEventTotal = totalCents;
  state.lastRunAt = nowIso;
  state.lastRunDurationMs = Date.now() - started;
  await Promise.all([
    writeJson(env.DATA, KEYS.latest, latest, LATEST_CACHE),
    writeJson(env.DATA, KEYS.snapshot(nowIso.replace(/[:.]/g, "-")), snapshot, SNAPSHOT_CACHE),
    writeJson(env.DATA, KEYS.history, historyFile),
    nextGoalsFile ? writeJson(env.DATA, KEYS.goals, nextGoalsFile, LATEST_CACHE) : Promise.resolve(),
    saveState(env.DATA, state),
    writeStatus(env, state, latest, nextGoalsFile ?? goalsFile, radar, nowIso, stale)
  ]);
  return { ok: true, stale, streamers: publicStreamers.length, events: jobs.length, durationMs: Date.now() - started };
}

async function loadRecentEvents(db: D1Database): Promise<PublicEvent[]> {
  const { results } = await db
    .prepare("SELECT id, kind, streamer_id, streamer_login, streamer_display_name, goal_id, goal_label, amount_cents, created_at FROM events WHERE public = 1 ORDER BY created_at DESC LIMIT ?")
    .bind(RECENT_EVENTS_LIMIT)
    .all<EventRow>();
  return results.map((row) => ({
    id: row.id,
    kind: row.kind,
    streamerId: row.streamer_id,
    streamerLogin: row.streamer_login,
    streamerDisplayName: row.streamer_display_name,
    goalId: row.goal_id,
    goalLabel: row.goal_label,
    amountCents: row.amount_cents,
    createdAt: row.created_at
  }));
}

export async function writeStatus(env: Env, state: CollectorState, latest: PublicState | null, goalsFile: GoalsFile | null, radar: RadarEntry[], nowIso: string, stale: boolean): Promise<void> {
  const goals = goalsFile?.goals ?? [];
  const status: StatusFile = {
    generatedAt: nowIso,
    lastRunAt: state.lastRunAt,
    lastRunDurationMs: state.lastRunDurationMs,
    stale,
    sources: Object.values(state.sources),
    counts: {
      streamers: latest?.streamers.length ?? 0,
      online: latest?.event.onlineCount ?? 0,
      goals: goals.filter((g) => g.status !== "rejected" && g.status !== "superseded").length,
      goalsReached: goals.filter((g) => g.status === "reached").length,
      goalsAccomplished: goals.filter((g) => g.status === "accomplished").length,
      radarEntries: radar.length
    },
    goalsVersion: goalsFile?.version ?? 0,
    goalsSyncedAt: state.goalsSyncedAt
  };
  const failing = status.sources.filter((s) => !s.ok);
  const publicStatus: PublicStatusFile = {
    generatedAt: status.generatedAt,
    lastRunAt: status.lastRunAt,
    stale,
    healthy: !stale && failing.length === 0,
    degraded: failing.length > 0,
    counts: status.counts,
    goalsSyncedAt: status.goalsSyncedAt
  };
  await Promise.all([
    writeJson(env.DATA, KEYS.internalStatus, status),
    writeJson(env.DATA, KEYS.status, publicStatus, "public, max-age=5")
  ]);
}
