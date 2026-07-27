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
  listLabels, createLabel, type GmailLabel, type ParsedMessage,
} from "@/lib/gmail";
import { signIn, refreshSilently, loadGis } from "@/lib/gauth";
import { useSession, useSettings, sessionStore, getAiLabels, setAiLabel, type AiLabel } from "@/lib/store";
import { aiTriage, aiSummarize, aiSmartReplies, aiDigest } from "@/lib/ai";
import type { AssistantAction } from "@/lib/ai";
import { ThemeApplier } from "@/components/mail/ThemeApplier";
import { SettingsDrawer } from "@/components/mail/SettingsDrawer";
import { Compose, type ComposeInitial } from "@/components/mail/Compose";
import { CommandPalette, type Cmd } from "@/components/mail/CommandPalette";
import { AiAssistant } from "@/components/mail/AiAssistant";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Shreyas Mail — AI-native email" },
      { name: "description", content: "Ultra-sleek Apple-esque Gmail client with AI writer, smart triage, folders, and a chat assistant that acts on your inbox." },
      { property: "og:title", content: "Shreyas Mail — AI-native email" },
      { property: "og:description", content: "Ultra-sleek Apple-esque Gmail client with AI writer, smart triage, folders, and a chat assistant that acts on your inbox." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
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
  const [aiBusy, setAiBusy] = useState<null | "summary" | "replies" | "digest">(null);
  const [summary, setSummary] = useState<string>("");
  const [smartReplies, setSmartReplies] = useState<string[]>([]);
  const [digest, setDigest] = useState<string>("");
  const [digestOpen, setDigestOpen] = useState(false);
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

  // Keyboard shortcuts
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const inField = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setCmdOpen(true); return; }
      if (inField) return;
      const cur = messages[cursorIndex];
      if (e.key === "j") { e.preventDefault(); setCursorIndex((i) => Math.min(messages.length - 1, i + 1)); }
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
  }, [messages, cursorIndex, openMessage]);

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


  const commands: Cmd[] = useMemo(() => [
    { id: "compose", label: "Compose", icon: <PenSquare className="h-4 w-4" />, shortcut: "C", action: () => { setComposeInitial(undefined); setComposeOpen(true); }, group: "Actions" },
    { id: "refresh", label: "Refresh", icon: <RefreshCw className="h-4 w-4" />, shortcut: "R", action: load, group: "Actions" },
    { id: "assistant", label: "Open AI Assistant", icon: <MessageSquare className="h-4 w-4" />, action: () => setAssistantOpen(true), group: "AI" },
    { id: "triage", label: "AI Smart Triage", icon: <Sparkles className="h-4 w-4" />, action: runTriage, group: "AI" },
    { id: "purge", label: "AI Auto-Purge Spam", icon: <Zap className="h-4 w-4" />, action: runAutoPurge, group: "AI" },
    { id: "digest", label: "AI Daily Digest", icon: <Newspaper className="h-4 w-4" />, action: runDigest, group: "AI" },

    { id: "newfolder", label: "New folder…", icon: <Plus className="h-4 w-4" />, action: () => setNewFolderOpen(true), group: "Actions" },
    { id: "settings", label: "Open Settings", icon: <Settings className="h-4 w-4" />, action: () => setSettingsOpen(true), group: "Actions" },
    ...SYSTEM_FOLDERS.map((f) => ({ id: `go-${f.id}`, label: `Go to ${f.label}`, icon: <f.icon className="h-4 w-4" />, action: () => { setFolder(f.id); setActiveQuery(""); setQuery(""); }, group: "Navigate" })),
  ], [load]);

  if (!session) return (
    <>
      <SignInScreen onOpenSettings={() => setSettingsOpen(true)} />
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
          <aside className="glass flex w-64 shrink-0 flex-col overflow-hidden rounded-2xl px-3 py-4 shadow-xl">
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
                <span>Folders</span>
                <button
                  onClick={() => setNewFolderOpen(true)}
                  className="rounded p-0.5 hover:text-foreground"
                  title="New folder"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
              <div className="max-h-40 space-y-0.5 overflow-y-auto">
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

            <div className="mt-4 space-y-2 rounded-xl border border-border/60 bg-card/40 p-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5" /> AI
              </div>

              <Button
                variant="default"
                size="sm"
                className="w-full justify-start gap-2"
                onClick={() => setAssistantOpen(true)}
              >
                <MessageSquare className="h-3.5 w-3.5" /> Chat Assistant
              </Button>

              <div className="flex items-center gap-1">
                <Button variant="secondary" size="sm" className="flex-1 justify-start gap-2" onClick={runTriage} disabled={triaging}>
                  {triaging ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Filter className="h-3.5 w-3.5" />} Smart Triage
                </Button>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="rounded p-1 text-muted-foreground hover:text-foreground"><Info className="h-3 w-3" /></button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-[220px] text-xs">
                    Scans your first 25 loaded messages and tags each <b>High</b>, <b>Low</b>, or <b>Cold</b> so you can spot what actually needs attention.
                  </TooltipContent>
                </Tooltip>
              </div>

              <div className="flex items-center gap-1">
                <Button variant="secondary" size="sm" className="flex-1 justify-start gap-2" onClick={runAutoPurge} disabled={purging}>
                  {purging ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />} Auto-Purge
                </Button>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="rounded p-1 text-muted-foreground hover:text-foreground"><Info className="h-3 w-3" /></button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-[220px] text-xs">
                    Uses AI triage to identify cold outreach and promotional junk in view, then moves them to Trash. Nothing is permanently deleted.
                  </TooltipContent>
                </Tooltip>
              </div>

              <div className="flex items-center gap-1">
                <Button variant="secondary" size="sm" className="flex-1 justify-start gap-2" onClick={runDigest} disabled={aiBusy === "digest"}>
                  {aiBusy === "digest" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Newspaper className="h-3.5 w-3.5" />} Daily Digest
                </Button>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="rounded p-1 text-muted-foreground hover:text-foreground"><Info className="h-3 w-3" /></button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-[220px] text-xs">
                    Reads the messages currently in view and writes a short brief — what's urgent, what can wait, grouped by theme.
                  </TooltipContent>
                </Tooltip>
              </div>

            </div>

            <div className="mt-auto space-y-2">
              <button onClick={() => setCmdOpen(true)} className="flex w-full items-center gap-2 rounded-lg border border-border/60 bg-card/40 px-3 py-2 text-xs text-muted-foreground transition hover:text-foreground">
                <CmdIcon className="h-3.5 w-3.5" /> Command palette
                <span className="ml-auto rounded border border-border px-1.5 font-mono text-[10px]">⌘K</span>
              </button>
              <Button variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={() => setSettingsOpen(true)}>
                <Settings className="h-4 w-4" /> Settings
              </Button>
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
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={load}>
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

            <div ref={listRef} className="flex-1 overflow-y-auto">
              {loading && !messages.length && (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" /> Loading…
                </div>
              )}
              {!loading && !messages.length && (
                <div className="p-10 text-center text-sm text-muted-foreground">Inbox zero. 🎉</div>
              )}
              {messages.map((m, i) => {
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
                      <button onClick={(e) => { e.stopPropagation(); doStar(m.id, !m.starred); }} className="text-muted-foreground hover:text-primary">
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
            <section className="glass-inbox animate-in-up relative flex-1 overflow-y-auto rounded-2xl shadow-xl">
              <div className="mx-auto max-w-3xl px-8 py-8">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setOpenId(null)}><ArrowLeft className="h-4 w-4" /></Button>
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

                {/* AI toolbar */}
                <div className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-card/40 px-3 py-2">
                  <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <Sparkles className="h-3.5 w-3.5" /> AI
                  </span>
                  <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={runSummarize} disabled={aiBusy === "summary"}>
                    {aiBusy === "summary" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ListChecks className="h-3.5 w-3.5" />} Summarize
                  </Button>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="rounded p-1 text-muted-foreground hover:text-foreground"><Info className="h-3 w-3" /></button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[240px] text-xs">
                      Condenses this email into 3 bullets plus the single action it asks of you.
                    </TooltipContent>
                  </Tooltip>
                  <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={runSmartReplies} disabled={aiBusy === "replies"}>
                    {aiBusy === "replies" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageSquare className="h-3.5 w-3.5" />} Smart replies
                  </Button>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="rounded p-1 text-muted-foreground hover:text-foreground"><Info className="h-3 w-3" /></button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[240px] text-xs">
                      Generates 3 one-line replies. Click one to open Compose pre-filled with it.
                    </TooltipContent>
                  </Tooltip>
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

function SignInScreen({ onOpenSettings }: { onOpenSettings: () => void }) {
  const settings = useSettings();
  const [busy, setBusy] = useState(false);
  const handleSignIn = async () => {
    if (!settings.clientId) {
      toast.error("Add your Google OAuth Client ID in Settings first.");
      onOpenSettings();
      return;
    }
    setBusy(true);
    try { await signIn(true); } catch (e: any) { toast.error(e.message || "Sign-in failed"); }
    finally { setBusy(false); }
  };
  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden">
      <ThemeApplier />
      <Toaster position="top-right" richColors />
      <div className="glass-strong w-full max-w-md rounded-3xl p-10 text-center shadow-2xl">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-primary to-primary/60 shadow-lg">
          <Mail className="h-6 w-6 text-primary-foreground" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Shreyas Mail</h1>
        <p className="mt-2 text-sm text-muted-foreground">The AI-native email client. Ultra-fast, keyboard-first, beautifully quiet.</p>
        <div className="mt-6 space-y-2">
          <Button className="w-full" onClick={handleSignIn} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Sign in with Google
          </Button>
          <Button variant="ghost" className="w-full gap-2" onClick={onOpenSettings}>
            <Settings className="h-4 w-4" /> {settings.clientId ? "Change settings" : "Configure client ID"}
          </Button>
        </div>
      </div>
    </div>
  );
}
