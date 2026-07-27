import { useSyncExternalStore } from "react";
import { sendMessage } from "./gmail";

export interface ScheduledMessage {
  id: string;
  to: string;
  subject: string;
  body: string;
  /** Natural-language intent used to draft the body with AI, if any. */
  intent?: string;
  sendAt: number;
  status: "pending" | "sent" | "failed" | "cancelled";
  error?: string;
  createdAt: number;
}

const KEY = "shreyas-mail:scheduled";

let state: ScheduledMessage[] = read();
const listeners = new Set<() => void>();

function read(): ScheduledMessage[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

function commit(next: ScheduledMessage[]) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {}
  listeners.forEach((l) => l());
}

export const scheduleStore = {
  get: () => state,
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  add: (m: Omit<ScheduledMessage, "id" | "status" | "createdAt">) => {
    const item: ScheduledMessage = {
      ...m,
      id: `sch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      status: "pending",
      createdAt: Date.now(),
    };
    commit([...state, item]);
    return item;
  },
  update: (id: string, patch: Partial<ScheduledMessage>) =>
    commit(state.map((x) => (x.id === id ? { ...x, ...patch } : x))),
  remove: (id: string) => commit(state.filter((x) => x.id !== id)),
  clearDone: () => commit(state.filter((x) => x.status === "pending")),
};

const EMPTY: ScheduledMessage[] = [];
export function useScheduled() {
  return useSyncExternalStore(scheduleStore.subscribe, scheduleStore.get, () => EMPTY);
}

/** Parses "in 10 minutes", "in 2 hours", "tomorrow at 9am", "at 5:30pm". Returns epoch ms or null. */
export function parseWhen(text: string, now = Date.now()): number | null {
  const t = text.toLowerCase();
  const rel = t.match(/\bin\s+(a|an|one|\d{1,4})\s*(second|sec|minute|min|hour|hr|day|week)s?\b/);
  if (rel) {
    const nRaw = rel[1];
    const n = /^\d+$/.test(nRaw) ? parseInt(nRaw, 10) : 1;
    const unit = rel[2];
    const mult = unit.startsWith("sec")
      ? 1000
      : unit.startsWith("min")
        ? 60_000
        : unit.startsWith("h")
          ? 3_600_000
          : unit.startsWith("d")
            ? 86_400_000
            : 604_800_000;
    return now + n * mult;
  }
  const at = t.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
  if (at) {
    const d = new Date(now);
    let h = parseInt(at[1], 10) % 12;
    if (at[3] === "pm") h += 12;
    d.setHours(h, at[2] ? parseInt(at[2], 10) : 0, 0, 0);
    if (/tomorrow/.test(t)) d.setDate(d.getDate() + 1);
    if (d.getTime() <= now) d.setDate(d.getDate() + 1);
    return d.getTime();
  }
  return null;
}

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

/** Starts the background scheduler loop. Safe to call multiple times. */
export function startScheduler(onSent?: (m: ScheduledMessage) => void) {
  if (timer) return () => {};
  const tick = async () => {
    if (running) return;
    const due = scheduleStore.get().filter((m) => m.status === "pending" && m.sendAt <= Date.now());
    if (!due.length) return;
    running = true;
    for (const m of due) {
      try {
        await sendMessage({ to: m.to, subject: m.subject, body: m.body });
        scheduleStore.update(m.id, { status: "sent" });
        onSent?.(m);
      } catch (e: any) {
        scheduleStore.update(m.id, { status: "failed", error: e?.message || "Send failed" });
      }
    }
    running = false;
  };
  timer = setInterval(tick, 15_000);
  void tick();
  return () => {
    if (timer) clearInterval(timer);
    timer = null;
  };
}
