import { useSyncExternalStore } from "react";
import { batchModify, getOrCreateLabel } from "./gmail";

export const SNOOZE_LABEL = "Omni/Snoozed";

export interface SnoozedItem {
  id: string;
  subject: string;
  from: string;
  wakeAt: number;
}

const KEY = "omni-mail:snoozed";

function read(): SnoozedItem[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

let items: SnoozedItem[] = read();
const listeners = new Set<() => void>();
function emit() {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {}
  listeners.forEach((l) => l());
}

export const snoozeStore = {
  get: () => items,
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  remove: (id: string) => {
    items = items.filter((i) => i.id !== id);
    emit();
  },
};

export function useSnoozed() {
  return useSyncExternalStore(snoozeStore.subscribe, snoozeStore.get, () => [] as SnoozedItem[]);
}

/** Presets shown in the snooze menu. */
export const SNOOZE_PRESETS: { label: string; ms: () => number }[] = [
  { label: "In 1 hour", ms: () => Date.now() + 3_600_000 },
  { label: "Later today (3h)", ms: () => Date.now() + 3 * 3_600_000 },
  {
    label: "Tomorrow 9am",
    ms: () => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
      return d.getTime();
    },
  },
  {
    label: "Next week",
    ms: () => {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      d.setHours(9, 0, 0, 0);
      return d.getTime();
    },
  },
];

export async function snooze(msg: { id: string; subject: string; from: string }, wakeAt: number) {
  const label = await getOrCreateLabel(SNOOZE_LABEL);
  await batchModify([msg.id], [label.id], ["INBOX"]);
  items = [...items.filter((i) => i.id !== msg.id), { id: msg.id, subject: msg.subject, from: msg.from, wakeAt }];
  emit();
}

export async function unsnooze(id: string) {
  const label = await getOrCreateLabel(SNOOZE_LABEL);
  await batchModify([id], ["INBOX", "UNREAD"], [label.id]);
  snoozeStore.remove(id);
}

/** Background loop that returns snoozed mail to the inbox. */
export function startSnoozeWatcher(onWake?: (i: SnoozedItem) => void) {
  let stopped = false;
  const tick = async () => {
    if (stopped) return;
    const due = items.filter((i) => i.wakeAt <= Date.now());
    for (const i of due) {
      try {
        await unsnooze(i.id);
        onWake?.(i);
      } catch {
        snoozeStore.remove(i.id);
      }
    }
  };
  void tick();
  const iv = window.setInterval(tick, 30_000);
  return () => {
    stopped = true;
    window.clearInterval(iv);
  };
}
