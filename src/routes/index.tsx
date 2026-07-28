import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Inbox, Star, Send, Trash2, PenSquare, Sparkles, Settings, Archive,
  Search, Mail, ShieldAlert, FileText, RefreshCw, Zap, Filter, ArrowLeft,
  Reply, Loader2, Command as CmdIcon, Info, Folder, Plus, MessageSquare, X, Newspaper, ListChecks,
  Radar, BellOff, Clock, ChevronDown, Gauge, Languages, CalendarClock, Paperclip, Download,
  ShieldCheck, UserSearch, Sparkle,
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
  listLabels, createLabel, downloadAttachment, attachmentObjectUrl, type GmailLabel, type ParsedMessage,
} from "@/lib/gmail";
import { signIn, refreshSilently, loadGis } from "@/lib/gauth";
import { useSession, useSettings, sessionStore, settingsStore, getAiLabels, setAiLabel, type AiLabel, type SortBy } from "@/lib/store";
import { aiTriage, aiTriageBatch, aiSummarize, aiSmartReplies, aiDigest, aiExtractTasks, aiFollowUpRadar, aiUnsubscribeScout, aiPrioritySort, aiTranslate, aiToneRead, aiMeetingExtract, aiAttachmentBrief, aiSecurityCheck, aiSenderBrief, aiCleanupPlan } from "@/lib/ai";
import type { AssistantAction } from "@/lib/ai";
import { startScheduler, scheduleStore, useScheduled, type ScheduledMessage } from "@/lib/schedule";
import { printMessageAsPdf, printImageAsPdf, printTextAsPdf } from "@/lib/printpdf";
import { ThemeApplier } from "@/components/mail/ThemeApplier";
import { SettingsDrawer } from "@/components/mail/SettingsDrawer";
import { Compose, type ComposeInitial } from "@/components/mail/Compose";
import { CommandPalette, type Cmd } from "@/components/mail/CommandPalette";
import { AiAssistant } from "@/components/mail/AiAssistant";
import { Landing } from "@/components/mail/Landing";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Shreyas Mail — AI-native email" },
      { name: "description", content: "Ultra-sleek Apple-esque Gmail client with AI writer, smart triage, folders, and a chat assistant that acts on your inbox." },
      { property: "og:title", content: "Shreyas Mail — AI-native email" },
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
  const [aiBusy, setAiBusy] = useState<null | "summary" | "replies" | "digest" | "tasks" | "radar" | "scout" | "priority" | "translate" | "tone" | "meeting" | "files" | "security" | "sender" | "cleanup">(null);
  const [aiMenuOpen, setAiMenuOpen] = useState(false);
  const [readerAiOpen, setReaderAiOpen] = useState(false);
  const [summary, setSummary] = useState<string>("");
  const [smartReplies, setSmartReplies] = useState<string[]>([]);
  const [digest, setDigest] = useState<string>("");
  const [digestOpen, setDigestOpen] = useState(false);
  const [scan, setScan] = useState<{ title: string; text: string } | null>(null);
  const [queueOpen, setQueueOpen] = useState(false);
  const scheduled = useScheduled();
  const listRef = useRef<HTMLDivElement>(null);


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
      setUserLabels(all.filter((l) => l.type === "user"));
    } catch {}
  }, [session]);

  useEffect(() => { refreshLabels(); }, [refreshLabels]);

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

  const runSearch = () => {
    setActiveQuery(transformQuery(query));
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

  const doArchive = async (ids: string[]) => {
    if (!ids.length) return;
    try {
      await batchModify(ids, [], ["INBOX"]);
      setMessages((p) => p.filter((m) => !ids.includes(m.id)));
      setSelected(new Set()); setOpenId(null);
      toast.success(`Archived ${ids.length}`);
    } catch (e: any) { toast.error(e.message); }
  };
  const doTrash = async (ids: string[]) => {
    if (!ids.length) return;
    try {
      await Promise.all(ids.map((id) => trashMessage(id)));
      setMessages((p) => p.filter((m) => !ids.includes(m.id)));
      setSelected(new Set()); setOpenId(null);
      toast.success(`Moved to Trash: ${ids.length}`);
    } catch (e: any) { toast.error(e.message); }
  };
  const doStar = async (id: string, star: boolean) => {
    try {
      await modifyMessage(id, star ? ["STARRED"] : [], star ? [] : ["STARRED"]);
      setMessages((p) => p.map((m) => (m.id === id ? { ...m, starred: star, labelIds: star ? [...m.labelIds, "STARRED"] : m.labelIds.filter((l) => l !== "STARRED") } : m)));
    } catch (e: any) { toast.error(e.message); }
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
    return list;
  }, [messages, settings.sortBy]);

  // Keyboard shortcuts
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const inField = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setCmdOpen(true); return; }
      if (inField) return;
      const cur = viewMessages[cursorIndex];
      if (e.key === "j") { e.preventDefault(); setCursorIndex((i) => Math.min(viewMessages.length - 1, i + 1)); }
      else if (e.key === "k") { e.preventDefault(); setCursorIndex((i) => Math.max(0, i - 1)); }
      else if (e.key === "c") { e.preventDefault(); setComposeInitial(undefined); setComposeOpen(true); }
      else if (e.key === "/") { e.preventDefault(); document.getElementById("search-input")?.focus(); }
      else if (e.key === "Enter" && cur) { e.preventDefault(); openMessage(cur.id); }
      else if (e.key === "e" && cur) { e.preventDefault(); doArchive([cur.id]); }
      else if (e.key === "#" && cur) { e.preventDefault(); doTrash([cur.id]); }
      else if (e.key === "s" && cur) { e.preventDefault(); doStar(cur.id, !cur.starred); }
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
    { id: "cleanup", label: "Cleanup Plan", icon: Sparkle, run: runCleanupPlan, busy: aiBusy === "cleanup", badge: 0,
      info: "Turns the messages in view into a concrete plan: what to archive now, what to reply to today, and what to unsubscribe from." },
    { id: "queue", label: "Scheduled", icon: Clock, run: () => setQueueOpen(true), busy: false, badge: pendingScheduled,
      info: "Ask the assistant to \"send X an email in 10 minutes\" — Gemini drafts it and it goes out on time. Cancel any time here." },
  ];

  const READER_TOOLS = [
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
    { id: "pdf", label: "Save as PDF", icon: FileText, run: () => opened && printMessageAsPdf({ subject: opened.subject, from: opened.from, to: opened.to, date: opened.date, bodyHtml: opened.bodyHtml, bodyText: opened.bodyText }), busy: false,
      info: "Exports this email — headers and body — as a clean PDF via your browser's print dialog." },
  ];


  const commands: Cmd[] = useMemo(() => [
    { id: "compose", label: "Compose", icon: <PenSquare className="h-4 w-4" />, shortcut: "C", action: () => { setComposeInitial(undefined); setComposeOpen(true); }, group: "Actions" },
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
      <div className="relative h-screen w-screen overflow-hidden p-3 text-foreground">
        <div className="flex h-full w-full gap-3 overflow-hidden">
          {/* Sidebar */}
          <aside className="glass no-scrollbar flex w-64 shrink-0 flex-col overflow-y-auto rounded-2xl px-3 py-4 shadow-xl">
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
                  {session.profile.name || "Shreyas Mail"}
                </div>
                <div className="truncate text-[10px] text-muted-foreground">{session.profile.email}</div>
              </div>
            </div>

            <Button
              onClick={() => { setComposeInitial(undefined); setComposeOpen(true); }}
              className="mb-3 justify-start gap-2 rounded-xl"
            >
              <PenSquare className="h-4 w-4" /> Compose
            </Button>
            <nav className="space-y-0.5">
              {SYSTEM_FOLDERS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => { setFolder(f.id); setActiveQuery(""); setQuery(""); }}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
                    folder === f.id && !activeQuery ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                  }`}
                >
                  <f.icon className="h-4 w-4" /> {f.label}
                </button>
              ))}
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
              {foldersOpen && (
              <div className="no-scrollbar animate-drop max-h-40 space-y-0.5 overflow-y-auto">
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
              )}
            </div>

            <div className="mt-4 rounded-xl border border-border/60 bg-card/40 p-2">
              <button
                onClick={() => setAiMenuOpen((o) => !o)}
                className="press flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                <Sparkles className="h-3.5 w-3.5 text-primary" /> AI features
                <ChevronDown className={`ml-auto h-3.5 w-3.5 transition-transform duration-300 ${aiMenuOpen ? "rotate-180" : ""}`} />
              </button>

              {aiMenuOpen && (
                <div className="animate-drop stagger mt-2 space-y-1.5">
                  <Button
                    variant="default"
                    size="sm"
                    className="press w-full justify-start gap-2"
                    onClick={() => setAssistantOpen(true)}
                  >
                    <MessageSquare className="h-3.5 w-3.5" /> Chat Assistant
                  </Button>

                  {AI_TOOLS.map((t) => (
                    <div key={t.id} className="flex items-center gap-1">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="press flex-1 justify-start gap-2"
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
              )}
            </div>

            <div className="mt-auto pt-2 text-center text-[10px] text-muted-foreground/70">
              Press <span className="rounded border border-border px-1 font-mono">⌘K</span> for everything, including Settings
            </div>
          </aside>

          {/* List pane */}
          <section
            className={`glass-inbox flex flex-col overflow-hidden rounded-2xl shadow-xl transition-all duration-300 ${
              opened ? "w-[420px] shrink-0" : "flex-1"
            }`}
          >

            <header className="flex items-center gap-2 border-b border-border/50 px-4 py-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                id="search-input"
                placeholder="Search or type a date like 10/26/25…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runSearch()}
                className="h-8 border-0 bg-transparent p-0 focus-visible:ring-0"
              />
              {activeQuery && (
                <button onClick={() => { setQuery(""); setActiveQuery(""); }} title="Clear search" className="text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={load} aria-label="Refresh messages">
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </header>

            {activeQuery && (
              <div className="border-b border-border/50 bg-primary/5 px-4 py-1.5 text-[11px] text-muted-foreground">
                Filter: <span className="font-mono text-primary">{activeQuery}</span>
              </div>
            )}

            <div className="flex items-center gap-2 border-b border-border/50 px-3 py-2 text-xs">
              <Checkbox
                checked={selected.size > 0 && selected.size === messages.length}
                onCheckedChange={(v) => setSelected(v ? new Set(messages.map((m) => m.id)) : new Set())}
              />
              <span className="text-muted-foreground">{selected.size ? `${selected.size} selected` : `${messages.length} messages`}</span>
              <select
                aria-label="Sort messages"
                value={settings.sortBy}
                onChange={(e) => settingsStore.set({ sortBy: e.target.value as SortBy })}
                className="ml-2 rounded-md border border-border/60 bg-card/50 px-2 py-1 text-[11px] text-muted-foreground outline-none hover:text-foreground"
              >
                <option value="date">Newest first</option>
                <option value="sender">Sender A–Z</option>
                <option value="unread">Unread first</option>
              </select>
              <div className="ml-auto flex items-center gap-1">
                {selected.size > 0 && (
                  <>
                    <Button size="sm" variant="ghost" className="h-7 gap-1" onClick={() => doArchive(Array.from(selected))}>
                      <Archive className="h-3.5 w-3.5" /> Archive
                    </Button>
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

            <div ref={listRef} className="no-scrollbar flex-1 overflow-y-auto">
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
                    className={`animate-in-up group flex cursor-pointer gap-2 border-b border-border/40 px-3 py-3 transition ${
                      isOpen ? "bg-accent/60" : isCursor ? "bg-accent/30" : "hover:bg-accent/20"
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
                        <div className={`truncate text-sm ${m.unread ? "font-semibold" : "font-medium text-muted-foreground"}`}>
                          {m.from.split("<")[0].replace(/"/g, "").trim() || m.fromEmail}
                        </div>
                        {labelBadge(aiLabels[m.id])}
                        <div className="ml-auto shrink-0 text-[10px] text-muted-foreground">{relTime(m.date)}</div>
                      </div>
                      <div className={`mt-0.5 truncate text-sm ${m.unread ? "text-foreground" : "text-muted-foreground"}`}>
                        {m.subject || "(no subject)"}
                      </div>
                      <div className="truncate text-xs text-muted-foreground/80">{m.snippet}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Reader — only exists when a message is opened */}
          {opened && (
            <section className="glass-inbox no-scrollbar animate-in-up relative flex-1 overflow-y-auto rounded-2xl shadow-xl">
              <div className="mx-auto max-w-3xl px-8 py-8">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setOpenId(null)} aria-label="Back to message list"><ArrowLeft className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => doArchive([opened.id])}><Archive className="h-4 w-4" /> Archive</Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => doTrash([opened.id])}><Trash2 className="h-4 w-4" /> Trash</Button>
                  {folder === "TRASH" && (
                    <Button size="sm" variant="destructive" onClick={() => doPermanentDelete([opened.id])}>Delete forever</Button>
                  )}
                  <Button
                    size="sm"
                    variant="secondary"
                    className="ml-auto gap-1"
                    onClick={() => {
                      setComposeInitial({
                        to: opened.fromEmail,
                        subject: opened.subject.startsWith("Re:") ? opened.subject : `Re: ${opened.subject}`,
                        body: `\n\n\nOn ${new Date(opened.date).toLocaleString()}, ${opened.from} wrote:\n> ${opened.bodyText.split("\n").join("\n> ")}`,
                        threadId: opened.threadId,
                      });
                      setComposeOpen(true);
                    }}
                  >
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
                  {readerAiOpen && (
                    <div className="animate-drop stagger mt-2 grid gap-1.5 sm:grid-cols-2">
                      {READER_TOOLS.map((t) => (
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
                  )}
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
      <Compose open={composeOpen} onOpenChange={setComposeOpen} initial={composeInitial} />
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

