import { createLocalStore } from "./store";

export interface Settings {
  theme: "system" | "dark" | "light";
  reduceMotion: boolean;
  dataSaver: boolean;
  notifications: {
    approaching: boolean;
    reached: boolean;
    accomplished: boolean;
    live: boolean;
  };
}

const DEFAULTS: Settings = {
  theme: "system",
  reduceMotion: false,
  dataSaver: false,
  notifications: { approaching: true, reached: true, accomplished: true, live: false }
};

export const settingsStore = createLocalStore<Settings>("zr:settings", DEFAULTS, (raw) => ({ ...DEFAULTS, ...(raw as Partial<Settings>), notifications: { ...DEFAULTS.notifications, ...((raw as Partial<Settings>).notifications ?? {}) } }));

export function updateSettings(patch: Partial<Settings>) {
  settingsStore.set((prev) => ({ ...prev, ...patch }));
}

export function applyTheme(settings: Settings) {
  const root = document.documentElement;
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = settings.theme === "dark" || (settings.theme === "system" && prefersDark);
  root.classList.toggle("dark", dark);
  root.classList.toggle("reduce-motion", settings.reduceMotion);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", dark ? "#000000" : "#fafafa");
}
