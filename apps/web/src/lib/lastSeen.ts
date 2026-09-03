import type { PublicEvent } from "@zevent-radar/contracts";
import { createLocalStore } from "./store";

const KEY = "zr:last-seen";

export const lastSeenStore = createLocalStore<string | null>(KEY, null, (raw) => (typeof raw === "string" ? raw : null));

export function missedEvents(events: PublicEvent[], favorites: string[], since: string | null): PublicEvent[] {
  if (!since) return [];
  const threshold = Date.parse(since);
  return events.filter((e) => favorites.includes(e.streamerId) && Date.parse(e.createdAt) > threshold && e.kind !== "live_started");
}

export function markSeen() {
  lastSeenStore.set(new Date().toISOString());
}
