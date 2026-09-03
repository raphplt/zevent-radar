import { createLocalStore } from "./store";

export const favoritesStore = createLocalStore<string[]>("zr:favorites", [], (raw) => (Array.isArray(raw) ? raw.filter((v) => typeof v === "string") : []));

export function toggleFavorite(id: string) {
  favoritesStore.set((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));
}

export function isFavorite(id: string) {
  return favoritesStore.get().includes(id);
}

export function setFavorites(ids: string[]) {
  favoritesStore.set(Array.from(new Set(ids)));
}

export function encodeShare(ids: string[]): string {
  return btoa(ids.join(",")).replace(/=+$/, "");
}

export function decodeShare(token: string): string[] {
  try {
    return atob(token)
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}
