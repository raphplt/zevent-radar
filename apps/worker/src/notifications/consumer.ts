import type { NotificationJob } from "@zevent-radar/contracts";
import type { Env } from "../env";
import { uuid } from "../lib/ids";
import { sendPush, type PushTarget } from "./push";

const DAILY_LIMIT = 60;
const MAX_FAILURES = 5;

const COLUMN_BY_TYPE: Record<NotificationJob["type"], string> = {
  approaching: "approaching_enabled",
  reached: "reached_enabled",
  accomplished: "accomplished_enabled",
  live: "live_enabled"
};

export async function handleNotificationBatch(batch: MessageBatch<NotificationJob>, env: Env): Promise<void> {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
    batch.ackAll();
    return;
  }
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayIso = dayStart.toISOString();
  for (const message of batch.messages) {
    const job = message.body;
    try {
      const column = COLUMN_BY_TYPE[job.type];
      const { results } = await env.DB.prepare(
        `SELECT s.id, s.endpoint, s.p256dh, s.auth, (SELECT COUNT(*) FROM notification_deliveries d WHERE d.subscription_id = s.id AND d.sent_at >= ? AND d.status = 'sent') AS sent_today FROM push_subscriptions s JOIN notification_preferences p ON p.subscription_id = s.id WHERE p.streamer_id = ? AND p.${column} = 1 AND s.failure_count < ?`
      )
        .bind(dayIso, job.streamerId, MAX_FAILURES)
        .all<PushTarget & { sent_today: number }>();
      const payload = { title: job.title, body: job.body, url: job.url, tag: job.tag, type: job.type, streamerId: job.streamerId };
      for (const target of results) {
        if (target.sent_today >= DAILY_LIMIT) continue;
        const claimed = await env.DB.prepare("INSERT OR IGNORE INTO notification_deliveries (id, event_key, subscription_id, notification_type, sent_at, status) VALUES (?, ?, ?, ?, ?, 'pending')")
          .bind(uuid(), job.eventKey, target.id, job.type, new Date().toISOString())
          .run();
        if (claimed.meta.changes === 0) continue;
        const outcome = await sendPush(env, target, payload);
        const at = new Date().toISOString();
        if (outcome === "sent") {
          await env.DB.batch([
            env.DB.prepare("UPDATE notification_deliveries SET status = 'sent', sent_at = ? WHERE event_key = ? AND subscription_id = ?").bind(at, job.eventKey, target.id),
            env.DB.prepare("UPDATE push_subscriptions SET last_success_at = ?, failure_count = 0 WHERE id = ?").bind(at, target.id)
          ]);
        } else if (outcome === "gone") {
          await env.DB.batch([
            env.DB.prepare("DELETE FROM notification_preferences WHERE subscription_id = ?").bind(target.id),
            env.DB.prepare("DELETE FROM push_subscriptions WHERE id = ?").bind(target.id),
            env.DB.prepare("UPDATE notification_deliveries SET status = 'gone' WHERE event_key = ? AND subscription_id = ?").bind(job.eventKey, target.id)
          ]);
        } else {
          await env.DB.batch([
            env.DB.prepare("UPDATE notification_deliveries SET status = ? WHERE event_key = ? AND subscription_id = ?").bind(outcome, job.eventKey, target.id),
            env.DB.prepare("UPDATE push_subscriptions SET failure_count = failure_count + 1 WHERE id = ?").bind(target.id)
          ]);
        }
      }
      message.ack();
    } catch (error) {
      console.error("notification job failed", job.eventKey, error);
      message.retry();
    }
  }
}
