import type { GoalRecord } from "@zevent-radar/contracts";

export interface GoalRow {
  id: string;
  streamer_id: string;
  amount_cents: number;
  label: string;
  category: string;
  status: string;
  source_url: string | null;
  source_name: string | null;
  verified_at: string | null;
  reached_at: string | null;
  accomplished_at: string | null;
  created_at: string;
  updated_at: string;
}

export function rowToGoal(row: GoalRow): GoalRecord {
  return {
    id: row.id,
    streamerId: row.streamer_id,
    amountCents: row.amount_cents,
    label: row.label,
    category: row.category as GoalRecord["category"],
    status: row.status as GoalRecord["status"],
    sourceUrl: row.source_url,
    sourceName: row.source_name,
    verifiedAt: row.verified_at,
    reachedAt: row.reached_at,
    accomplishedAt: row.accomplished_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function loadAllGoals(db: D1Database): Promise<GoalRecord[]> {
  const { results } = await db.prepare("SELECT * FROM goals ORDER BY streamer_id, amount_cents").all<GoalRow>();
  return results.map(rowToGoal);
}

export interface StreamerRow {
  id: string;
  twitch_id: string | null;
  twitch_login: string;
  display_name: string;
  profile_url: string | null;
  donation_url: string | null;
  location: string | null;
}

export async function loadStreamers(db: D1Database): Promise<StreamerRow[]> {
  const { results } = await db.prepare("SELECT id, twitch_id, twitch_login, display_name, profile_url, donation_url, location FROM streamers").all<StreamerRow>();
  return results;
}

export async function runBatch(db: D1Database, statements: D1PreparedStatement[], chunk = 100): Promise<D1Result[]> {
  const results: D1Result[] = [];
  for (let i = 0; i < statements.length; i += chunk) {
    const part = statements.slice(i, i + chunk);
    results.push(...(await db.batch(part)));
  }
  return results;
}

export function audit(db: D1Database, moderator: string, action: string, entityType: string, entityId: string | null, metadata: unknown): D1PreparedStatement {
  return db
    .prepare("INSERT INTO moderation_audit (id, moderator_id, action, entity_type, entity_id, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), moderator, action, entityType, entityId, JSON.stringify(metadata ?? null), new Date().toISOString());
}
