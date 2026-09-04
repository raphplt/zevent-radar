import { createLocalStore } from "./store";
import { showToast } from "./toast";

export const favoritesStore = createLocalStore<string[]>("zr:favorites", [], (raw) => (Array.isArray(raw) ? raw.filter((v) => typeof v === "string") : []));

export function isFavorite(id: string) {
  return favoritesStore.get().includes(id);
}

export function setFavorites(ids: string[]) {
  favoritesStore.set(Array.from(new Set(ids)));
}

export function addFavorites(ids: string[]) {
  favoritesStore.set((prev) => Array.from(new Set([...prev, ...ids])));
}

export function removeFavorite(id: string) {
  favoritesStore.set((prev) => prev.filter((v) => v !== id));
}

/** Toggle a favorite. When removing, shows an undo toast that restores the previous position. */
export function toggleFavorite(id: string, displayName?: string) {
  const prev = favoritesStore.get();
  if (!prev.includes(id)) {
    addFavorites([id]);
    return;
  }
  removeFavorite(id);
  showToast(displayName ? `${displayName} retiré des favoris` : "Retiré des favoris", {
    action: { label: "Annuler", onClick: () => favoritesStore.set((current) => (current.includes(id) ? current : restoreAt(current, prev, id))) }
  });
}

function restoreAt(current: string[], previous: string[], id: string): string[] {
  const index = previous.indexOf(id);
  const next = [...current];
  next.splice(Math.min(index, next.length), 0, id);
  return next;
}

/** Share tokens are logins joined by commas, which stay short and readable in a URL. */
export function encodeShare(logins: string[]): string {
  return logins.map((l) => l.trim()).filter(Boolean).join(",");
}

/**
 * Decode a share token into raw identifiers (logins or streamer ids).
 * Accepts the current comma-separated format and the legacy base64 format.
 * Callers must resolve the tokens against the known streamer list.
 */
export function decodeShare(token: string): string[] {
  const plain = token
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  return Array.from(new Set([...plain, ...tryBase64(token)]));
}

function tryBase64(token: string): string[] {
  try {
    const decoded = atob(token);
    if (!/^[\w,]+$/.test(decoded)) return [];
    return decoded
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}
