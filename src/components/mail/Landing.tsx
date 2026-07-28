import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Mail, Sparkles, Zap, Filter, Newspaper, MessageSquare, Clock, ListChecks,
  Radar, BellOff, Search, Folder, Command, Keyboard, Palette, Image as ImageIcon,
  Trash2, ShieldAlert, CheckCircle2, ArrowRight, Settings, Lock, Gauge,
  Sun, Moon, Languages, CalendarClock, Paperclip, Download, ShieldCheck, UserSearch, Sparkle,
  Wand2, Crown, BarChart3, Inbox,

} from "lucide-react";
import { signIn } from "@/lib/gauth";
import { useSettings, settingsStore, themeMode, DEFAULT_DARK, DEFAULT_LIGHT } from "@/lib/store";
import { DemoInbox } from "@/components/mail/DemoInbox";

const AI_FEATURES = [
  { icon: Search, title: "Natural-language finder", body: "“Find my oldest emails from Spotify.” The search bar decides on its own whether you're searching or asking, then builds the Gmail query for you." },
  { icon: Wand2, title: "Full reply drafting", body: "One tap turns an open email into a complete, ready-to-send reply that answers every question in it." },
  { icon: Crown, title: "VIP Radar", body: "Separates the humans who matter — clients, colleagues, money — from the automated noise around them." },
  { icon: BarChart3, title: "Inbox Report", body: "An analytics read on your mail: volume, top senders, recurring themes and where your time actually goes." },
  { icon: MessageSquare, title: "Chat Assistant that acts", body: "Type “star the first 10 messages” or “archive everything from LinkedIn.” It builds a plan, you confirm, it executes on your real inbox." },

  { icon: Clock, title: "AI Scheduled Send", body: "“Send Priya a note about Friday in 10 minutes.” Gemini drafts it, we hold it, and it goes out exactly on time — no draft folder babysitting." },
  { icon: Radar, title: "Follow-up Radar", body: "Scans what's loaded and surfaces only the threads still waiting on your reply, ranked by urgency." },
  { icon: ListChecks, title: "Action Extractor", body: "Turns any email into a clean list of tasks, deadlines and commitments with their due dates." },
  { icon: BellOff, title: "Unsubscribe Scout", body: "Spots the senders quietly eating your inbox and tells you which are worth killing." },
  { icon: Filter, title: "Smart Triage", body: "Tags every message High, Low or Cold so the noise visually recedes before you read a word." },
  { icon: Zap, title: "Auto-Purge", body: "Cold outreach and promo junk get swept to Trash automatically — reversible, never permanent." },
  { icon: Newspaper, title: "Daily Digest", body: "A one-screen brief of your inbox, grouped by theme with urgent items first." },
  { icon: Sparkles, title: "AI Writer + Smart Replies", body: "Draft from an intent, rewrite the tone, autocomplete mid-sentence, or fire off a one-tap reply." },
  { icon: Gauge, title: "Tone & Intent Read", body: "Tells you how the sender actually feels, how urgent it really is, what they're really asking, and what breaks if you ignore it." },
  { icon: CalendarClock, title: "Meeting Extractor", body: "Pulls a calendar-ready event out of any email — title, time, place, attendees, and what to prepare." },
  { icon: Languages, title: "Instant Translate", body: "Read any email in your language without leaving the thread, subject line included." },
  { icon: ShieldCheck, title: "Security Check", body: "Scans any email for phishing, spoofing and invoice-fraud signals, then tells you plainly whether to trust it." },
  { icon: UserSearch, title: "Sender Brief", body: "Profiles whoever just emailed you from every message they've sent: what they usually want, and which threads are still open." },
  { icon: Sparkle, title: "Cleanup Plan", body: "Turns the inbox in front of you into a plan — archive now, reply today, unsubscribe — instead of a wall of unread mail." },
  { icon: Paperclip, title: "Attachment Brief", body: "Explains what the attached files are, which one actually matters, and the single action to take." },
];

const CORE_FEATURES = [
  { icon: Search, title: "Date-range search", body: "Type 10/26/25 for everything before that date, or 10/26/25-10/26/24 for the window between them." },
  { icon: Command, title: "Command palette", body: "⌘K for everything, with your own blur and transparency settings." },
  { icon: Keyboard, title: "Keyboard-first", body: "J/K to move, C to compose, E to archive, S to star, # to trash, / to search." },
  { icon: Folder, title: "Real folders", body: "Create and nest Gmail labels from the sidebar, or let the assistant file mail for you." },
  { icon: Trash2, title: "Empty Trash now", body: "Actually empty it. No 30-day wait, no digging through Gmail settings." },
  { icon: CheckCircle2, title: "Bulk everything", body: "Select all, archive, trash, mark read — across every message in view." },
  { icon: Palette, title: "Twenty themes", body: "Thirteen dark presets and seven light ones, from OLED Midnight to Soft Sand — switch in a tap." },
  { icon: ImageIcon, title: "Custom wallpapers", body: "Your own image with live blur and visibility sliders, per-pane glass controls, custom avatar." },
  { icon: Gauge, title: "Full history access", body: "Reads and writes across your entire Gmail archive — not just the last 30 days." },
  { icon: Lock, title: "Nothing stored", body: "Your mail never touches our servers. Tokens live in your browser and refresh silently." },
  { icon: ShieldAlert, title: "Spam that stays gone", body: "Triage-driven purge learns what you never want to see again." },
  { icon: Mail, title: "Three-pane, on demand", body: "The reader only exists when you open something — the list gets the full screen otherwise." },
  { icon: Download, title: "Files you can actually find", body: "Attachments get their own card grid with one-tap download, or save any file or email straight to PDF." },
  { icon: Sun, title: "Ten built-in wallpapers", body: "Pick a ready-made backdrop, or bring your own image and tune its blur and visibility." },
  { icon: Sparkles, title: "AI menu, not AI clutter", body: "Every AI tool lives behind one button that drops down when you want it and disappears when you don't." },
];

