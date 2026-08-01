import { useSyncExternalStore } from "react";

export type Theme =
  // dark
  | "mono" | "superhuman" | "oled" | "cyberpunk" | "forest" | "ocean"
  | "midnight" | "ember" | "aurora" | "grape" | "carbon" | "dusk"
  | "slate" | "royal" | "obsidian" | "moss" | "cocoa"
  // light
  | "nordic" | "paper" | "linen" | "mint" | "blossom" | "sand" | "sky"
  | "porcelain" | "peach" | "sage"
  // user-defined
  | "custom";

export const THEMES: { id: Theme; label: string; mode: "dark" | "light"; swatch: string[] }[] = [
  { id: "mono", label: "Mono Noir", mode: "dark", swatch: ["#0a0a0a", "#ffffff"] },
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
  { id: "slate", label: "Slate Steel", mode: "dark", swatch: ["#242832", "#6fb4e8"] },
  { id: "royal", label: "Royal Violet", mode: "dark", swatch: ["#1c1230", "#a97bf5"] },
  { id: "nordic", label: "Nordic", mode: "light", swatch: ["#f7f9fc", "#4c78c9"] },
  { id: "paper", label: "Paper & Ink", mode: "light", swatch: ["#f5f3ee", "#1c1c1c"] },
  { id: "linen", label: "Warm Linen", mode: "light", swatch: ["#faf7f1", "#b0764a"] },
  { id: "mint", label: "Fresh Mint", mode: "light", swatch: ["#f2fbf7", "#12a37a"] },
  { id: "blossom", label: "Blossom", mode: "light", swatch: ["#fdf5f8", "#d4638d"] },
  { id: "sand", label: "Soft Sand", mode: "light", swatch: ["#faf5ea", "#c07b3c"] },
  { id: "sky", label: "Clear Sky", mode: "light", swatch: ["#f4f8fd", "#3b82c4"] },
  { id: "obsidian", label: "Obsidian", mode: "dark", swatch: ["#0b1020", "#7aa2ff"] },
  { id: "moss", label: "Deep Moss", mode: "dark", swatch: ["#141a12", "#9bd67a"] },
  { id: "cocoa", label: "Cocoa", mode: "dark", swatch: ["#1a1310", "#e0a06a"] },
  { id: "porcelain", label: "Porcelain", mode: "light", swatch: ["#ffffff", "#111111"] },
  { id: "peach", label: "Peach Cream", mode: "light", swatch: ["#fff6f0", "#e07a4a"] },
  { id: "sage", label: "Sage Light", mode: "light", swatch: ["#f4f7f2", "#5c8a5c"] },
];

/** Ten built-in wallpapers. Users can still paste a URL or upload their own. */
export const WALLPAPERS: { id: string; label: string; url: string }[] = [
  { id: "aurora", label: "Aurora", url: "https://images.unsplash.com/photo-1483347756197-71ef80e95f73?auto=format&fit=crop&w=1920&q=70" },
  { id: "peaks", label: "Peaks", url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=1920&q=70" },
  { id: "dunes", label: "Dunes", url: "https://images.unsplash.com/photo-1509316785289-025f5b846b35?auto=format&fit=crop&w=1920&q=70" },
  { id: "forest", label: "Forest", url: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1920&q=70" },
  { id: "waves", label: "Waves", url: "https://images.unsplash.com/photo-1505118380757-91f5f5632de0?auto=format&fit=crop&w=1920&q=70" },
  { id: "city", label: "City Night", url: "https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=1920&q=70" },
  { id: "gradient", label: "Gradient", url: "https://images.unsplash.com/photo-1557682250-33bd709cbe85?auto=format&fit=crop&w=1920&q=70" },
  { id: "marble", label: "Marble", url: "https://images.unsplash.com/photo-1541701494587-cb58502866ab?auto=format&fit=crop&w=1920&q=70" },
  { id: "fog", label: "Fog", url: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=1920&q=70" },
  { id: "space", label: "Deep Space", url: "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=1920&q=70" },
];


export const DEFAULT_DARK: Theme = "mono";
export const DEFAULT_LIGHT: Theme = "porcelain";
export function themeMode(t: Theme): "dark" | "light" {
  if (t === "custom") return settingsStore?.get().customMode ?? "dark";
  return THEMES.find((x) => x.id === t)?.mode ?? "dark";
}

export interface Settings {
  clientId: string;
  geminiKey: string;
  theme: Theme;
  customBg: string;
  customFg: string;
  customPrimary: string;
  customMode: "dark" | "light";
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
  sortBy: SortBy;
  layout: LayoutId;
  /* Mail behaviour */
  signature: string;
  undoSendSeconds: number;
  autoAdvance: boolean;
  confirmBeforeSend: boolean;
  showUnreadCounts: boolean;
  previewLines: number;
  sendAndArchive: boolean;
}

export type SortBy = "date" | "sender" | "unread";

export type LayoutId = "comfortable" | "compact" | "focus" | "wide" | "stack";

export const LAYOUTS: { id: LayoutId; label: string; desc: string }[] = [
  { id: "comfortable", label: "Comfortable", desc: "Balanced three-pane layout with roomy rows." },
  { id: "compact", label: "Compact", desc: "Denser rows and a slimmer sidebar — more mail per screen." },
  { id: "focus", label: "Focus", desc: "Sidebar hidden. Just the list and the message." },
  { id: "wide", label: "Wide reader", desc: "Bigger sidebar and a wider list column." },
  { id: "stack", label: "Stacked", desc: "Opening a message takes over the full width." },
];


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
  theme: "mono",
  customBg: "#0b0b0c",
  customFg: "#f5f5f5",
  customPrimary: "#7c5cff",
  customMode: "dark",
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
  sortBy: "date",
  layout: "comfortable",
  signature: "",
  undoSendSeconds: 8,
  autoAdvance: true,
  confirmBeforeSend: false,
  showUnreadCounts: true,
  previewLines: 1,
  sendAndArchive: false,
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
