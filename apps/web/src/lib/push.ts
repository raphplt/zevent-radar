import type { NotificationPreference } from "@zevent-radar/contracts";
import { api } from "./api";
import { getInstallationId } from "./installation";

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  const buffer = new ArrayBuffer(raw.length);
  const out = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

export function pushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export async function getExistingSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

export async function subscribeToPush(): Promise<PushSubscription> {
  const { publicKey, enabled } = await api<{ enabled: boolean; publicKey: string | null }>("/api/push/vapid-public-key");
  if (!enabled || !publicKey) throw new Error("Les notifications ne sont pas activées côté serveur.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Permission refusée.");
  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const subscription = existing ?? (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) }));
  await api("/api/push/subscribe", { method: "POST", body: JSON.stringify({ installationId: getInstallationId(), subscription: subscription.toJSON() }) });
  return subscription;
}

export async function unsubscribeFromPush(): Promise<void> {
  const subscription = await getExistingSubscription();
  await api("/api/push/unsubscribe", { method: "POST", body: JSON.stringify({ installationId: getInstallationId(), endpoint: subscription?.endpoint }) });
  await subscription?.unsubscribe();
}

export async function syncPreferences(preferences: NotificationPreference[]): Promise<void> {
  await api("/api/push/preferences", { method: "PUT", body: JSON.stringify({ installationId: getInstallationId(), preferences }) });
}

export async function sendTestNotification(): Promise<void> {
  await api("/api/push/test", { method: "POST", body: JSON.stringify({ installationId: getInstallationId() }) });
}
