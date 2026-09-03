import { buildPushPayload, type PushSubscription } from "@block65/webcrypto-web-push";
import type { Env } from "../env";

export interface PushTarget {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export type PushOutcome = "sent" | "gone" | "failed" | "disabled";

export async function sendPush(env: Env, target: PushTarget, payload: unknown, ttl = 600): Promise<PushOutcome> {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return "disabled";
  const subscription: PushSubscription = { endpoint: target.endpoint, expirationTime: null, keys: { p256dh: target.p256dh, auth: target.auth } };
  try {
    const request = await buildPushPayload(
      { data: JSON.stringify(payload), options: { ttl, urgency: "high" } },
      subscription,
      { subject: env.VAPID_SUBJECT, publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY }
    );
    const res = await fetch(target.endpoint, request);
    if (res.status === 404 || res.status === 410) return "gone";
    if (res.status >= 200 && res.status < 300) return "sent";
    return "failed";
  } catch {
    return "failed";
  }
}
