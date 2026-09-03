import { subscribeSchema, unsubscribeSchema, updatePreferencesSchema } from "@zevent-radar/contracts";
import { Hono } from "hono";
import type { Env } from "../env";
import { runBatch } from "../lib/db";
import { nowIso, uuid } from "../lib/ids";
import { sendPush } from "../notifications/push";

export const pushRoutes = new Hono<{ Bindings: Env }>();

pushRoutes.get("/api/push/vapid-public-key", (c) => {
  if (!c.env.VAPID_PUBLIC_KEY) return c.json({ enabled: false, publicKey: null });
  return c.json({ enabled: true, publicKey: c.env.VAPID_PUBLIC_KEY });
});

pushRoutes.post("/api/push/subscribe", async (c) => {
  const parsed = subscribeSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid payload", issues: parsed.error.issues }, 400);
  const { installationId, subscription } = parsed.data;
  const at = nowIso();
  const existing = await c.env.DB.prepare("SELECT id FROM push_subscriptions WHERE endpoint = ?").bind(subscription.endpoint).first<{ id: string }>();
  const id = existing?.id ?? uuid();
  await c.env.DB.prepare(
    "INSERT INTO push_subscriptions (id, endpoint, p256dh, auth, installation_id, created_at, failure_count) VALUES (?, ?, ?, ?, ?, ?, 0) ON CONFLICT(endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth, installation_id = excluded.installation_id, failure_count = 0"
  )
    .bind(id, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth, installationId, at)
    .run();
  return c.json({ id, installationId });
});

pushRoutes.post("/api/push/unsubscribe", async (c) => {
  const parsed = unsubscribeSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid payload" }, 400);
  const { installationId, endpoint } = parsed.data;
  const where = endpoint ? "installation_id = ? AND endpoint = ?" : "installation_id = ?";
  const binds = endpoint ? [installationId, endpoint] : [installationId];
  await c.env.DB.batch([
    c.env.DB.prepare(`DELETE FROM notification_preferences WHERE subscription_id IN (SELECT id FROM push_subscriptions WHERE ${where})`).bind(...binds),
    c.env.DB.prepare(`DELETE FROM push_subscriptions WHERE ${where}`).bind(...binds)
  ]);
  return c.json({ ok: true });
});

pushRoutes.get("/api/push/preferences", async (c) => {
  const installationId = c.req.query("installationId");
  if (!installationId) return c.json({ error: "installationId required" }, 400);
  const { results } = await c.env.DB.prepare(
    "SELECT DISTINCT p.streamer_id, p.approaching_enabled, p.reached_enabled, p.accomplished_enabled, p.live_enabled FROM notification_preferences p JOIN push_subscriptions s ON s.id = p.subscription_id WHERE s.installation_id = ?"
  )
    .bind(installationId)
    .all<{ streamer_id: string; approaching_enabled: number; reached_enabled: number; accomplished_enabled: number; live_enabled: number }>();
  const subs = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM push_subscriptions WHERE installation_id = ?").bind(installationId).first<{ n: number }>();
  return c.json({
    subscribed: (subs?.n ?? 0) > 0,
    preferences: results.map((r) => ({ streamerId: r.streamer_id, approaching: r.approaching_enabled === 1, reached: r.reached_enabled === 1, accomplished: r.accomplished_enabled === 1, live: r.live_enabled === 1 }))
  }, 200, { "cache-control": "no-store" });
});

pushRoutes.put("/api/push/preferences", async (c) => {
  const parsed = updatePreferencesSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid payload", issues: parsed.error.issues }, 400);
  const { installationId, preferences } = parsed.data;
  const { results } = await c.env.DB.prepare("SELECT id FROM push_subscriptions WHERE installation_id = ?").bind(installationId).all<{ id: string }>();
  if (results.length === 0) return c.json({ error: "no subscription" }, 404);
  const statements: D1PreparedStatement[] = [];
  for (const sub of results) {
    statements.push(c.env.DB.prepare("DELETE FROM notification_preferences WHERE subscription_id = ?").bind(sub.id));
    for (const pref of preferences) {
      statements.push(
        c.env.DB.prepare("INSERT INTO notification_preferences (subscription_id, streamer_id, approaching_enabled, reached_enabled, accomplished_enabled, live_enabled) VALUES (?, ?, ?, ?, ?, ?)").bind(
          sub.id,
          pref.streamerId,
          pref.approaching ? 1 : 0,
          pref.reached ? 1 : 0,
          pref.accomplished ? 1 : 0,
          pref.live ? 1 : 0
        )
      );
    }
  }
  await runBatch(c.env.DB, statements);
  return c.json({ ok: true, streamers: preferences.length });
});

pushRoutes.post("/api/push/test", async (c) => {
  const parsed = unsubscribeSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid payload" }, 400);
  const { results } = await c.env.DB.prepare("SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE installation_id = ?").bind(parsed.data.installationId).all<{ id: string; endpoint: string; p256dh: string; auth: string }>();
  if (results.length === 0) return c.json({ error: "no subscription" }, 404);
  const outcomes = await Promise.all(results.map((t) => sendPush(c.env, t, { title: "ZEvent Radar", body: "Les notifications fonctionnent.", url: "/settings", tag: "test", type: "test" }, 60)));
  return c.json({ outcomes });
});
