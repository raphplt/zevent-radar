import type { NotificationJob } from "@zevent-radar/contracts";
import { app } from "./api/app";
import { runCollector } from "./collector/run";
import type { Env } from "./env";
import { syncFromIngdoc } from "./goals/ingdoc-sync";
import { handleNotificationBatch } from "./notifications/consumer";

const COLLECT_CYCLE_MS = 20_000;
const COLLECT_BUDGET_MS = 55_000;

async function collectLoop(env: Env, scheduledTime: number): Promise<void> {
  const started = Date.now();
  console.log(JSON.stringify({ loop: "start", scheduledTime: new Date(scheduledTime).toISOString(), now: new Date(started).toISOString() }));
  for (let cycle = 0; ; cycle += 1) {
    const before = Date.now();
    const result = await runCollector(env).catch((error) => console.error("collector failed", error));
    console.log(JSON.stringify({ loop: "cycle", cycle, before: new Date(before).toISOString(), after: new Date().toISOString(), result }));
    const next = started + (cycle + 1) * COLLECT_CYCLE_MS;
    if (next - started + 5_000 > COLLECT_BUDGET_MS) return;
    await new Promise((resolve) => setTimeout(resolve, Math.max(0, next - Date.now())));
  }
}

export default {
  fetch: app.fetch,

  async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    if (event.cron === "*/5 * * * *") {
      if (env.INGDOC_SYNC_ENABLED === "true") {
        ctx.waitUntil(syncFromIngdoc(env).catch((error) => console.error("ingdoc sync failed", error)));
      }
      return;
    }
    ctx.waitUntil(collectLoop(env, event.scheduledTime));
  },

  async queue(batch: MessageBatch<NotificationJob>, env: Env): Promise<void> {
    await handleNotificationBatch(batch, env);
  }
} satisfies ExportedHandler<Env, NotificationJob>;
