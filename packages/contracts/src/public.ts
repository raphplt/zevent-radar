import type { GoalRecord } from "./goals";
import type { GoalCategory, GoalStatus } from "./labels";

export type Confidence = "high" | "medium" | "low";
export type RadarCategory = "imminent" | "very_close" | "accelerating" | "watch";
export type StreamerLocation = "lan" | "remote" | "remote_zbase" | "remote_villa" | "remote_ankama" | "unknown";

export interface PublicGoal {
  id: string;
  amountCents: number;
  label: string;
  category: GoalCategory;
  status: GoalStatus;
  sourceUrl: string | null;
  reachedAt: string | null;
  accomplishedAt: string | null;
}

export interface PublicStreamer {
  id: string;
  twitchId: string;
  login: string;
  displayName: string;
  avatarUrl: string | null;
  donationUrl: string | null;
  location: StreamerLocation;
  online: boolean;
  game: string | null;
  viewers: number;
  amountCents: number;
  goalsCount: number;
  reachedCount: number;
  nextGoal: PublicGoal | null;
  remainingCents: number | null;
  progress: number | null;
  velocityCentsPerMinute: number | null;
  etaSeconds: number | null;
  confidence: Confidence | null;
  updatedAt: string;
}

export interface RadarEntry {
  streamerId: string;
  category: RadarCategory;
  score: number;
  remainingCents: number;
  progress: number;
  etaSeconds: number | null;
  confidence: Confidence | null;
  velocityCentsPerMinute: number | null;
  goal: PublicGoal;
}

export type PublicEventKind = "goal_reached" | "goal_accomplished" | "live_started" | "goal_added" | "goal_updated";

export interface PublicEvent {
  id: string;
  kind: PublicEventKind;
  streamerId: string;
  streamerLogin: string;
  streamerDisplayName: string;
  goalId: string | null;
  goalLabel: string | null;
  amountCents: number | null;
  createdAt: string;
}

export interface PublicState {
  generatedAt: string;
  sourceUpdatedAt: string;
  stale: boolean;
  event: {
    totalAmountCents: number;
    viewerCount: number;
    onlineCount: number;
    streamerCount: number;
    websiteMode: string | null;
    globalDonationUrl: string | null;
  };
  streamers: PublicStreamer[];
  radar: RadarEntry[];
  recentEvents: PublicEvent[];
}

export interface GoalsFile {
  generatedAt: string;
  version: number;
  goals: GoalRecord[];
  locations?: Record<string, StreamerLocation>;
}

export interface SourceHealth {
  name: string;
  ok: boolean;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastError: string | null;
  latencyMs: number | null;
  consecutiveFailures: number;
}

export interface StatusFile {
  generatedAt: string;
  lastRunAt: string | null;
  lastRunDurationMs: number | null;
  stale: boolean;
  sources: SourceHealth[];
  counts: {
    streamers: number;
    online: number;
    goals: number;
    goalsReached: number;
    goalsAccomplished: number;
    radarEntries: number;
  };
  goalsVersion: number;
  goalsSyncedAt: string | null;
}

export interface PublicStatusFile {
  generatedAt: string;
  lastRunAt: string | null;
  stale: boolean;
  healthy: boolean;
  degraded: boolean;
  counts: StatusFile["counts"];
  goalsSyncedAt: string | null;
}

export type HistoryPoint = [timestampMs: number, amountCents: number];

export interface HistoryFile {
  updatedAt: string;
  series: Record<string, HistoryPoint[]>;
  eventTotal: HistoryPoint[];
}

export interface StreamerHistoryResponse {
  streamerId: string;
  updatedAt: string;
  points: HistoryPoint[];
}

/** Bulk history for several streamers, downsampled to keep the payload light. */
export interface BulkHistoryResponse {
  updatedAt: string;
  series: Record<string, HistoryPoint[]>;
}

/** Paginated public event feed. `nextBefore` is the cursor for the following page, null at the end. */
export interface EventsResponse {
  events: PublicEvent[];
  nextBefore: string | null;
}
