CREATE TABLE IF NOT EXISTS streamers (
  id TEXT PRIMARY KEY,
  twitch_id TEXT,
  twitch_login TEXT NOT NULL,
  display_name TEXT NOT NULL,
  profile_url TEXT,
  donation_url TEXT,
  location TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_streamers_login ON streamers(twitch_login);

CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY,
  streamer_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  label TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'donation',
  status TEXT NOT NULL DEFAULT 'pending',
  source_url TEXT,
  source_name TEXT,
  verified_at TEXT,
  reached_at TEXT,
  accomplished_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_goals_streamer ON goals(streamer_id, status);

CREATE TABLE IF NOT EXISTS goal_versions (
  id TEXT PRIMARY KEY,
  goal_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  label TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL,
  source_url TEXT,
  changed_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_goal_versions_goal ON goal_versions(goal_id);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  event_key TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL,
  public INTEGER NOT NULL DEFAULT 1,
  streamer_id TEXT NOT NULL,
  streamer_login TEXT NOT NULL,
  streamer_display_name TEXT NOT NULL,
  goal_id TEXT,
  goal_label TEXT,
  amount_cents INTEGER,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_public_created ON events(public, created_at DESC);

CREATE TABLE IF NOT EXISTS community_reports (
  id TEXT PRIMARY KEY,
  streamer_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  message TEXT NOT NULL,
  source_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  installation_id TEXT NOT NULL,
  ip_hash TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT,
  reviewed_at TEXT,
  reviewed_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_reports_status_created ON community_reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_installation ON community_reports(installation_id, created_at DESC);

CREATE TABLE IF NOT EXISTS report_confirmations (
  report_id TEXT NOT NULL,
  installation_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (report_id, installation_id)
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  installation_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_success_at TEXT,
  failure_count INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_push_installation ON push_subscriptions(installation_id);

CREATE TABLE IF NOT EXISTS notification_preferences (
  subscription_id TEXT NOT NULL,
  streamer_id TEXT NOT NULL,
  approaching_enabled INTEGER NOT NULL DEFAULT 1,
  reached_enabled INTEGER NOT NULL DEFAULT 1,
  accomplished_enabled INTEGER NOT NULL DEFAULT 1,
  live_enabled INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (subscription_id, streamer_id)
);
CREATE INDEX IF NOT EXISTS idx_prefs_streamer ON notification_preferences(streamer_id);

CREATE TABLE IF NOT EXISTS notification_deliveries (
  id TEXT PRIMARY KEY,
  event_key TEXT NOT NULL,
  subscription_id TEXT NOT NULL,
  notification_type TEXT NOT NULL,
  sent_at TEXT NOT NULL,
  status TEXT NOT NULL,
  UNIQUE (event_key, subscription_id)
);
CREATE INDEX IF NOT EXISTS idx_deliveries_sub_sent ON notification_deliveries(subscription_id, sent_at DESC);

CREATE TABLE IF NOT EXISTS moderation_audit (
  id TEXT PRIMARY KEY,
  moderator_id TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON moderation_audit(created_at DESC);
