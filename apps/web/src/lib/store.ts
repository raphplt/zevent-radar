import { useSyncExternalStore } from "react";

export function createLocalStore<T>(key: string, initial: T, migrate?: (raw: unknown) => T) {
  const listeners = new Set<() => void>();
  let value: T = read();

  function read(): T {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return initial;
      const parsed = JSON.parse(raw) as unknown;
      return migrate ? migrate(parsed) : (parsed as T);
    } catch {
      return initial;
    }
  }

  function set(next: T | ((prev: T) => T)) {
    value = typeof next === "function" ? (next as (prev: T) => T)(value) : next;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      return;
    } finally {
      listeners.forEach((l) => l());
    }
  }

  function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function get() {
    return value;
  }

  function use(): T {
    return useSyncExternalStore(subscribe, get, () => initial);
  }

  if (typeof window !== "undefined") {
    window.addEventListener("storage", (event) => {
      if (event.key === key) {
        value = read();
        listeners.forEach((l) => l());
      }
    });
  }

  return { get, set, subscribe, use };
}
