import type { NotificationJob } from "@zevent-radar/contracts";

export interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface Env {
  DB: D1Database;
  DATA: R2Bucket;
  NOTIFICATIONS: Queue<NotificationJob>;
  REPORT_LIMITER?: RateLimiter;
  ASSETS: Fetcher;
  APP_URL: string;
  ZEVENT_APP_URL: string;
  ZEVENT_AMOUNT_URL: string;
  ZEVENT_STREAMER_URL: string;
  INGDOC_API_BASE: string;
  INGDOC_EVENT_ID: string;
  INGDOC_SYNC_ENABLED: string;
  VAPID_SUBJECT: string;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
  ADMIN_TOKEN?: string;
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
}
