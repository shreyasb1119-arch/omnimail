import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { GlassSelect } from "@/components/ui/glass-select";
import { Input } from "@/components/ui/input";
import {
  Inbox, Star, Send, Trash2, PenSquare, Sparkles, Settings, Archive,
  Search, Mail, ShieldAlert, FileText, RefreshCw, Zap, Filter, ArrowLeft,
  Reply, Loader2, Command as CmdIcon, Info, Folder, Plus, MessageSquare, X, Newspaper, ListChecks,
  Radar, BellOff, Clock, ChevronDown, Gauge, Languages, CalendarClock, Paperclip, Download,
  ShieldCheck, UserSearch, Sparkle, Wand2, Crown, BarChart3,
  MailOpen, Printer, Forward, ReplyAll, VolumeX, Flag,

} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  batchDelete, batchModify, deleteMessage, emptyTrash,
  listMessages, batchGetMessages, modifyMessage, trashMessage,
  listLabels, createLabel, downloadAttachment, attachmentObjectUrl, markSpam, markImportant, muteThread,
  type GmailLabel, type ParsedMessage,
} from "@/lib/gmail";
import { startSettingsSync } from "@/lib/sync";
import { snooze, SNOOZE_PRESETS, SNOOZE_LABEL, useSnoozed, startSnoozeWatcher } from "@/lib/snooze";
import { signIn, refreshSilently, loadGis } from "@/lib/gauth";
import { useSession, useSettings, sessionStore, settingsStore, getAiLabels, setAiLabel, type AiLabel, type SortBy, type LayoutId } from "@/lib/store";
import { aiTriage, aiTriageBatch, aiSummarize, aiSmartReplies, aiDigest, aiExtractTasks, aiFollowUpRadar, aiUnsubscribeScout, aiPrioritySort, aiTranslate, aiToneRead, aiMeetingExtract, aiAttachmentBrief, aiSecurityCheck, aiSenderBrief, aiCleanupPlan, aiNaturalSearch, looksNaturalLanguage, aiReplyDraft, aiVipScan, aiInboxReport,
  aiCommitments, aiSpendScan, aiTravelBoard, aiDeadlineBoard, aiRelationshipPulse, aiSmartFolders,
  aiRuleBuilder, aiDailyPlan, aiDuplicateScan, aiThreadTimeline, aiExplainSimply, aiToneVariants,
  aiCounterProposal, aiPoliteDecline, aiCalendarDraft, aiExtractContacts,
  aiWaitingOnThem, aiWeeklyRecap, aiInboxRiskScan, aiOpportunityFinder,
  aiFactCheck, aiContractRisk, aiForwardBlurb, aiClarifyingQuestions,
  aiNewsletterDigest, aiBulkCategorize, aiResponseCoach, aiAttachmentIndex,
  aiChecklist, aiObjections, aiReplyInLanguage, aiSnoozePlan, aiDecisionBrief } from "@/lib/ai";
import type { AssistantAction } from "@/lib/ai";
import { startScheduler, scheduleStore, useScheduled, type ScheduledMessage } from "@/lib/schedule";
import { printMessageAsPdf, printImageAsPdf, printTextAsPdf } from "@/lib/printpdf";
import { ThemeApplier } from "@/components/mail/ThemeApplier";
import { SettingsDrawer } from "@/components/mail/SettingsDrawer";
import { Compose, type ComposeInitial } from "@/components/mail/Compose";
import { CommandPalette, type Cmd } from "@/components/mail/CommandPalette";
import { AiAssistant } from "@/components/mail/AiAssistant";
import { Landing } from "@/components/mail/Landing";

const LAYOUT_CONF: Record<string, { sidebar: string; list: string; row: string }> = {
  comfortable: { sidebar: "w-64", list: "w-[420px]", row: "py-3" },
  compact: { sidebar: "w-52", list: "w-[360px]", row: "py-1.5" },
  focus: { sidebar: "hidden", list: "w-[440px]", row: "py-3" },
  wide: { sidebar: "w-72", list: "w-[520px]", row: "py-3.5" },
  stack: { sidebar: "w-64", list: "w-full", row: "py-3" },
};


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Omni Mail — AI-native email" },
      { name: "description", content: "Ultra-sleek Apple-esque Gmail client with AI writer, smart triage, folders, and a chat assistant that acts on your inbox." },
      { property: "og:title", content: "Omni Mail — AI-native email" },
      { property: "og:description", content: "Ultra-sleek Apple-esque Gmail client with AI writer, smart triage, folders, and a chat assistant that acts on your inbox." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:url", content: "https://omnimail.lovable.app/" },
    ],
    links: [{ rel: "canonical", href: "https://omnimail.lovable.app/" }],
  }),
  component: App,
});

type Folder = string; // system label id or user label id
const SYSTEM_FOLDERS: { id: string; label: string; icon: any }[] = [
  { id: "INBOX", label: "Inbox", icon: Inbox },
  { id: "STARRED", label: "Starred", icon: Star },
  { id: "SENT", label: "Sent", icon: Send },
  { id: "DRAFT", label: "Drafts", icon: FileText },
  { id: "SPAM", label: "Spam", icon: ShieldAlert },
  { id: "TRASH", label: "Trash", icon: Trash2 },
];

function relTime(ms: number) {
  const d = Date.now() - ms;
  if (d < 60_000) return "now";
  if (d < 3_600_000) return `${Math.floor(d / 60_000)}m`;
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h`;
  const days = Math.floor(d / 86_400_000);
  if (days < 7) return `${days}d`;
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function labelBadge(l?: AiLabel) {
  if (!l) return null;
  const m = {
    high: { text: "High", cls: "bg-primary/15 text-primary border-primary/30" },
    low: { text: "Low", cls: "bg-muted text-muted-foreground border-border" },
    cold: { text: "Cold", cls: "bg-destructive/15 text-destructive border-destructive/30" },
  }[l];
  return <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${m.cls}`}>{m.text}</span>;
}

// Parse a single date token into Gmail's YYYY/MM/DD form.
function parseDateToken(tok: string): string | null {
  const t = tok.trim();
  const slash = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slash) {
    const [, mm, dd, yy] = slash;
    const year = yy.length === 2 ? `20${yy}` : yy;
    return `${year}/${mm.padStart(2, "0")}/${dd.padStart(2, "0")}`;
  }
  const iso = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const [, y, m, d] = iso;
    return `${y}/${m.padStart(2, "0")}/${d.padStart(2, "0")}`;
  }
  return null;
}

// Transform user queries:
//   10/26/25              → before:2025/10/26
//   10/26/25-10/26/24     → before:2025/10/26 after:2024/10/26
function transformQuery(raw: string): string {
  const q = raw.trim();
  if (!q) return "";

  const range = q.split(/\s*(?:-{1,2}|–|\bto\b)\s*/i).filter(Boolean);
  if (range.length === 2) {
    const a = parseDateToken(range[0]);
    const b = parseDateToken(range[1]);
    if (a && b) {
      const [newer, older] = a >= b ? [a, b] : [b, a];
      return `before:${newer} after:${older}`;
    }
  }

  const one = parseDateToken(q);
  if (one) return `before:${one}`;
  return q;
}


