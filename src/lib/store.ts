import { useSyncExternalStore } from "react";

export type Theme = "superhuman" | "nordic" | "oled" | "cyberpunk" | "forest" | "ocean";

export interface Settings {
  clientId: string;
  geminiKey: string;
  theme: Theme;
  wallpaperUrl: string;
  wallpaperOpacity: number; // 0-100 (opacity of the image itself; overlay uses inverse)
  wallpaperBlur: number; // px
  panelOpacity: number; // 0-100
  panelBlur: number; // px
}

export interface AuthSession {
  accessToken: string;
  expiresAt: number; // epoch ms
  scope: string;
  profile: {
    email: string;
    name: string;
    picture: string;
  };
}

const SETTINGS_KEY = "shreyas-mail:settings";
const SESSION_KEY = "shreyas-mail:session";

const defaultSettings: Settings = {
  clientId: "",
  geminiKey: "",
  theme: "superhuman",
  wallpaperUrl: "",
  wallpaperOpacity: 40,
  wallpaperBlur: 0,
  panelOpacity: 80,
  panelBlur: 24,
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
