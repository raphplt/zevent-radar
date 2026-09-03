import type { NotificationJob } from "@zevent-radar/contracts";
import { app } from "./api/app";
import { runCollector } from "./collector/run";
import type { Env } from "./env";
import { syncFromIngdoc } from "./goals/ingdoc-sync";
import { handleNotificationBatch } from "./notifications/consumer";

export default {
  fetch: app.fetch,

  async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    if (event.cron === "*/15 * * * *") {
      if (env.INGDOC_SYNC_ENABLED === "true") {
        ctx.waitUntil(syncFromIngdoc(env).catch((error) => console.error("ingdoc sync failed", error)));
      }
      return;
    }
    ctx.waitUntil(runCollector(env).catch((error) => console.error("collector failed", error)));
  },

  async queue(batch: MessageBatch<NotificationJob>, env: Env): Promise<void> {
    await handleNotificationBatch(batch, env);
  }
} satisfies ExportedHandler<Env, NotificationJob>;