const VS_OTHERS = [
  "Other clients let you search a date. Omni Mail lets you search a range by typing it.",
  "Other clients schedule a send. Omni Mail writes the email, then schedules the send.",
  "Other clients have an AI sidebar. Omni Mail's assistant actually mutates your inbox after you confirm.",
  "Other clients pick a theme for you. Omni Mail hands you blur, opacity and wallpaper controls per pane.",
];

export function Landing({ onOpenSettings }: { onOpenSettings: () => void }) {
  const settings = useSettings();
  const [busy, setBusy] = useState(false);
  const isLight = themeMode(settings.theme) === "light";
  const toggleMode = () =>
    settingsStore.set({ theme: isLight ? DEFAULT_DARK : DEFAULT_LIGHT });

  const go = async () => {
    setBusy(true);
    try {
      await signIn(true);
    } catch (e: any) {
      toast.error(e?.message || "Sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  // Reveal sections as they scroll into view.
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>(".reveal"));
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("reveal-in");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.08 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);


  return (
    <div className="relative min-h-screen overflow-y-auto text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-20 px-4 pt-4">
        <nav className="glass mx-auto flex max-w-5xl items-center gap-3 rounded-2xl px-4 py-2.5 shadow-lg">
          <div className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-primary to-primary/60 text-primary-foreground">
            <Mail className="h-4 w-4" />
          </div>
          <span className="text-sm font-semibold tracking-tight">Omni Mail</span>
          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={toggleMode}
              aria-label={isLight ? "Switch to dark theme" : "Switch to light theme"}
              className="press relative mr-1 flex h-8 w-14 items-center rounded-full border border-border/60 bg-card/50 px-1"
            >
              <span
                className="absolute h-6 w-6 rounded-full bg-primary shadow-md transition-transform duration-300 ease-out"
                style={{ transform: isLight ? "translateX(24px)" : "translateX(0)" }}
              />
              <Moon className="relative z-10 h-3.5 w-3.5 text-primary-foreground" />
              <Sun className="relative z-10 ml-auto h-3.5 w-3.5 text-muted-foreground" />
            </button>
            <Button variant="ghost" size="sm" className="gap-2" onClick={onOpenSettings}>
              <Settings className="h-3.5 w-3.5" /> Setup
            </Button>
            <Button variant="ghost" size="sm" onClick={go} disabled={busy}>Sign in</Button>
            <Button size="sm" className="gap-1" onClick={go} disabled={busy}>
              Sign up <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <section className="reveal mx-auto max-w-4xl px-6 pb-16 pt-20 text-center">
        <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/50 px-3 py-1 text-xs text-muted-foreground">
          <Sparkles className="h-3 w-3 animate-float text-primary" /> Powered by Gmail + Gemini
        </div>
        <h1 className="text-balance text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
          Omni Mail — email that does the work
          <span className="block bg-gradient-to-r from-primary to-primary/50 bg-clip-text text-transparent">
            before you open it
          </span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-balance text-base leading-relaxed text-muted-foreground">
          Omni Mail sits on top of your real Gmail and adds the things every other client
          refuses to: an assistant that acts on your inbox, AI that drafts and schedules sends
          on a timer, range-based date search, and glass you can tune pixel by pixel.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" className="gap-2 rounded-xl px-6" onClick={go} disabled={busy}>
            Sign up with Google <ArrowRight className="h-4 w-4" />
          </Button>
          <Button size="lg" variant="secondary" className="rounded-xl px-6" onClick={go} disabled={busy}>
            Sign in
          </Button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Free, and it runs entirely in your browser. No setup required — advanced users can add their own
          Google Client ID in{" "}
          <button onClick={onOpenSettings} className="underline underline-offset-2 hover:text-foreground">Setup</button>.
        </p>
      </section>

      {/* Interactive demo */}
      <section className="reveal mx-auto max-w-6xl px-6 pb-16">
        <div className="mb-6 text-center">
          <h2 className="text-3xl font-semibold tracking-tight">Try it right here</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            A real, clickable Omni Mail. Open a message, star it, run any AI tool —
            it all works on this page before you ever sign in.
          </p>
        </div>
        <div className="animate-in-up">
          <DemoInbox />
        </div>
      </section>

      {/* What others can't do */}
      <section className="reveal mx-auto max-w-5xl px-6 pb-16">
        <div className="glass rounded-3xl p-8 shadow-xl">
          <h2 className="text-2xl font-semibold tracking-tight">What other email apps can't do</h2>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {VS_OTHERS.map((t) => (
              <li key={t} className="flex gap-2.5 rounded-xl border border-border/50 bg-card/40 p-4 text-sm text-muted-foreground">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Bring your other inboxes */}
      <section className="reveal mx-auto max-w-5xl px-6 pb-16">
        <div className="glass grid gap-6 rounded-3xl p-8 shadow-xl md:grid-cols-2 md:items-center">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Outlook, Proton, iCloud — all in one place</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Omni Mail reads whatever your Google account can reach, so any address you attach to Gmail shows up
              here with every AI tool applied to it. Add Outlook, Yahoo or any IMAP account under Gmail's
              “Accounts and Import”, or point Proton Bridge and iCloud at the same place, and they arrive
              in this inbox — one search bar, one assistant, one set of themes across all of them.
            </p>
            <a
              href="https://mail.google.com/mail/u/0/#settings/accounts"
              target="_blank"
              rel="noreferrer"
              className="press mt-4 inline-flex items-center gap-2 rounded-xl border border-border/60 bg-card/50 px-4 py-2 text-xs font-medium hover:border-primary/60"
            >
              <Inbox className="h-3.5 w-3.5 text-primary" /> Connect another mailbox <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {["Outlook", "Proton", "iCloud", "Yahoo", "Any IMAP", "Google Workspace"].map((n) => (
              <div key={n} className="lift rounded-2xl border border-border/50 bg-card/40 p-4 text-center text-xs font-medium">
                {n}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Date range highlight */}

      <section className="reveal mx-auto max-w-5xl px-6 pb-16">
        <div className="glass grid gap-6 rounded-3xl p-8 shadow-xl md:grid-cols-2 md:items-center">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Type a date. Or two.</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              The search bar understands raw dates, so you never have to remember Gmail's
              <code className="mx-1 rounded bg-card/60 px-1">before:</code> syntax again.
            </p>
          </div>
          <div className="space-y-3 rounded-2xl border border-border/60 bg-card/40 p-5 font-mono text-xs">
            <div>
              <div className="text-muted-foreground">10/26/25</div>
              <div className="mt-1 text-primary">→ everything before Oct 26, 2025</div>
            </div>
            <div>
              <div className="text-muted-foreground">10/26/25-10/26/24</div>
              <div className="mt-1 text-primary">→ before Oct 26, 2025 and after Oct 26, 2024</div>
            </div>
            <div>
              <div className="text-muted-foreground">2025-10-26</div>
              <div className="mt-1 text-primary">→ ISO dates work too</div>
            </div>
          </div>
        </div>
      </section>

      {/* AI features */}
      <section className="reveal mx-auto max-w-6xl px-6 pb-16">
        <div className="mb-6 text-center">
          <h2 className="text-3xl font-semibold tracking-tight">Twenty AI features, not one chat box</h2>
          <p className="mt-2 text-sm text-muted-foreground">Every one of them works on your live mail.</p>
        </div>
        <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {AI_FEATURES.map((f) => (
            <div key={f.title} className="glass lift animate-in-up rounded-2xl p-5 shadow-lg">
              <div className="mb-3 grid h-9 w-9 place-items-center rounded-xl bg-primary/15 text-primary">
                <f.icon className="h-4 w-4" />
              </div>
              <div className="text-sm font-semibold">{f.title}</div>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Core features */}
      <section className="reveal mx-auto max-w-6xl px-6 pb-16">
        <div className="mb-6 text-center">
          <h2 className="text-3xl font-semibold tracking-tight">And the fundamentals, done properly</h2>
        </div>
        <div className="stagger grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CORE_FEATURES.map((f) => (
            <div key={f.title} className="press rounded-2xl border border-border/50 bg-card/40 p-4 hover:border-primary/50">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <f.icon className="h-4 w-4 text-primary" /> {f.title}
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="reveal mx-auto max-w-3xl px-6 pb-20">
        <div className="glass-strong rounded-3xl p-10 text-center shadow-2xl">
          <h2 className="text-2xl font-semibold tracking-tight">Your inbox, finally quiet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Sign in with Google and you'll stay signed in — tokens refresh silently in the background.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button size="lg" className="gap-2 rounded-xl px-6" onClick={go} disabled={busy}>
              Sign up with Google <ArrowRight className="h-4 w-4" />
            </Button>
            <Button size="lg" variant="ghost" className="rounded-xl" onClick={go} disabled={busy}>
              Already have an account? Sign in
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/40 py-8 text-center text-xs text-muted-foreground">
        Omni Mail · Built on the Gmail API · Your mail never leaves your browser
      </footer>
    </div>
  );
}