function App() {
  const session = useSession();
  const settings = useSettings();
  const [folder, setFolder] = useState<Folder>("INBOX");
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [messages, setMessages] = useState<ParsedMessage[]>([]);
  const [foldersOpen, setFoldersOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const [aiLabels, setAiLabels] = useState<Record<string, AiLabel>>({});
  const [userLabels, setUserLabels] = useState<GmailLabel[]>([]);
  const [labelCounts, setLabelCounts] = useState<Record<string, number>>({});
  const snoozed = useSnoozed();
  // Address-book suggestions built from everyone you've seen mail from.
  const contacts = useMemo(
    () => Array.from(new Set(messages.map((m) => m.fromEmail).filter((e) => e.includes("@")))).slice(0, 300),
    [messages],
  );
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeInitial, setComposeInitial] = useState<ComposeInitial | undefined>();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [triaging, setTriaging] = useState(false);
  const [purging, setPurging] = useState(false);
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const [cursorIndex, setCursorIndex] = useState(0);
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [islandHover, setIslandHover] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchExplain, setSearchExplain] = useState("");
  // Stays down only while the pointer is on it or you're actively typing in it.
  const islandShown = islandHover || searchFocused;
  const [oldestFirst, setOldestFirst] = useState(false);
  const [aiMenuOpen, setAiMenuOpen] = useState(false);
  const [readerAiOpen, setReaderAiOpen] = useState(false);
  const [openAiGroup, setOpenAiGroup] = useState<string | null>("Triage & cleanup");
  const [openReaderGroup, setOpenReaderGroup] = useState<string | null>("Understand");
  const [summary, setSummary] = useState<string>("");
  const [smartReplies, setSmartReplies] = useState<string[]>([]);
  const [digest, setDigest] = useState<string>("");
  const [digestOpen, setDigestOpen] = useState(false);
  const [scan, setScan] = useState<{ title: string; text: string } | null>(null);
  const [queueOpen, setQueueOpen] = useState(false);
  const scheduled = useScheduled();
  const listRef = useRef<HTMLDivElement>(null);
  const islandRef = useRef<HTMLDivElement>(null);
  const islandCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const layout = (settings.layout || "comfortable") as LayoutId;
  const L = LAYOUT_CONF[layout];


  useEffect(() => {
    (async () => {
      if (session) return;
      const raw = localStorage.getItem("shreyas-mail:session");
      if (!raw || !settings.clientId) return;
      await loadGis();
      const r = await refreshSilently();
      if (!r) sessionStore.replace(null);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.clientId]);

  // Stay signed in "forever": proactive silent refresh + refresh on tab focus.
  useEffect(() => {
    if (!session || !settings.clientId) return;
    const renew = async () => {
      const s = sessionStore.get();
      if (!s) return;
      if (Date.now() > s.expiresAt - 10 * 60 * 1000) await refreshSilently();
    };
    const iv = window.setInterval(renew, 5 * 60 * 1000);
    const onVis = () => { if (document.visibilityState === "visible") void renew(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("online", onVis);
    return () => {
      window.clearInterval(iv);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("online", onVis);
    };
  }, [session, settings.clientId]);

  // Background scheduled-send loop.
  useEffect(() => {
    if (!session) return;
    return startScheduler((m) => toast.success(`Scheduled email sent to ${m.to}`));
  }, [session]);


  useEffect(() => setAiLabels(getAiLabels()), []);
  useEffect(() => { setSummary(""); setSmartReplies([]); }, [openId]);


  const refreshLabels = useCallback(async () => {
    if (!session) return;
    try {
      const all = await listLabels();
      setUserLabels(all.filter((l) => l.type === "user" && l.name !== SNOOZE_LABEL));
      const counts: Record<string, number> = {};
      for (const l of all) if (l.messagesUnread) counts[l.id] = l.messagesUnread;
      setLabelCounts(counts);
    } catch {}
  }, [session]);

  useEffect(() => { refreshLabels(); }, [refreshLabels]);

  // Bring snoozed mail back to the inbox when its timer is up.
  useEffect(() => {
    if (!session) return;
    return startSnoozeWatcher((i) => toast.info(`Snoozed email is back: ${i.subject || "(no subject)"}`));
  }, [session]);

  // Keep settings in sync across browsers and devices for this Google account.
  useEffect(() => {
    if (!session) return;
    return startSettingsSync();
  }, [session?.profile.email]);




  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setSelected(new Set());
    setOpenId(null);
    try {
      const q = activeQuery;
      const page = await listMessages({
        labelIds: q ? undefined : [folder],
        q: q || undefined,
        maxResults: 40,
      });
      const ids = (page.messages || []).map((m) => m.id);
      const msgs = await batchGetMessages(ids);
      msgs.sort((a, b) => b.date - a.date);
      setMessages(msgs);
      setCursorIndex(0);
    } catch (e: any) {
      toast.error(e.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [session, folder, activeQuery]);

  useEffect(() => { if (session) load(); }, [session, folder, activeQuery, load]);

  /** Smart search: auto-detects whether you're searching or talking to the AI. */
  const runSearch = async (forceAi = false) => {
    const q = query.trim();
    if (!q) { setActiveQuery(""); setSearchExplain(""); return; }
    if (!forceAi && !looksNaturalLanguage(q)) {
      setSearchExplain("");
      setActiveQuery(transformQuery(q));
      return;
    }
    setSearching(true);
    try {
      const r = await aiNaturalSearch(q, userLabels.map((l) => l.name));
      setSearchExplain(r.explain || "AI search");
      if (r.sort === "oldest") settingsStore.set({ sortBy: "date" });
      else if (r.sort === "sender") settingsStore.set({ sortBy: "sender" });
      setOldestFirst(r.sort === "oldest");
      setActiveQuery(r.query || transformQuery(q));
    } catch (e: any) {
      toast.error(e.message || "AI search failed");
      setActiveQuery(transformQuery(q));
    } finally {
      setSearching(false);
    }
  };


  const openMessage = useCallback(
    async (id: string) => {
      setOpenId(id);
      const m = messages.find((x) => x.id === id);
      if (m?.unread) {
        try {
          await modifyMessage(id, [], ["UNREAD"]);
          setMessages((prev) => prev.map((x) => (x.id === id ? { ...x, unread: false, labelIds: x.labelIds.filter((l) => l !== "UNREAD") } : x)));
        } catch {}
      }
    },
    [messages],
  );

  // After removing messages, jump to the next one instead of dumping you back in the list.
  const advanceAfter = (ids: string[]) => {
    if (!openId || !ids.includes(openId)) return;
    if (!settings.autoAdvance) { setOpenId(null); return; }
    const rest = viewMessages.filter((m) => !ids.includes(m.id));
    const idx = viewMessages.findIndex((m) => m.id === openId);
    const next = rest[Math.min(idx, rest.length - 1)];
    setOpenId(next ? next.id : null);
  };

  const doArchive = async (ids: string[]) => {
    if (!ids.length) return;
    try {
      await batchModify(ids, [], ["INBOX"]);
      advanceAfter(ids);
      setMessages((p) => p.filter((m) => !ids.includes(m.id)));
      setSelected(new Set());
      toast.success(`Archived ${ids.length}`);
    } catch (e: any) { toast.error(e.message); }
  };
  const doTrash = async (ids: string[]) => {
    if (!ids.length) return;
    try {
      await Promise.all(ids.map((id) => trashMessage(id)));
      advanceAfter(ids);
      setMessages((p) => p.filter((m) => !ids.includes(m.id)));
      setSelected(new Set());
      toast.success(`Moved to Trash: ${ids.length}`);
    } catch (e: any) { toast.error(e.message); }
  };
  const doStar = async (id: string, star: boolean) => {
    try {
      await modifyMessage(id, star ? ["STARRED"] : [], star ? [] : ["STARRED"]);
      setMessages((p) => p.map((m) => (m.id === id ? { ...m, starred: star, labelIds: star ? [...m.labelIds, "STARRED"] : m.labelIds.filter((l) => l !== "STARRED") } : m)));
    } catch (e: any) { toast.error(e.message); }
  };

  /* ---- Gmail parity actions ---- */

  const doMarkRead = async (ids: string[], read: boolean) => {
    if (!ids.length) return;
    try {
      await batchModify(ids, read ? [] : ["UNREAD"], read ? ["UNREAD"] : []);
      setMessages((p) => p.map((m) => (ids.includes(m.id) ? { ...m, unread: !read } : m)));
      setSelected(new Set());
      toast.success(read ? `Marked ${ids.length} read` : `Marked ${ids.length} unread`);
    } catch (e: any) { toast.error(e.message); }
  };

  const doSpam = async (ids: string[], spam: boolean) => {
    if (!ids.length) return;
    try {
      await markSpam(ids, spam);
      advanceAfter(ids);
      setMessages((p) => p.filter((m) => !ids.includes(m.id)));
      setSelected(new Set());
      toast.success(spam ? `Reported ${ids.length} as spam` : `Restored ${ids.length} to inbox`);
    } catch (e: any) { toast.error(e.message); }
  };

  const doImportant = async (ids: string[], important: boolean) => {
    if (!ids.length) return;
    try {
      await markImportant(ids, important);
      toast.success(important ? "Marked important" : "Removed importance");
    } catch (e: any) { toast.error(e.message); }
  };

  const doMute = async (ids: string[]) => {
    if (!ids.length) return;
    try {
      await muteThread(ids);
      advanceAfter(ids);
      setMessages((p) => p.filter((m) => !ids.includes(m.id)));
      toast.success("Conversation muted");
    } catch (e: any) { toast.error(e.message); }
  };

  const doMoveToLabel = async (ids: string[], labelId: string) => {
    if (!ids.length) return;
    try {
      await batchModify(ids, [labelId], ["INBOX"]);
      advanceAfter(ids);
      setMessages((p) => p.filter((m) => !ids.includes(m.id)));
      setSelected(new Set());
      toast.success(`Moved ${ids.length}`);
    } catch (e: any) { toast.error(e.message); }
  };

  const doSnooze = async (ids: string[], wakeAt: number) => {
    if (!ids.length) return;
    try {
      for (const id of ids) {
        const m = messages.find((x) => x.id === id);
        if (m) await snooze({ id: m.id, subject: m.subject, from: m.from }, wakeAt);
      }
      advanceAfter(ids);
      setMessages((p) => p.filter((m) => !ids.includes(m.id)));
      setSelected(new Set());
      toast.success(`Snoozed until ${new Date(wakeAt).toLocaleString()}`);
    } catch (e: any) { toast.error(e.message || "Snooze failed"); }
  };

  const openReply = (m: ParsedMessage, all: boolean) => {
    const others = all
      ? m.to.split(",").map((s) => s.trim()).filter((s) => s && !s.includes(session?.profile.email || "@@")).join(", ")
      : "";
    setComposeInitial({
      to: m.fromEmail,
      cc: others || undefined,
      subject: m.subject.startsWith("Re:") ? m.subject : `Re: ${m.subject}`,
      body: `\n\n\nOn ${new Date(m.date).toLocaleString()}, ${m.from} wrote:\n> ${m.bodyText.split("\n").join("\n> ")}`,
      threadId: m.threadId,
    });
    setComposeOpen(true);
  };

  const openForward = (m: ParsedMessage) => {
    setComposeInitial({
      subject: m.subject.startsWith("Fwd:") ? m.subject : `Fwd: ${m.subject}`,
      body: `\n\n---------- Forwarded message ----------\nFrom: ${m.from}\nDate: ${new Date(m.date).toLocaleString()}\nSubject: ${m.subject}\nTo: ${m.to}\n\n${m.bodyText}`,
    });
    setComposeOpen(true);
  };

  const doPermanentDelete = async (ids: string[]) => {
    if (!ids.length) return;
    try {
      try { await batchDelete(ids); }
      catch { await Promise.all(ids.map((id) => deleteMessage(id).catch(() => null))); }
      setMessages((p) => p.filter((m) => !ids.includes(m.id)));
      setSelected(new Set()); setOpenId(null);
      toast.success(`Deleted ${ids.length}`);
    } catch (e: any) { toast.error(e.message); }
  };

  const doEmptyTrash = async () => {
    setPurging(true);
    try {
      const n = await emptyTrash();
      toast.success(`Purged ${n} items`);
      await load();
    } catch (e: any) { toast.error(e.message || "Failed"); }
    finally { setPurging(false); setConfirmEmpty(false); }
  };

  const runTriage = async () => {
    if (!messages.length) return;
    setTriaging(true);
    const targets = messages.slice(0, 25);
    try {
      const out: Record<string, AiLabel> = { ...aiLabels };
      for (const m of targets) {
        try {
          const l = await aiTriage(m.subject, m.from, m.snippet);
          out[m.id] = l;
          setAiLabel(m.id, l);
        } catch {}
      }
      setAiLabels(out);
      toast.success("Triage complete");
    } finally { setTriaging(false); }
  };

  const runAutoPurge = async () => {
    if (!messages.length) return;
    setPurging(true);
    try {
      const out: Record<string, AiLabel> = { ...aiLabels };
      const trashIds: string[] = [];
      for (const m of messages.slice(0, 25)) {
        let l = out[m.id];
        if (!l) {
          try {
            l = await aiTriage(m.subject, m.from, m.snippet);
            out[m.id] = l;
            setAiLabel(m.id, l);
          } catch {}
        }
        if (l === "cold" || (l === "low" && /promotion|unsubscribe|marketing|sale|offer/i.test(m.snippet + m.subject))) {
          trashIds.push(m.id);
        }
      }
      setAiLabels(out);
      if (trashIds.length) {
        await Promise.all(trashIds.map((id) => trashMessage(id).catch(() => null)));
        setMessages((p) => p.filter((m) => !trashIds.includes(m.id)));
        toast.success(`Purged ${trashIds.length} to Trash`);
      } else {
        toast.info("Nothing to purge");
      }
    } finally { setPurging(false); }
  };

  const executeAssistantActions = async (actions: AssistantAction[]) => {
    let ok = 0, failed = 0;
    const summary: string[] = [];
    const knownIds = new Set(messages.map((m) => m.id));

    for (const a of actions) {
      try {
        if ("ids" in a) {
          const ids = a.ids.filter((id) => knownIds.has(id));
          if (!ids.length) continue;
          switch (a.type) {
            case "star":
              await Promise.all(ids.map((id) => modifyMessage(id, ["STARRED"], [])));
              setMessages((p) => p.map((m) => ids.includes(m.id) ? { ...m, starred: true } : m));
              ok += ids.length; summary.push(`Starred ${ids.length}`); break;
            case "unstar":
              await Promise.all(ids.map((id) => modifyMessage(id, [], ["STARRED"])));
              setMessages((p) => p.map((m) => ids.includes(m.id) ? { ...m, starred: false } : m));
              ok += ids.length; summary.push(`Unstarred ${ids.length}`); break;
            case "archive":
              await batchModify(ids, [], ["INBOX"]);
              setMessages((p) => p.filter((m) => !ids.includes(m.id)));
              ok += ids.length; summary.push(`Archived ${ids.length}`); break;
            case "trash":
              await Promise.all(ids.map((id) => trashMessage(id)));
              setMessages((p) => p.filter((m) => !ids.includes(m.id)));
              ok += ids.length; summary.push(`Trashed ${ids.length}`); break;
            case "markRead":
              await batchModify(ids, [], ["UNREAD"]);
              setMessages((p) => p.map((m) => ids.includes(m.id) ? { ...m, unread: false } : m));
              ok += ids.length; summary.push(`Marked ${ids.length} read`); break;
            case "markUnread":
              await batchModify(ids, ["UNREAD"], []);
              setMessages((p) => p.map((m) => ids.includes(m.id) ? { ...m, unread: true } : m));
              ok += ids.length; summary.push(`Marked ${ids.length} unread`); break;
            case "label": {
              let lbl = userLabels.find((l) => l.name.toLowerCase() === a.labelName.toLowerCase());
              if (!lbl) { lbl = await createLabel(a.labelName); await refreshLabels(); }
              await batchModify(ids, [lbl.id], []);
              ok += ids.length; summary.push(`Labeled ${ids.length} "${a.labelName}"`); break;
            }
          }
        } else if (a.type === "search") {
          setQuery(a.query); setActiveQuery(a.query);
          ok++; summary.push(`Searched: ${a.query}`);
        } else if (a.type === "compose") {
          setComposeInitial({ to: a.to, subject: a.subject, body: a.body });
          setComposeOpen(true);
          ok++; summary.push(`Opened compose to ${a.to}`);
        } else if (a.type === "schedule") {
          const sendAt = Date.now() + Math.max(5_000, Number(a.delayMs) || 0);
          scheduleStore.add({ to: a.to, subject: a.subject, body: a.body, sendAt });
          ok++; summary.push(`Scheduled to ${a.to} (${a.when || new Date(sendAt).toLocaleTimeString()})`);
        }
      } catch (e: any) {
        failed++; summary.push(`✗ ${a.type} failed`);
      }
    }
    return {
      ok, failed,
      summary: summary.length ? `✓ ${summary.join(" · ")}` : "Nothing to do.",
    };
  };

  const senderName = (m: ParsedMessage) =>
    (m.from.split("<")[0].replace(/"/g, "").trim() || m.fromEmail).toLowerCase();

  const viewMessages = useMemo(() => {
    const list = [...messages];
    if (settings.sortBy === "sender") list.sort((a, b) => senderName(a).localeCompare(senderName(b)));
    else if (settings.sortBy === "unread") list.sort((a, b) => Number(b.unread) - Number(a.unread));
    else if (oldestFirst) list.sort((a, b) => a.date - b.date);
    return list;
  }, [messages, settings.sortBy, oldestFirst]);


  // Dynamic island — precise pointer tracking with hysteresis so it does not
  // flicker when you move fast or slip a few pixels off the pill.
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const cancelClose = () => {
        if (islandCloseTimer.current) { clearTimeout(islandCloseTimer.current); islandCloseTimer.current = null; }
      };
      const r = islandRef.current?.getBoundingClientRect();
      const open = islandRef.current?.classList.contains("is-open");
      if (!open) {
        // Trigger zone: top strip, centred horizontally, generous but not full width.
        const cx = window.innerWidth / 2;
        if (e.clientY <= 16 && Math.abs(e.clientX - cx) <= Math.max(220, window.innerWidth * 0.4)) {
          cancelClose();
          setIslandHover(true);
        }
        return;
      }
      if (!r) return;
      const pad = 56; // forgiving hit area around the island
      const inside =
        e.clientX >= r.left - pad && e.clientX <= r.right + pad &&
        e.clientY >= r.top - pad - 24 && e.clientY <= r.bottom + pad;
      if (inside) { cancelClose(); return; }
      if (islandCloseTimer.current) return;
      islandCloseTimer.current = setTimeout(() => {
        islandCloseTimer.current = null;
        setIslandHover(false);
        if (!document.activeElement || document.activeElement.id !== "search-input") setSearchOpen(false);
      }, 220);
    };
    const onLeave = () => {
      if (islandCloseTimer.current) clearTimeout(islandCloseTimer.current);
      islandCloseTimer.current = setTimeout(() => { islandCloseTimer.current = null; setIslandHover(false); }, 260);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      if (islandCloseTimer.current) clearTimeout(islandCloseTimer.current);
    };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const inField = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setCmdOpen(true); return; }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        setComposeInitial(undefined);
        setComposeOpen(true);
        return;
      }
      if (inField) return;
      const cur = viewMessages[cursorIndex];
      if (e.key === "j") { e.preventDefault(); setCursorIndex((i) => Math.min(viewMessages.length - 1, i + 1)); }
      else if (e.key === "k") { e.preventDefault(); setCursorIndex((i) => Math.max(0, i - 1)); }
      else if (e.key === "/") { e.preventDefault(); setIslandHover(true); setSearchFocused(true); setSearchOpen(true); setTimeout(() => document.getElementById("search-input")?.focus(), 60); }
      else if (e.key === "Enter" && cur) { e.preventDefault(); openMessage(cur.id); }
      else if (e.key === "e" && cur) { e.preventDefault(); doArchive([cur.id]); }
      else if (e.key === "#" && cur) { e.preventDefault(); doTrash([cur.id]); }
      else if (e.key === "s" && cur) { e.preventDefault(); doStar(cur.id, !cur.starred); }
      else if (e.key === "u") { e.preventDefault(); setOpenId(null); }
      else if (e.key === "U" && cur) { e.preventDefault(); doMarkRead([cur.id], false); }
      else if (e.key === "I" && cur) { e.preventDefault(); doMarkRead([cur.id], true); }
      else if (e.key === "!" && cur) { e.preventDefault(); doSpam([cur.id], true); }
      else if (e.key === "b" && cur) { e.preventDefault(); void doSnooze([cur.id], SNOOZE_PRESETS[2].ms()); }
      else if (e.key === "r" && cur) { e.preventDefault(); openReply(cur, false); }
      else if (e.key === "a" && cur) { e.preventDefault(); openReply(cur, true); }
      else if (e.key === "f" && cur) { e.preventDefault(); openForward(cur); }
      else if (e.key === "p" && cur) { e.preventDefault(); window.print(); }
      else if (e.key === "x" && cur) {
        e.preventDefault();
        setSelected((prev) => { const n = new Set(prev); n.has(cur.id) ? n.delete(cur.id) : n.add(cur.id); return n; });
      }

    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [viewMessages, cursorIndex, openMessage]);

  const opened = messages.find((m) => m.id === openId) || null;
  const avatarSrc = settings.avatarUrl || session?.profile.picture || "";

  // ---- Extra AI features ----
  const runSummarize = async () => {
    if (!opened) return;
    setAiBusy("summary");
    try {
      const text = await aiSummarize(opened.subject, opened.from, opened.bodyText || opened.snippet);
      setSummary(text);
    } catch (e: any) { toast.error(e.message || "Summary failed"); }
    finally { setAiBusy(null); }
  };

  const runSmartReplies = async () => {
    if (!opened) return;
    setAiBusy("replies");
    try {
      const r = await aiSmartReplies(opened.subject, opened.from, opened.bodyText || opened.snippet);
      setSmartReplies(r);
    } catch (e: any) { toast.error(e.message || "Smart replies failed"); }
    finally { setAiBusy(null); }
  };

  const runDigest = async () => {
    if (!messages.length) return;
    setAiBusy("digest");
    try {
      const text = await aiDigest(
        messages.slice(0, 25).map((m) => ({ from: m.from, subject: m.subject, snippet: m.snippet })),
      );
      setDigest(text);
      setDigestOpen(true);
    } catch (e: any) { toast.error(e.message || "Digest failed"); }
    finally { setAiBusy(null); }
  };

  const runTasks = async () => {
    if (!opened) return;
    setAiBusy("tasks");
    try {
      const text = await aiExtractTasks(opened.subject, opened.from, opened.bodyText || opened.snippet);
      setScan({ title: "Action items", text });
    } catch (e: any) { toast.error(e.message || "Extraction failed"); }
    finally { setAiBusy(null); }
  };

  const runRadar = async () => {
    if (!messages.length) return;
    setAiBusy("radar");
    try {
      const text = await aiFollowUpRadar(
        messages.slice(0, 40).map((m) => ({ from: m.from, subject: m.subject, snippet: m.snippet })),
      );
      setScan({ title: "Follow-up Radar", text });
    } catch (e: any) { toast.error(e.message || "Radar failed"); }
    finally { setAiBusy(null); }
  };

  const runScout = async () => {
    if (!messages.length) return;
    setAiBusy("scout");
    try {
      const text = await aiUnsubscribeScout(
        messages.slice(0, 60).map((m) => ({ from: m.from, subject: m.subject, snippet: m.snippet })),
      );
      setScan({ title: "Unsubscribe Scout", text });
    } catch (e: any) { toast.error(e.message || "Scout failed"); }
    finally { setAiBusy(null); }
  };

  const runPriority = async () => {
    if (!messages.length) return;
    setAiBusy("priority");
    try {
      const text = await aiPrioritySort(
        messages.slice(0, 30).map((m) => ({ from: m.from, subject: m.subject, snippet: m.snippet })),
      );
      setScan({ title: "Priority Sort", text });
    } catch (e: any) { toast.error(e.message || "Priority sort failed"); }
    finally { setAiBusy(null); }
  };

  const runTranslate = async () => {
    if (!opened) return;
    setAiBusy("translate");
    try {
      const text = await aiTranslate(opened.subject, opened.bodyText || opened.snippet, settings.translateTo || "English");
      setScan({ title: `Translated to ${settings.translateTo || "English"}`, text });
    } catch (e: any) { toast.error(e.message || "Translation failed"); }
    finally { setAiBusy(null); }
  };

  const runTone = async () => {
    if (!opened) return;
    setAiBusy("tone");
    try {
      const text = await aiToneRead(opened.subject, opened.from, opened.bodyText || opened.snippet);
      setScan({ title: "Tone & intent", text });
    } catch (e: any) { toast.error(e.message || "Tone read failed"); }
    finally { setAiBusy(null); }
  };

  const runMeeting = async () => {
    if (!opened) return;
    setAiBusy("meeting");
    try {
      const text = await aiMeetingExtract(opened.subject, opened.from, opened.bodyText || opened.snippet);
      setScan({ title: "Meeting details", text });
    } catch (e: any) { toast.error(e.message || "Meeting extract failed"); }
    finally { setAiBusy(null); }
  };

  const runAttachmentBrief = async () => {
    if (!opened || !opened.attachments.length) { toast.error("No attachments on this email"); return; }
    setAiBusy("files");
    try {
      const text = await aiAttachmentBrief(opened.subject, opened.from, opened.attachments);
      setScan({ title: "Attachment brief", text });
    } catch (e: any) { toast.error(e.message || "Attachment brief failed"); }
    finally { setAiBusy(null); }
  };

  const runSecurityCheck = async () => {
    if (!opened) return;
    setAiBusy("security");
    try {
      const text = await aiSecurityCheck(opened.subject, opened.from, opened.bodyText || opened.snippet);
      setScan({ title: "Security check", text });
    } catch (e: any) { toast.error(e.message || "Security check failed"); }
    finally { setAiBusy(null); }
  };

  const runSenderBrief = async () => {
    if (!opened) return;
    setAiBusy("sender");
    try {
      const fromSame = messages.filter((m) => m.fromEmail === opened.fromEmail);
      const text = await aiSenderBrief(opened.from, fromSame.map((m) => ({ subject: m.subject, snippet: m.snippet })));
      setScan({ title: `About ${opened.fromEmail}`, text });
    } catch (e: any) { toast.error(e.message || "Sender brief failed"); }
    finally { setAiBusy(null); }
  };

  const runCleanupPlan = async () => {
    if (!messages.length) return;
    setAiBusy("cleanup");
    try {
      const text = await aiCleanupPlan(
        messages.slice(0, 40).map((m) => ({ from: m.from, subject: m.subject, snippet: m.snippet })),
      );
      setScan({ title: "Inbox cleanup plan", text });
    } catch (e: any) { toast.error(e.message || "Cleanup plan failed"); }
    finally { setAiBusy(null); }
  };

  const runVip = async () => {
    if (!messages.length) return;
    setAiBusy("vip");
    try {
      const text = await aiVipScan(messages.slice(0, 40).map((m) => ({ from: m.from, subject: m.subject, snippet: m.snippet })));
      setScan({ title: "VIP radar", text });
    } catch (e: any) { toast.error(e.message || "VIP radar failed"); }
    finally { setAiBusy(null); }
  };

  const runReport = async () => {
    if (!messages.length) return;
    setAiBusy("report");
    try {
      const text = await aiInboxReport(messages.slice(0, 40).map((m) => ({ from: m.from, subject: m.subject, snippet: m.snippet })));
      setScan({ title: "Inbox report", text });
    } catch (e: any) { toast.error(e.message || "Inbox report failed"); }
    finally { setAiBusy(null); }
  };

  const runReplyDraft = async () => {
    if (!opened) return;
    setAiBusy("reply");
    try {
      const body = await aiReplyDraft(opened.subject, opened.from, opened.bodyText || opened.snippet);
      setComposeInitial({ to: opened.fromEmail, subject: `Re: ${opened.subject}`, body });
      setComposeOpen(true);
    } catch (e: any) { toast.error(e.message || "Reply draft failed"); }
    finally { setAiBusy(null); }
  };

  /* --- Extra AI runners (inbox-level) --- */
  const runInboxTool = async (
    id: string,
    title: string,
    fn: (items: { from: string; subject: string; snippet: string }[]) => Promise<string>,
  ) => {
    if (!messages.length) return;
    setAiBusy(id);
    try {
      const text = await fn(messages.slice(0, 40).map((m) => ({ from: m.from, subject: m.subject, snippet: m.snippet })));
      setScan({ title, text });
    } catch (e: any) { toast.error(e.message || `${title} failed`); }
    finally { setAiBusy(null); }
  };

  /* --- Extra AI runners (open message) --- */
  const runReaderTool = async (
    id: string,
    title: string,
    fn: (subject: string, from: string, body: string) => Promise<string>,
  ) => {
    if (!opened) return;
    setAiBusy(id);
    try {
      const text = await fn(opened.subject, opened.from, opened.bodyText || opened.snippet);
      setScan({ title, text });
    } catch (e: any) { toast.error(e.message || `${title} failed`); }
    finally { setAiBusy(null); }
  };

  const pendingScheduled = scheduled.filter((s) => s.status === "pending").length;


  const AI_TOOLS = [
    { id: "triage", label: "Smart Triage", icon: Filter, run: runTriage, busy: triaging, badge: 0,
      info: "Scans your loaded messages in one batched call and tags each High, Low or Cold so you can spot what actually needs attention." },
    { id: "purge", label: "Auto-Purge", icon: Zap, run: runAutoPurge, busy: purging, badge: 0,
      info: "Uses AI triage to identify cold outreach and promotional junk in view, then moves them to Trash. Nothing is permanently deleted." },
    { id: "priority", label: "Priority Sort", icon: Gauge, run: runPriority, busy: aiBusy === "priority", badge: 0,
      info: "Ranks the messages in view by what you should handle first, with a one-line reason for each." },
    { id: "digest", label: "Daily Digest", icon: Newspaper, run: runDigest, busy: aiBusy === "digest", badge: 0,
      info: "Reads the messages currently in view and writes a short brief — what's urgent, what can wait, grouped by theme." },
    { id: "radar", label: "Follow-up Radar", icon: Radar, run: runRadar, busy: aiBusy === "radar", badge: 0,
      info: "Surfaces only the threads still waiting on your reply, most urgent first." },
    { id: "scout", label: "Unsubscribe Scout", icon: BellOff, run: runScout, busy: aiBusy === "scout", badge: 0,
      info: "Groups newsletters and automated senders, counts how much space they take, and tells you which to drop." },
    { id: "vip", label: "VIP Radar", icon: Crown, run: runVip, busy: aiBusy === "vip", badge: 0,
      info: "Separates the real humans who matter — clients, colleagues, money — from the automated noise in view." },
    { id: "report", label: "Inbox Report", icon: BarChart3, run: runReport, busy: aiBusy === "report", badge: 0,
      info: "An analytics-style read on your loaded mail: volume, top senders, recurring themes and time sinks." },
    { id: "cleanup", label: "Cleanup Plan", icon: Sparkle, run: runCleanupPlan, busy: aiBusy === "cleanup", badge: 0,
      info: "Turns the messages in view into a concrete plan: what to archive now, what to reply to today, and what to unsubscribe from." },
    { id: "commitments", label: "Commitment Tracker", icon: ListChecks, run: () => runInboxTool("commitments", "Commitment tracker", aiCommitments), busy: aiBusy === "commitments", badge: 0,
      info: "Finds everything you promised someone across the mail in view, with who's waiting and by when." },
    { id: "spend", label: "Spend Scan", icon: BarChart3, run: () => runInboxTool("spend", "Spend scan", aiSpendScan), busy: aiBusy === "spend", badge: 0,
      info: "Pulls receipts, invoices, subscriptions and renewals out of your inbox so you can see what you're paying for." },
    { id: "travel", label: "Travel Board", icon: CalendarClock, run: () => runInboxTool("travel", "Travel board", aiTravelBoard), busy: aiBusy === "travel", badge: 0,
      info: "Builds a chronological itinerary from flight, hotel and booking confirmations, with confirmation codes." },
    { id: "deadlines", label: "Deadline Board", icon: Clock, run: () => runInboxTool("deadlines", "Deadline board", aiDeadlineBoard), busy: aiBusy === "deadlines", badge: 0,
      info: "Every date, due date and event mentioned anywhere in your loaded mail, sorted by when it lands." },
    { id: "pulse", label: "Relationship Pulse", icon: Crown, run: () => runInboxTool("pulse", "Relationship pulse", aiRelationshipPulse), busy: aiBusy === "pulse", badge: 0,
      info: "Shows which contacts are warm and which are going cold because you never replied." },
    { id: "folders", label: "Smart Folders", icon: Plus, run: () => runInboxTool("folders", "Suggested folders", aiSmartFolders), busy: aiBusy === "folders", badge: 0,
      info: "Suggests the 4-6 folders that would actually fit your mail, with what belongs in each." },
    { id: "rules", label: "Rule Builder", icon: Filter, run: () => runInboxTool("rules", "Suggested rules", aiRuleBuilder), busy: aiBusy === "rules", badge: 0,
      info: "Writes safe auto-rules — IF from:x THEN archive — that would quietly cut the noise for good." },
    { id: "plan", label: "Daily Plan", icon: Gauge, run: () => runInboxTool("plan", "Daily plan", aiDailyPlan), busy: aiBusy === "plan", badge: 0,
      info: "Turns the inbox into a time-blocked plan for today, highest-leverage work first." },
    { id: "dupes", label: "Duplicate Scan", icon: Sparkle, run: () => runInboxTool("dupes", "Duplicate scan", aiDuplicateScan), busy: aiBusy === "dupes", badge: 0,
      info: "Clusters resends and repeated notification chains and tells you which single copy to keep." },
    { id: "queue", label: "Scheduled", icon: Clock, run: () => setQueueOpen(true), busy: false, badge: pendingScheduled,
      info: "Ask the assistant to \"send X an email in 10 minutes\" — Gemini drafts it and it goes out on time. Cancel any time here." },
    { id: "waiting", label: "Waiting On Them", icon: Clock, run: () => runInboxTool("waiting", "Waiting on them", aiWaitingOnThem), busy: aiBusy === "waiting", badge: 0,
      info: "The mirror of Follow-up Radar: threads where you already replied and someone else still owes you an answer." },
    { id: "recap", label: "Weekly Recap", icon: Newspaper, run: () => runInboxTool("recap", "Weekly recap", aiWeeklyRecap), busy: aiBusy === "recap", badge: 0,
      info: "A week-in-review of your mail: what moved, what stalled, and the three things to carry into next week." },
    { id: "riskscan", label: "Inbox Risk Scan", icon: ShieldCheck, run: () => runInboxTool("riskscan", "Inbox risk scan", aiInboxRiskScan), busy: aiBusy === "riskscan", badge: 0,
      info: "Sweeps every loaded message for phishing, spoofed senders and invoice fraud instead of checking one email at a time." },
    { id: "opps", label: "Opportunity Finder", icon: Crown, run: () => runInboxTool("opps", "Opportunity finder", aiOpportunityFinder), busy: aiBusy === "opps", badge: 0,
      info: "Digs out warm intros, deals, partnerships and invitations buried in the noise, with the one move to make on each." },
    { id: "newsdigest", label: "Newsletter Digest", icon: Newspaper, run: () => runInboxTool("newsdigest", "Newsletter digest", aiNewsletterDigest), busy: aiBusy === "newsdigest", badge: 0,
      info: "Merges every newsletter and automated update in view into one short read, and names the senders you can skip." },
    { id: "categorize", label: "Bulk Categorize", icon: Filter, run: () => runInboxTool("categorize", "Bulk categorize", aiBulkCategorize), busy: aiBusy === "categorize", badge: 0,
      info: "Tags each message in view as Work, Money, Travel, Personal, Newsletter, Promo, Notification or Spam so filing is one pass." },
    { id: "responsecoach", label: "Response Coach", icon: Gauge, run: () => runInboxTool("responsecoach", "Response coach", aiResponseCoach), busy: aiBusy === "responsecoach", badge: 0,
      info: "Shows who has been waiting longest, which threads are going stale, and the three replies to send today." },
    { id: "fileindex", label: "Attachment Index", icon: Paperclip, run: () => runInboxTool("fileindex", "Attachment index", aiAttachmentIndex), busy: aiBusy === "fileindex", badge: 0,
      info: "Indexes the documents, invoices and contracts that arrived in view, with what each is for and whether to keep it." },
    { id: "snooze", label: "Snooze Plan", icon: Clock, run: () => runInboxTool("snooze", "Snooze plan", aiSnoozePlan), busy: aiBusy === "snooze", badge: 0,
      info: "Decides what can leave the inbox now and exactly when it should come back, so only today's mail stays in front of you." },
  ];



  const READER_TOOLS = [
    { id: "replydraft", label: "Draft full reply", icon: Wand2, run: runReplyDraft, busy: aiBusy === "reply",
      info: "Writes a complete, ready-to-send reply that answers every question in the email, then opens it in Compose." },
    { id: "summary", label: "Summarize", icon: ListChecks, run: runSummarize, busy: aiBusy === "summary",
      info: "Condenses this email into 3 bullets plus the single action it asks of you." },
    { id: "replies", label: "Smart replies", icon: MessageSquare, run: runSmartReplies, busy: aiBusy === "replies",
      info: "Generates 3 one-line replies. Click one to open Compose pre-filled with it." },
    { id: "tasks", label: "Action items", icon: ListChecks, run: runTasks, busy: aiBusy === "tasks",
      info: "Pulls every task, deadline and commitment out of this email into a dated checklist." },
    { id: "tone", label: "Tone read", icon: Gauge, run: runTone, busy: aiBusy === "tone",
      info: "Tells you the sender's real tone, how urgent it truly is, what they're actually asking, and what breaks if you ignore it." },
    { id: "meeting", label: "Meeting extract", icon: CalendarClock, run: runMeeting, busy: aiBusy === "meeting",
      info: "Finds any proposed call or event and lays it out calendar-ready: title, time, place, attendees and prep." },
    { id: "translate", label: "Translate", icon: Languages, run: runTranslate, busy: aiBusy === "translate",
      info: "Rewrites the subject and body in your language without leaving the thread." },
    { id: "files", label: "Attachment brief", icon: Paperclip, run: runAttachmentBrief, busy: aiBusy === "files",
      info: "Explains what the attached files are, which one actually matters, and the single action to take." },
    { id: "security", label: "Security check", icon: ShieldCheck, run: runSecurityCheck, busy: aiBusy === "security",
      info: "Checks this email for phishing, spoofing and invoice-fraud signals, then tells you exactly what to do." },
    { id: "sender", label: "Sender brief", icon: UserSearch, run: runSenderBrief, busy: aiBusy === "sender",
      info: "Profiles this sender from every loaded email they sent you: what they usually want and which threads are still open." },
    { id: "timeline", label: "Thread timeline", icon: Clock, run: () => runReaderTool("timeline", "Thread timeline", aiThreadTimeline), busy: aiBusy === "timeline",
      info: "Reconstructs who said what in this thread and ends with exactly what is waiting on you." },
    { id: "explain", label: "Explain simply", icon: Languages, run: () => runReaderTool("explain", "Explain simply", aiExplainSimply), busy: aiBusy === "explain",
      info: "Rewrites dense, legal or jargon-heavy mail into plain English, with the terms defined." },
    { id: "variants", label: "Reply in 3 tones", icon: MessageSquare, run: () => runReaderTool("variants", "Reply in 3 tones", aiToneVariants), busy: aiBusy === "variants",
      info: "Drafts the same reply warm, direct and firm so you can pick the register that fits." },
    { id: "counter", label: "Counter-proposal", icon: Gauge, run: () => runReaderTool("counter", "Counter-proposal", aiCounterProposal), busy: aiBusy === "counter",
      info: "Reads the ask, weighs both sides' leverage, and writes a ready-to-send counter." },
    { id: "decline", label: "Politely decline", icon: BellOff, run: () => runReaderTool("decline", "Politely decline", aiPoliteDecline), busy: aiBusy === "decline",
      info: "A warm, short, unambiguous no that keeps the relationship intact." },
    { id: "ics", label: "Calendar draft", icon: CalendarClock, run: () => runReaderTool("ics", "Calendar draft", aiCalendarDraft), busy: aiBusy === "ics",
      info: "Turns any event in the email into a calendar-ready .ics block you can paste into your calendar." },
    { id: "contacts", label: "Extract contacts", icon: UserSearch, run: () => runReaderTool("contacts", "Extracted contacts", aiExtractContacts), busy: aiBusy === "contacts",
      info: "Lifts every person, company, address, phone number, link and reference number out of the message." },
    { id: "pdf", label: "Save as PDF", icon: FileText, run: () => opened && printMessageAsPdf({ subject: opened.subject, from: opened.from, to: opened.to, date: opened.date, bodyHtml: opened.bodyHtml, bodyText: opened.bodyText }), busy: false,
      info: "Exports this email — headers and body — as a clean PDF via your browser's print dialog." },
    { id: "factcheck", label: "Fact check", icon: ShieldCheck, run: () => runReaderTool("factcheck", "Fact check", aiFactCheck), busy: aiBusy === "factcheck",
      info: "Lists every claim, number, date and promise in the email and flags which ones to verify before you act." },
    { id: "contract", label: "Terms risk review", icon: FileText, run: () => runReaderTool("contract", "Terms risk review", aiContractRisk), busy: aiBusy === "contract",
      info: "Reads the email for liability, indemnity, auto-renewal and payment traps, and suggests safer wording." },
    { id: "forward", label: "Forward note", icon: MessageSquare, run: () => runReaderTool("forward", "Forward note", aiForwardBlurb), busy: aiBusy === "forward",
      info: "Writes the two-line context blurb plus the ask, so forwarding this to a colleague takes one paste." },
    { id: "questions", label: "Questions to ask", icon: UserSearch, run: () => runReaderTool("questions", "Questions to ask", aiClarifyingQuestions), busy: aiBusy === "questions",
      info: "The 3-5 clarifying questions worth sending back before you commit, ordered by how much they unblock you." },
    { id: "checklist", label: "Action checklist", icon: ListChecks, run: () => runReaderTool("checklist", "Action checklist", aiChecklist), busy: aiBusy === "checklist",
      info: "Turns the email into up to six concrete steps, each with an owner and a due moment." },
    { id: "objections", label: "Anticipate objections", icon: ShieldAlert, run: () => runReaderTool("objections", "Anticipate objections", aiObjections), busy: aiBusy === "objections",
      info: "Predicts the pushback the sender will raise to your reply and gives you the answer to each." },
    { id: "decision", label: "Decision Brief", icon: Gauge, run: () => runReaderTool("decision", "Decision brief", aiDecisionBrief), busy: aiBusy === "decision",
      info: "Strips the email down to the decision it demands: TL;DR, the choice, the deadline, what breaks if you ignore it, and the move to make." },
    { id: "replylang", label: "Reply in their language", icon: Languages, run: () => runReaderTool("replylang", "Reply in their language", aiReplyInLanguage), busy: aiBusy === "replylang",
      info: "Detects the language the email was written in and drafts a natural reply in that same language." },
  ];

  // Sub-groups so the big AI menus stay scannable
  const INBOX_GROUPS: { name: string; ids: string[] }[] = [
    { name: "Triage & cleanup", ids: ["triage", "purge", "priority", "dupes", "scout", "cleanup"] },
    { name: "Daily briefings", ids: ["digest", "plan", "recap", "report", "newsdigest"] },
    { name: "People & follow-ups", ids: ["radar", "waiting", "vip", "pulse", "commitments", "opps", "responsecoach"] },
    { name: "Money, dates & travel", ids: ["spend", "deadlines", "travel", "queue"] },
    { name: "Organise & protect", ids: ["folders", "rules", "riskscan", "categorize", "fileindex", "snooze"] },
  ];
  const READER_GROUPS: { name: string; ids: string[] }[] = [
    { name: "Understand", ids: ["summary", "decision", "explain", "tone", "timeline", "translate"] },
    { name: "Reply", ids: ["replydraft", "replies", "variants", "counter", "decline", "forward", "questions", "objections", "replylang"] },
    { name: "Extract", ids: ["tasks", "meeting", "ics", "contacts", "files", "checklist"] },
    { name: "Verify & export", ids: ["security", "factcheck", "contract", "sender", "pdf"] },
  ];




  const commands: Cmd[] = useMemo(() => [
    { id: "compose", label: "Compose", icon: <PenSquare className="h-4 w-4" />, shortcut: "⌘S", action: () => { setComposeInitial(undefined); setComposeOpen(true); }, group: "Actions" },
    { id: "refresh", label: "Refresh", icon: <RefreshCw className="h-4 w-4" />, shortcut: "R", action: load, group: "Actions" },
    { id: "assistant", label: "Open AI Assistant", icon: <MessageSquare className="h-4 w-4" />, action: () => setAssistantOpen(true), group: "AI" },
    { id: "triage", label: "AI Smart Triage", icon: <Sparkles className="h-4 w-4" />, action: runTriage, group: "AI" },
    { id: "purge", label: "AI Auto-Purge Spam", icon: <Zap className="h-4 w-4" />, action: runAutoPurge, group: "AI" },
    { id: "digest", label: "AI Daily Digest", icon: <Newspaper className="h-4 w-4" />, action: runDigest, group: "AI" },
    { id: "radar", label: "AI Follow-up Radar", icon: <Radar className="h-4 w-4" />, action: runRadar, group: "AI" },
    { id: "scout", label: "AI Unsubscribe Scout", icon: <BellOff className="h-4 w-4" />, action: runScout, group: "AI" },
    { id: "tasks", label: "AI Action Items (open email)", icon: <ListChecks className="h-4 w-4" />, action: runTasks, group: "AI" },
    { id: "queue", label: "Scheduled sends", icon: <Clock className="h-4 w-4" />, action: () => setQueueOpen(true), group: "Actions" },


    { id: "newfolder", label: "New folder…", icon: <Plus className="h-4 w-4" />, action: () => setNewFolderOpen(true), group: "Actions" },
    { id: "settings", label: "Open Settings", icon: <Settings className="h-4 w-4" />, action: () => setSettingsOpen(true), group: "Actions" },
    ...SYSTEM_FOLDERS.map((f) => ({ id: `go-${f.id}`, label: `Go to ${f.label}`, icon: <f.icon className="h-4 w-4" />, action: () => { setFolder(f.id); setActiveQuery(""); setQuery(""); }, group: "Navigate" })),
  ], [load]);

  if (!session) return (
    <>
      <ThemeApplier />
      <Toaster position="top-right" richColors />
      <Landing onOpenSettings={() => setSettingsOpen(true)} />
      <SettingsDrawer open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );

  return (
    <TooltipProvider delayDuration={200}>
      <ThemeApplier />
      <Toaster position="top-right" richColors />
      <div className="relative flex h-screen w-screen flex-col overflow-hidden p-3 text-foreground">
        {/* Dynamic island — hidden until the pointer reaches the top edge */}
        <div className={`island-nub ${islandShown ? "is-hidden" : ""}`} aria-hidden="true" />
        <div
          ref={islandRef}
          className={`island-wrap ${islandShown ? "is-open" : ""}`}
          onPointerEnter={() => {
            if (islandCloseTimer.current) clearTimeout(islandCloseTimer.current);
            setIslandHover(true);
          }}
        >
          <div
            onClick={() => { if (!searchOpen) { setSearchOpen(true); setTimeout(() => document.getElementById("search-input")?.focus(), 60); } }}
            className={`glass-cmd search-shell flex items-center gap-2 rounded-full shadow-xl ring-1 ring-border/40 focus-within:ring-2 focus-within:ring-primary/40 ${searchOpen ? "w-full max-w-2xl scale-100 px-4 py-2" : "w-auto max-w-[220px] cursor-pointer px-3 py-1.5 hover:scale-[1.03] hover:ring-primary/40"}`}
          >

            {searching ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
            ) : looksNaturalLanguage(query) ? (
              <Sparkles className="h-4 w-4 shrink-0 text-primary" />
            ) : (
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            {!searchOpen && (
              <span className="search-hint whitespace-nowrap text-xs text-muted-foreground">Search or ask AI</span>
            )}
            {searchOpen && (
            <Input
              id="search-input"
              placeholder="Search, type 10/26/25, or ask — “find my oldest emails from Spotify”"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void runSearch(); }}
              className="search-field h-8 border-0 bg-transparent p-0 text-sm focus-visible:ring-0"
              aria-label="Search mail or ask the AI"
              onFocus={() => setSearchFocused(true)}
              onBlur={() => { setSearchFocused(false); if (!islandHover) setSearchOpen(false); }}
            />
            )}
            {query && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => void runSearch(true)}
                    aria-label="Ask AI to find these emails"
                    className="press rounded-full p-1 text-primary hover:bg-primary/10"
                  >
                    <Wand2 className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[220px] text-xs">
                  Force AI search — describe what you want and it builds the Gmail query for you.
                </TooltipContent>
              </Tooltip>
            )}
            {(activeQuery || query) && (
              <button
                onClick={() => { setQuery(""); setActiveQuery(""); setSearchExplain(""); setOldestFirst(false); }}
                aria-label="Clear search"
                className="press rounded-full p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            {searchOpen && <div className="mx-1 h-5 w-px bg-border/60" />}
            <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full" onClick={(e) => { e.stopPropagation(); load(); }} aria-label="Refresh messages">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        <div className="flex min-h-0 w-full flex-1 gap-3 overflow-hidden">


          {/* Sidebar */}
          {L.sidebar !== "hidden" && (
          <aside className={`glass no-scrollbar flex shrink-0 flex-col overflow-y-auto rounded-2xl px-3 py-4 shadow-xl ${L.sidebar}`}>
            <div className="mb-5 flex items-center gap-2.5 px-1">
              <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-primary to-primary/60 text-primary-foreground shadow-md">
                {avatarSrc ? (
                  <img src={avatarSrc} alt="Your avatar" className="h-full w-full object-cover" />
                ) : (
                  <Mail className="h-4 w-4" />
                )}
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold tracking-tight">
                  {session.profile.name || "Omni Mail"}
                </div>
                <div className="truncate text-[10px] text-muted-foreground">{session.profile.email}</div>
              </div>
            </div>

            <Button
              onClick={() => { setComposeInitial(undefined); setComposeOpen(true); }}
              className="hover-mag mb-3 justify-start gap-2 rounded-xl"
            >
              <PenSquare className="h-4 w-4" /> <span className="mag-text">Compose</span>
            </Button>
            <nav className="space-y-0.5">
              {SYSTEM_FOLDERS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => { setFolder(f.id); setActiveQuery(""); setQuery(""); }}
                  className={`hover-mag flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm ${
                    folder === f.id && !activeQuery ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                  }`}
                >
                  <f.icon className="h-4 w-4" /> <span className="mag-text">{f.label}</span>
                  {settings.showUnreadCounts && !!labelCounts[f.id] && (
                    <span className="ml-auto rounded-full bg-primary/15 px-1.5 text-[10px] font-semibold text-primary">
                      {labelCounts[f.id]}
                    </span>
                  )}
                </button>
              ))}
              <button
                onClick={() => { setFolder("INBOX"); setQuery(""); setActiveQuery(`label:${SNOOZE_LABEL}`); }}
                className={`hover-mag flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm ${
                  activeQuery.includes(SNOOZE_LABEL) ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                }`}
              >
                <Clock className="h-4 w-4" /> <span className="mag-text">Snoozed</span>
                {snoozed.length > 0 && (
                  <span className="ml-auto rounded-full bg-primary/15 px-1.5 text-[10px] font-semibold text-primary">{snoozed.length}</span>
                )}
              </button>

            </nav>

            {/* Folders (user labels) */}
            <div className="mt-4">
              <div className="mb-1 flex items-center justify-between px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <button
                  onClick={() => setFoldersOpen((o) => !o)}
                  className="press flex items-center gap-1 uppercase tracking-wider hover:text-foreground"
                >
                  Folders
                  <ChevronDown className={`h-3 w-3 transition-transform duration-300 ${foldersOpen ? "rotate-180" : ""}`} />
                  <span className="ml-1 normal-case tracking-normal text-muted-foreground/60">{userLabels.length}</span>
                </button>
                <button
                  onClick={() => setNewFolderOpen(true)}
                  className="rounded p-0.5 hover:text-foreground"
                  title="New folder"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
              <div className="collapsible" data-open={foldersOpen}>
                <div className="collapsible-inner">
                  <div className="no-scrollbar max-h-40 space-y-0.5 overflow-y-auto">
                    {userLabels.length === 0 && (
                      <div className="px-3 py-1 text-[11px] text-muted-foreground/70">No folders yet</div>
                    )}
                    {userLabels.map((l) => (
                      <button
                        key={l.id}
                        onClick={() => { setFolder(l.id); setActiveQuery(""); setQuery(""); }}
                        className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-1.5 text-xs transition ${
                          folder === l.id && !activeQuery ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                        }`}
                      >
                        <Folder className="h-3.5 w-3.5" /> <span className="truncate">{l.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-border/60 bg-card/40 p-2">
              <button
                onClick={() => setAiMenuOpen((o) => !o)}
                className="press flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                <Sparkles className="h-3.5 w-3.5 text-primary" /> AI features
                <ChevronDown className={`ml-auto h-3.5 w-3.5 transition-transform duration-300 ${aiMenuOpen ? "rotate-180" : ""}`} />
              </button>

              <div className="collapsible" data-open={aiMenuOpen}>
                <div className="collapsible-inner">
                  <div className="mt-2 space-y-1.5">
                    <Button
                      variant="default"
                      size="sm"
                      className="press hover-mag w-full justify-start gap-2"
                      onClick={() => setAssistantOpen(true)}
                    >
                      <MessageSquare className="h-3.5 w-3.5" /> Chat Assistant
                    </Button>

                    {INBOX_GROUPS.map((g) => {
                      const tools = AI_TOOLS.filter((t) => g.ids.includes(t.id));
                      if (!tools.length) return null;
                      const open = openAiGroup === g.name;
                      return (
                        <div key={g.name} className="rounded-lg border border-border/50 bg-background/30">
                          <button
                            onClick={() => setOpenAiGroup(open ? null : g.name)}
                            className="press hover-mag flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
                          >
                            {g.name}
                            <span className="ml-auto text-[10px] font-normal normal-case text-muted-foreground/60">{tools.length}</span>
                            <ChevronDown className={`h-3 w-3 transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
                          </button>
                          <div className="collapsible" data-open={open}>
                            <div className="collapsible-inner">
                              <div className="space-y-1.5 p-1.5 pt-0">
                                {tools.map((t) => (
                                  <div key={t.id} className="flex items-center gap-1">
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      className="press hover-mag flex-1 justify-start gap-2"
                                      onClick={t.run}
                                      disabled={t.busy}
                                    >
                                      {t.busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <t.icon className="h-3.5 w-3.5" />}
                                      {t.label}
                                      {t.badge ? (
                                        <span className="ml-auto rounded-full bg-primary/20 px-1.5 text-[10px] text-primary">{t.badge}</span>
                                      ) : null}
                                    </Button>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <button className="rounded p-1 text-muted-foreground hover:text-foreground"><Info className="h-3 w-3" /></button>
                                      </TooltipTrigger>
                                      <TooltipContent side="right" className="max-w-[220px] text-xs">{t.info}</TooltipContent>
                                    </Tooltip>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>


            <div className="mt-auto pt-2 text-center text-[10px] text-muted-foreground/70">
              Press <span className="rounded border border-border px-1 font-mono">⌘K</span> for everything ·{" "}
              <span className="rounded border border-border px-1 font-mono">⌘S</span> to compose
            </div>
          </aside>
          )}

          {/* List pane */}
          {!(layout === "stack" && opened) && (
          <section
            className={`glass-inbox flex flex-col overflow-hidden rounded-2xl shadow-xl transition-all duration-300 ${
              opened ? `${L.list} shrink-0` : "flex-1"
            }`}
          >

            {activeQuery && (
              <div className="animate-drop border-b border-border/50 bg-primary/5 px-4 py-1.5 text-[11px] text-muted-foreground">
                {searchExplain && <span className="mr-2 text-primary">✨ {searchExplain}</span>}
                Filter: <span className="font-mono text-primary">{activeQuery}</span>
                {oldestFirst && <span className="ml-2">· oldest first</span>}
              </div>
            )}


            <div className="flex items-center gap-2 border-b border-border/50 px-3 py-2 text-xs">
              <Checkbox
                checked={selected.size > 0 && selected.size === messages.length}
                onCheckedChange={(v) => setSelected(v ? new Set(messages.map((m) => m.id)) : new Set())}
              />
              <span className="text-muted-foreground">{selected.size ? `${selected.size} selected` : `${messages.length} messages`}</span>
              <GlassSelect
                aria-label="Sort messages"
                className="ml-2"
                value={settings.sortBy}
                onValueChange={(v) => settingsStore.set({ sortBy: v as SortBy })}
                options={[
                  { value: "date", label: "Newest first" },
                  { value: "sender", label: "Sender A–Z" },
                  { value: "unread", label: "Unread first" },
                ]}
              />
              <GlassSelect
                aria-label="Select messages"
                value=""
                placeholder="Select…"
                onValueChange={(v) => {
                  const pick = (fn: (m: ParsedMessage) => boolean) => setSelected(new Set(viewMessages.filter(fn).map((m) => m.id)));
                  if (v === "all") pick(() => true);
                  else if (v === "none") setSelected(new Set());
                  else if (v === "read") pick((m) => !m.unread);
                  else if (v === "unread") pick((m) => m.unread);
                  else if (v === "starred") pick((m) => m.starred);
                  else if (v === "attach") pick((m) => m.attachments.length > 0);
                }}
                options={[
                  { value: "all", label: "All" },
                  { value: "none", label: "None" },
                  { value: "read", label: "Read" },
                  { value: "unread", label: "Unread" },
                  { value: "starred", label: "Starred" },
                  { value: "attach", label: "With attachments" },
                ]}
              />
              <div className="ml-auto flex items-center gap-1">
                {selected.size > 0 && (
                  <>
                    <Button size="sm" variant="ghost" className="h-7 gap-1" onClick={() => doArchive(Array.from(selected))}>
                      <Archive className="h-3.5 w-3.5" /> Archive
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 gap-1" onClick={() => doMarkRead(Array.from(selected), true)}>
                      <MailOpen className="h-3.5 w-3.5" /> Read
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 gap-1" onClick={() => doMarkRead(Array.from(selected), false)}>
                      Unread
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 gap-1" onClick={() => doSpam(Array.from(selected), folder !== "SPAM")}>
                      <ShieldAlert className="h-3.5 w-3.5" /> {folder === "SPAM" ? "Not spam" : "Spam"}
                    </Button>
                    <GlassSelect
                      aria-label="Move selected to folder"
                      value=""
                      placeholder="Move to…"
                      onValueChange={(v) => { if (v) void doMoveToLabel(Array.from(selected), v); }}
                      options={userLabels.map((l) => ({ value: l.id, label: l.name }))}
                    />
                    <Button size="sm" variant="ghost" className="h-7 gap-1 text-destructive" onClick={() => doTrash(Array.from(selected))}>
                      <Trash2 className="h-3.5 w-3.5" /> Trash
                    </Button>
                  </>
                )}
                {folder === "TRASH" && (
                  <Button size="sm" variant="destructive" className="h-7 gap-1" onClick={() => setConfirmEmpty(true)} disabled={purging}>
                    {purging ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Empty Trash Now
                  </Button>
                )}
              </div>

            </div>

            <div ref={listRef} className="no-scrollbar flex-1 overflow-y-auto pt-1.5">
              {loading && !messages.length && (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" /> Loading…
                </div>
              )}
              {!loading && !messages.length && (
                <div className="p-10 text-center text-sm text-muted-foreground">Inbox zero. 🎉</div>
              )}
              {viewMessages.map((m, i) => {
                const isOpen = openId === m.id;
                const isCursor = i === cursorIndex;
                const isSel = selected.has(m.id);
                return (
                  <div
                    key={m.id}
                    onClick={() => { setCursorIndex(i); openMessage(m.id); }}
                    className={`animate-in-up hover-mag group mx-2 mb-1.5 flex cursor-pointer gap-2 rounded-xl border border-border/40 px-3 ${L.row} ${
                      isOpen ? "bg-accent/60" : isCursor ? "bg-accent/30" : "bg-card/20 hover:bg-accent/20"
                    }`}
                  >
                    <div className="flex flex-col items-center gap-2 pt-0.5">
                      <Checkbox
                        checked={isSel}
                        onClick={(e) => e.stopPropagation()}
                        onCheckedChange={(v) => {
                          setSelected((prev) => {
                            const n = new Set(prev);
                            v ? n.add(m.id) : n.delete(m.id);
                            return n;
                          });
                        }}
                      />
                      <button onClick={(e) => { e.stopPropagation(); doStar(m.id, !m.starred); }} aria-label={m.starred ? "Unstar message" : "Star message"} className="text-muted-foreground hover:text-primary">
                        <Star className={`h-3.5 w-3.5 ${m.starred ? "fill-primary text-primary" : ""}`} />
                      </button>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className={`mag-text truncate text-sm ${m.unread ? "font-semibold" : "font-medium text-muted-foreground"}`}>
                          {m.from.split("<")[0].replace(/"/g, "").trim() || m.fromEmail}
                        </div>
                        {labelBadge(aiLabels[m.id])}
                        <div className="ml-auto shrink-0 text-[10px] text-muted-foreground">{relTime(m.date)}</div>
                      </div>
                      <div className={`mag-text mt-0.5 truncate text-sm ${m.unread ? "text-foreground" : "text-muted-foreground"}`}>
                        {m.subject || "(no subject)"}
                      </div>
                      {settings.previewLines > 0 && (
                        <div
                          className="overflow-hidden text-xs text-muted-foreground/80"
                          style={{ display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: settings.previewLines }}
                        >
                          {m.snippet}
                        </div>
                      )}
                      {m.attachments.length > 0 && (
                        <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Paperclip className="h-3 w-3" /> {m.attachments.length}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
          )}

          {/* Reader — only exists when a message is opened */}
          {opened && (
            <section className="glass-inbox no-scrollbar animate-in-up relative flex-1 overflow-y-auto rounded-2xl shadow-xl">
              <div className="mx-auto max-w-3xl px-8 py-8">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setOpenId(null)} aria-label="Back to message list"><ArrowLeft className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => doArchive([opened.id])}><Archive className="h-4 w-4" /> Archive</Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => doTrash([opened.id])}><Trash2 className="h-4 w-4" /> Trash</Button>
                  <Button size="sm" variant="ghost" onClick={() => doMarkRead([opened.id], false)} title="Mark as unread (shift+U)"><MailOpen className="h-4 w-4" /> Unread</Button>
                  <Button size="sm" variant="ghost" onClick={() => doSpam([opened.id], folder !== "SPAM")}><ShieldAlert className="h-4 w-4" /> {folder === "SPAM" ? "Not spam" : "Spam"}</Button>
                  <Button size="sm" variant="ghost" onClick={() => window.print()} title="Print"><Printer className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => doImportant([opened.id], !opened.labelIds.includes("IMPORTANT"))} title="Toggle important"><Flag className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => doMute([opened.id])} title="Mute conversation"><VolumeX className="h-4 w-4" /></Button>
                  <GlassSelect
                    aria-label="Snooze this email"
                    value=""
                    placeholder="Snooze…"
                    onValueChange={(v) => { if (v) void doSnooze([opened.id], Number(v)); }}
                    options={SNOOZE_PRESETS.map((p) => ({ value: String(p.ms()), label: p.label }))}
                  />
                  <GlassSelect
                    aria-label="Move to folder"
                    value=""
                    placeholder="Move to…"
                    onValueChange={(v) => { if (v) void doMoveToLabel([opened.id], v); }}
                    options={userLabels.map((l) => ({ value: l.id, label: l.name }))}
                  />
                  {folder === "TRASH" && (
                    <Button size="sm" variant="destructive" onClick={() => doPermanentDelete([opened.id])}>Delete forever</Button>
                  )}
                  <Button size="sm" variant="ghost" className="ml-auto gap-1" onClick={() => openForward(opened)}>
                    <Forward className="h-4 w-4" /> Forward
                  </Button>
                  <Button size="sm" variant="ghost" className="gap-1" onClick={() => openReply(opened, true)}>
                    <ReplyAll className="h-4 w-4" /> Reply all
                  </Button>
                  <Button size="sm" variant="secondary" className="gap-1" onClick={() => openReply(opened, false)}>
                    <Reply className="h-4 w-4" /> Reply
                  </Button>
                </div>


                {/* AI toolbar — collapsed by default */}
                <div className="mb-5 rounded-xl border border-border/60 bg-card/40 p-2">
                  <button
                    onClick={() => setReaderAiOpen((o) => !o)}
                    className="press flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-primary"
                  >
                    <Sparkles className="h-3.5 w-3.5" /> AI tools for this email
                    <ChevronDown className={`ml-auto h-3.5 w-3.5 transition-transform duration-300 ${readerAiOpen ? "rotate-180" : ""}`} />
                  </button>
                  <div className="collapsible" data-open={readerAiOpen}>
                    <div className="collapsible-inner">
                      <div className="mt-2 space-y-1.5">
                        {READER_GROUPS.map((g) => {
                          const tools = READER_TOOLS.filter((t) => g.ids.includes(t.id));
                          if (!tools.length) return null;
                          const open = openReaderGroup === g.name;
                          return (
                            <div key={g.name} className="rounded-lg border border-border/50 bg-background/30">
                              <button
                                onClick={() => setOpenReaderGroup(open ? null : g.name)}
                                className="press hover-mag flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
                              >
                                {g.name}
                                <span className="ml-auto text-[10px] font-normal normal-case text-muted-foreground/60">{tools.length}</span>
                                <ChevronDown className={`h-3 w-3 transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
                              </button>
                              <div className="collapsible" data-open={open}>
                                <div className="collapsible-inner">
                                  <div className="grid gap-1.5 p-1.5 pt-0 sm:grid-cols-2">
                                    {tools.map((t) => (
                                      <div key={t.id} className="flex items-center gap-1">
                                        <Button size="sm" variant="secondary" className="press h-8 flex-1 justify-start gap-1.5 text-xs" onClick={t.run} disabled={t.busy}>
                                          {t.busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <t.icon className="h-3.5 w-3.5" />} {t.label}
                                        </Button>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <button className="rounded p-1 text-muted-foreground hover:text-foreground"><Info className="h-3 w-3" /></button>
                                          </TooltipTrigger>
                                          <TooltipContent className="max-w-[240px] text-xs">{t.info}</TooltipContent>
                                        </Tooltip>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                </div>



                {summary && (
                  <div className="mb-4 whitespace-pre-wrap rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm">
                    {summary}
                  </div>
                )}
                {smartReplies.length > 0 && (
                  <div className="mb-4 flex flex-wrap gap-2">
                    {smartReplies.map((r, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setComposeInitial({
                            to: opened.fromEmail,
                            subject: opened.subject.startsWith("Re:") ? opened.subject : `Re: ${opened.subject}`,
                            body: r,
                            threadId: opened.threadId,
                          });
                          setComposeOpen(true);
                        }}
                        className="rounded-full border border-border/60 bg-card/50 px-3 py-1.5 text-xs transition hover:border-primary hover:text-primary"
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                )}

                <h1 className="text-2xl font-semibold tracking-tight">{opened.subject || "(no subject)"}</h1>
                <div className="mt-2 flex items-center gap-3 text-sm text-muted-foreground">
                  <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                    {(opened.from[0] || "?").toUpperCase()}
                  </div>
                  <div>
                    <div className="text-foreground">{opened.from}</div>
                    <div className="text-xs">to {opened.to} · {new Date(opened.date).toLocaleString()}</div>
                  </div>
                  {labelBadge(aiLabels[opened.id])}
                </div>
                {opened.attachments.length > 0 && (
                  <div className="mt-5">
                    <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      <Paperclip className="h-3.5 w-3.5" /> {opened.attachments.length} attachment{opened.attachments.length === 1 ? "" : "s"}
                    </div>
                    <div className="stagger grid gap-2 sm:grid-cols-2">
                      {opened.attachments.map((a) => (
                        <div key={a.attachmentId} className="lift flex items-center gap-2 rounded-xl border border-border/60 bg-card/50 p-2.5">
                          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
                            <FileText className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-xs font-medium">{a.filename}</div>
                            <div className="text-[10px] text-muted-foreground">{(a.size / 1024).toFixed(0)} KB</div>
                          </div>
                          <button
                            title="Download"
                            className="press rounded p-1.5 text-muted-foreground hover:text-primary"
                            onClick={async () => {
                              try { await downloadAttachment(opened.id, a); } catch (e: any) { toast.error(e.message || "Download failed"); }
                            }}
                          >
                            <Download className="h-4 w-4" />
                          </button>
                          <button
                            title="Save as PDF"
                            className="press rounded p-1.5 text-muted-foreground hover:text-primary"
                            onClick={async () => {
                              try {
                                if (a.mimeType.startsWith("image/")) {
                                  const url = await attachmentObjectUrl(opened.id, a);
                                  printImageAsPdf(url, a.filename);
                                } else {
                                  printTextAsPdf(a.filename, `Attachment: ${a.filename}\nType: ${a.mimeType}\nSize: ${(a.size / 1024).toFixed(0)} KB\n\nFrom the email "${opened.subject}" by ${opened.from}.`);
                                }
                              } catch (e: any) { toast.error(e.message || "PDF export failed"); }
                            }}
                          >
                            <FileText className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-6 rounded-2xl border border-border/60 bg-card/40 p-6">
                  {opened.bodyHtml ? (
                    <div className="prose-mail text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: opened.bodyHtml }} />
                  ) : (
                    <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{opened.bodyText}</pre>
                  )}
                </div>
              </div>
            </section>
          )}

        </div>
      </div>

      <SettingsDrawer open={settingsOpen} onOpenChange={setSettingsOpen} />
      <Compose open={composeOpen} onOpenChange={setComposeOpen} initial={composeInitial} contacts={contacts} onSent={() => void load()} />
      <CommandPalette
        open={cmdOpen}
        onOpenChange={setCmdOpen}
        commands={commands}
        onSearch={(q) => { setQuery(q); setActiveQuery(transformQuery(q)); }}
      />
      <AiAssistant
        open={assistantOpen}
        onOpenChange={setAssistantOpen}
        messages={messages}
        labelNames={userLabels.map((l) => l.name)}
        onExecute={executeAssistantActions}
      />
      <AlertDialog open={confirmEmpty} onOpenChange={setConfirmEmpty}>
        <AlertDialogContent className="glass-strong">
          <AlertDialogHeader>
            <AlertDialogTitle>Empty Trash?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes every message in Trash. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doEmptyTrash} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Yes, empty Trash
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={digestOpen} onOpenChange={setDigestOpen}>
        <DialogContent className="glass-strong max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Newspaper className="h-4 w-4 text-primary" /> Daily Digest</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed">{digest}</div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!scan} onOpenChange={(o) => !o && setScan(null)}>
        <DialogContent className="glass-strong max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> {scan?.title}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed">{scan?.text}</div>
        </DialogContent>
      </Dialog>

      <Dialog open={queueOpen} onOpenChange={setQueueOpen}>
        <DialogContent className="glass-strong max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Clock className="h-4 w-4 text-primary" /> Scheduled sends</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-2 overflow-y-auto">
            {scheduled.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nothing scheduled. Ask the AI Assistant something like “email sam@acme.com about the deck in 10 minutes”.
              </p>
            )}
            {scheduled.slice().reverse().map((s: ScheduledMessage) => (
              <div key={s.id} className="rounded-xl border border-border/60 bg-card/40 p-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">{s.to}</span>
                  <span className="ml-auto text-muted-foreground">
                    {s.status === "pending" ? new Date(s.sendAt).toLocaleString() : s.status}
                  </span>
                </div>
                <div className="mt-1 font-medium">{s.subject}</div>
                <div className="mt-1 line-clamp-2 text-muted-foreground">{s.body}</div>
                {s.error && <div className="mt-1 text-destructive">{s.error}</div>}
                <div className="mt-2 flex gap-2">
                  {s.status === "pending" && (
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => scheduleStore.update(s.id, { status: "cancelled" })}>
                      Cancel
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={() => scheduleStore.remove(s.id)}>
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>



      <Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
        <DialogContent className="glass-strong max-w-md">
          <DialogHeader>
            <DialogTitle>New folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Input
              placeholder="Folder name (e.g. Follow up)"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">Creates a Gmail label. You can nest with "Parent/Child".</p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNewFolderOpen(false)}>Cancel</Button>
            <Button
              onClick={async () => {
                const name = newFolderName.trim();
                if (!name) return;
                try {
                  await createLabel(name);
                  await refreshLabels();
                  toast.success(`Folder "${name}" created`);
                  setNewFolderOpen(false);
                  setNewFolderName("");
                } catch (e: any) { toast.error(e.message || "Failed"); }
              }}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}

