import { useSyncExternalStore } from "react";

export interface Toast {
  id: number;
  message: string;
  action?: { label: string; onClick: () => void };
  durationMs: number;
}

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const timers = new Map<number, ReturnType<typeof setTimeout>>();

function emit() {
  listeners.forEach((l) => l());
}

export function dismissToast(id: number) {
  const timer = timers.get(id);
  if (timer) clearTimeout(timer);
  timers.delete(id);
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function showToast(message: string, options: { action?: Toast["action"]; durationMs?: number } = {}): number {
  const id = nextId++;
  const toast: Toast = { id, message, action: options.action, durationMs: options.durationMs ?? 5_000 };
  toasts = [...toasts.slice(-2), toast];
  emit();
  timers.set(id, setTimeout(() => dismissToast(id), toast.durationMs));
  return id;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const EMPTY: Toast[] = [];

export function useToasts(): Toast[] {
  return useSyncExternalStore(subscribe, () => toasts, () => EMPTY);
}
