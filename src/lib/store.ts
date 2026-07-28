import { useSyncExternalStore } from "react";

export type Theme =
  // dark
  | "superhuman" | "oled" | "cyberpunk" | "forest" | "ocean"
  | "midnight" | "ember" | "aurora" | "grape" | "carbon" | "dusk"
  // light
  | "nordic" | "paper" | "linen" | "mint" | "blossom";

export const THEMES: { id: Theme; label: string; mode: "dark" | "light"; swatch: string[] }[] = [
  { id: "superhuman", label: "Superhuman", mode: "dark", swatch: ["#1a1c26", "#e05a4a"] },
  { id: "oled", label: "OLED Midnight", mode: "dark", swatch: ["#000000", "#e2b83f"] },
  { id: "cyberpunk", label: "Cyberpunk", mode: "dark", swatch: ["#2a1543", "#f13ab4"] },
  { id: "forest", label: "Forest", mode: "dark", swatch: ["#1e2e26", "#5cb98a"] },
  { id: "ocean", label: "Ocean", mode: "dark", swatch: ["#152438", "#4aa4d6"] },
  { id: "midnight", label: "Midnight Indigo", mode: "dark", swatch: ["#0f1024", "#6d6cf5"] },
  { id: "ember", label: "Charcoal Ember", mode: "dark", swatch: ["#1b1917", "#f2743a"] },
  { id: "aurora", label: "Aurora", mode: "dark", swatch: ["#0e1a1e", "#4de3b0"] },
  { id: "grape", label: "Grape Soda", mode: "dark", swatch: ["#1d1330", "#b57cff"] },
  { id: "carbon", label: "Carbon Mono", mode: "dark", swatch: ["#131313", "#dcdcdc"] },
  { id: "dusk", label: "Desert Dusk", mode: "dark", swatch: ["#241a1d", "#ff9d7a"] },
  { id: "nordic", label: "Nordic", mode: "light", swatch: ["#f7f9fc", "#4c78c9"] },
  { id: "paper", label: "Paper & Ink", mode: "light", swatch: ["#f5f3ee", "#1c1c1c"] },
  { id: "linen", label: "Warm Linen", mode: "light", swatch: ["#faf7f1", "#b0764a"] },
  { id: "mint", label: "Fresh Mint", mode: "light", swatch: ["#f2fbf7", "#12a37a"] },
  { id: "blossom", label: "Blossom", mode: "light", swatch: ["#fdf5f8", "#d4638d"] },
];

export const DEFAULT_DARK: Theme = "superhuman";
export const DEFAULT_LIGHT: Theme = "nordic";
export function themeMode(t: Theme): "dark" | "light" {
  return THEMES.find((x) => x.id === t)?.mode ?? "dark";
}

export interface Settings {
  clientId: string;
  geminiKey: string;
  theme: Theme;
  avatarUrl: string;
  translateTo: string;
  wallpaperUrl: string;
  wallpaperOpacity: number;
  wallpaperBlur: number;
  panelOpacity: number;
  panelBlur: number;
  inboxOpacity: number;
  inboxBlur: number;
  cmdOpacity: number;
  cmdBlur: number;
}

export interface AuthSession {
  accessToken: string;
  expiresAt: number;
  scope: string;
  profile: { email: string; name: string; picture: string };
}

const SETTINGS_KEY = "shreyas-mail:settings";
const SESSION_KEY = "shreyas-mail:session";

const defaultSettings: Settings = {
  clientId: "",
  geminiKey: "",
  theme: "superhuman",
  avatarUrl: "",
  translateTo: "English",
  wallpaperUrl: "",
  wallpaperOpacity: 40,
  wallpaperBlur: 0,
  panelOpacity: 80,
  panelBlur: 24,
  inboxOpacity: 60,
  inboxBlur: 20,
  cmdOpacity: 70,
  cmdBlur: 28,
};


function readLS<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...JSON.parse(raw) } as T;
  } catch {
    return fallback;
  }
}

type Listener = () => void;
function createStore<T>(key: string, initial: T) {
  let state: T = readLS(key, initial);
  const listeners = new Set<Listener>();
  return {
    get: () => state,
    set: (patch: Partial<T> | T) => {
      state = { ...(state as object), ...(patch as object) } as T;
      try {
        localStorage.setItem(key, JSON.stringify(state));
      } catch {}
      listeners.forEach((l) => l());
    },
    replace: (next: T | null) => {
      if (next === null) {
        try {
          localStorage.removeItem(key);
        } catch {}
        state = initial;
      } else {
        state = next;
        try {
          localStorage.setItem(key, JSON.stringify(state));
        } catch {}
      }
      listeners.forEach((l) => l());
    },
    subscribe: (l: Listener) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}

export const settingsStore = createStore<Settings>(SETTINGS_KEY, defaultSettings);
export const sessionStore = createStore<AuthSession | null>(SESSION_KEY, null as AuthSession | null);

export function useSettings() {
  return useSyncExternalStore(
    settingsStore.subscribe,
    settingsStore.get,
    () => defaultSettings,
  );
}

export function useSession() {
  return useSyncExternalStore(
    sessionStore.subscribe,
    sessionStore.get,
    () => null,
  );
}

// AI category cache per message id
const AI_LABELS_KEY = "shreyas-mail:ai-labels";
export type AiLabel = "high" | "low" | "cold";
export function getAiLabels(): Record<string, AiLabel> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(AI_LABELS_KEY) || "{}");
  } catch {
    return {};
  }
}
export function setAiLabel(id: string, label: AiLabel) {
  const all = getAiLabels();
  all[id] = label;
  localStorage.setItem(AI_LABELS_KEY, JSON.stringify(all));
}
