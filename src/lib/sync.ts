import { useSyncExternalStore } from "react";
import { settingsStore, sessionStore, type Settings } from "./store";
import { pullSettings, pushSettings } from "./sync.functions";

/** Never leave the device: private keys stay local. */
const LOCAL_ONLY: (keyof Settings)[] = ["clientId", "geminiKey"];

export type SyncState = { status: "off" | "syncing" | "synced" | "error"; lastSync: number | null; message?: string };

let state: SyncState = { status: "off", lastSync: null };
const listeners = new Set<() => void>();
function setState(next: Partial<SyncState>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

export function useSyncState() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  );
}

function syncable(s: Settings) {
  const out: Record<string, unknown> = { ...s };
  LOCAL_ONLY.forEach((k) => delete out[k as string]);
  return out;
}

let pushTimer: ReturnType<typeof setTimeout> | null = null;
let applyingRemote = false;
let lastPushed = "";

async function push() {
  const sess = sessionStore.get();
  if (!sess) return;
  const payload = JSON.stringify(syncable(settingsStore.get()));
  if (payload === lastPushed) return;
  setState({ status: "syncing" });
  try {
    await pushSettings({ data: { accessToken: sess.accessToken, settingsJson: payload } });
    lastPushed = payload;
    setState({ status: "synced", lastSync: Date.now() });
  } catch (e: any) {
    setState({ status: "error", message: e?.message || "Sync failed" });
  }
}

/** Pull the cloud copy and apply it locally. */
export async function pullNow() {
  const sess = sessionStore.get();
  if (!sess) return;
  setState({ status: "syncing" });
  try {
    const r = await pullSettings({ data: { accessToken: sess.accessToken } });
    if (r.settingsJson) {
      applyingRemote = true;
      settingsStore.set(JSON.parse(r.settingsJson) as Partial<Settings>);
      applyingRemote = false;
      lastPushed = JSON.stringify(syncable(settingsStore.get()));
      setState({ status: "synced", lastSync: Date.now() });
    } else {
      // First device for this account — seed the cloud with what we have.
      await push();
    }
  } catch (e: any) {
    applyingRemote = false;
    setState({ status: "error", message: e?.message || "Sync failed" });
  }
}

export async function syncNow() {
  await push();
}

/** Call once the user is signed in. Returns a cleanup fn. */
export function startSettingsSync() {
  if (typeof window === "undefined") return () => {};
  void pullNow();
  const unsub = settingsStore.subscribe(() => {
    if (applyingRemote) return;
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(() => void push(), 1200);
  });
  const onFocus = () => void pullNow();
  window.addEventListener("focus", onFocus);
  return () => {
    unsub();
    window.removeEventListener("focus", onFocus);
    if (pushTimer) clearTimeout(pushTimer);
    setState({ status: "off" });
  };
}
