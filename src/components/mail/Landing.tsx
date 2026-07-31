import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Mail, Sparkles, Zap, Filter, Newspaper, MessageSquare, Clock, ListChecks,
  Radar, BellOff, Search, Folder, Command, Keyboard, Palette, Image as ImageIcon,
  Trash2, ShieldAlert, CheckCircle2, ArrowRight, Settings, Lock, Gauge,
  Sun, Moon, Languages, CalendarClock, Paperclip, Download, ShieldCheck, UserSearch, Sparkle,
  Wand2, Crown, BarChart3, Inbox, FileText,

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
  { icon: Clock, title: "Waiting On Them", body: "The mirror of Follow-up Radar: every thread where you already replied and someone else still owes you an answer." },
  { icon: Newspaper, title: "Weekly Recap", body: "A week-in-review of your mail — what moved, what stalled, and the three things to carry into next week." },
  { icon: ShieldCheck, title: "Inbox Risk Scan", body: "Sweeps every loaded message for phishing, spoofed senders and invoice fraud instead of checking one email at a time." },
  { icon: Crown, title: "Opportunity Finder", body: "Digs warm intros, deals, partnerships and invitations out of the noise, each with the one move to make." },
  { icon: ShieldAlert, title: "Fact Check", body: "Lists every claim, number, date and promise in an email and flags which ones to verify before you act." },
  { icon: FileText, title: "Terms Risk Review", body: "Reads for liability, indemnity, auto-renewal and payment traps, then suggests safer wording." },
  { icon: MessageSquare, title: "Forward Note", body: "Writes the two-line context plus the ask, so handing a thread to a colleague takes one paste." },
  { icon: UserSearch, title: "Questions To Ask", body: "The clarifying questions worth sending back before you commit, ordered by how much they unblock you." },
  { icon: Newspaper, title: "Newsletter Digest", body: "Merges every newsletter and automated update into one short read, and names the senders you can safely skip." },
  { icon: Sparkle, title: "Bulk Categorize", body: "Tags every message as Work, Money, Travel, Personal, Newsletter, Promo, Notification or Spam so filing is a single pass." },
  { icon: Clock, title: "Response Coach", body: "Shows who has waited longest, which threads are going stale, and the three replies to send today." },
  { icon: Paperclip, title: "Attachment Index", body: "Indexes the documents, invoices and contracts that landed in your inbox, with what each is for and whether to keep it." },
  { icon: ListChecks, title: "Action Checklist", body: "Turns any email into up to six concrete steps, each with an owner and a due moment." },
  { icon: ShieldAlert, title: "Anticipate Objections", body: "Predicts the pushback your reply will get and hands you the answer to each one before you send." },
  { icon: Clock, title: "Snooze Plan", body: "Decides what can leave the inbox now and exactly when each thing should come back, so only today's mail stays in front of you." },
  { icon: Gauge, title: "Decision Brief", body: "Strips an email to the decision it demands: TL;DR, the choice, the deadline, what breaks if you ignore it, and the one move to make." },
  { icon: ShieldCheck, title: "Accuracy engine", body: "Every AI tool runs on a strict grounding rule set — no invented senders, dates or amounts, and a plain \"not in this mail\" when the answer isn't there." },
  { icon: Languages, title: "Reply In Their Language", body: "Detects the language an email was written in and drafts a natural reply in that same language." },
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
  { icon: Command, title: "Grouped AI sub-menus", body: "Thirty tools sorted into Triage, Briefings, People, Money and Protect — so you find the right one in a second." },
  { icon: Search, title: "Search that closes itself", body: "The omni island slides away the moment your pointer leaves it — no clicking empty space to dismiss a search bar." },
  { icon: Sparkles, title: "Magnifying hover", body: "Rows, folders, Compose and every AI tool gently scale and sharpen under the cursor, so you always know what you're about to hit." },
  { icon: Gauge, title: "Grounded AI by default", body: "Shared accuracy rules sit in front of all forty-plus tools, so answers stay tied to your actual mail." },
  { icon: ListChecks, title: "Inbox Zero playbook", body: "A built-in method, not just tools — triage, purge, snooze, respond, in that order, in under fifteen minutes a day." },
  { icon: Search, title: "Search that gets out of the way", body: "A tiny pill until you touch it, then it glides open into a full omni bar and glides shut when you're done." },
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
          <h2 className="text-3xl font-semibold tracking-tight">Forty AI features, grouped so you can find them</h2>
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

      {/* Inbox Zero article */}
      <section className="reveal mx-auto max-w-3xl px-6 pb-16">
        <article className="glass rounded-3xl p-8 shadow-xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/50 px-3 py-1 text-xs text-muted-foreground">
            <ListChecks className="h-3 w-3 text-primary" /> Guide
          </div>
          <h2 className="text-3xl font-semibold tracking-tight">How to reach inbox zero — and stay there</h2>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            Inbox zero was never about an empty mailbox. It is about an inbox that only holds what still
            needs you. Most people fail at it because they treat every message as a decision to make
            twice: once when it arrives, once when they finally answer it. The fix is to make the
            decision exactly once, and to let software make the obvious ones for you.
          </p>

          <h3 className="mt-7 text-lg font-semibold tracking-tight">1. Sort before you read</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Run Smart Triage first. Every message gets tagged High, Low or Cold before you have read a
            single word, so the noise visually recedes and your eye lands on the four things that
            actually matter. Reading first and sorting later is how a morning disappears.
          </p>

          <h3 className="mt-6 text-lg font-semibold tracking-tight">2. Delete the mail you were never going to answer</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Auto-Purge sweeps cold outreach and promo junk to Trash — reversibly, never permanently.
            Then let Unsubscribe Scout name the senders quietly eating your week. Most inboxes shrink by
            a third before a single reply is written.
          </p>

          <h3 className="mt-6 text-lg font-semibold tracking-tight">3. Snooze what isn't due today</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            A message you cannot act on today is not an inbox item, it is a future one. Snooze Plan reads
            what is loaded and tells you what should leave now and precisely when it should return, so
            today's inbox contains only today's work.
          </p>

          <h3 className="mt-6 text-lg font-semibold tracking-tight">4. Answer in one pass</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            For anything left, open Decision Brief: the choice, the deadline, and what breaks if you
            ignore it. Then Draft Full Reply writes the answer and you edit rather than compose. Anything
            that needs to land later goes out through AI Scheduled Send instead of sitting in drafts.
          </p>

          <h3 className="mt-6 text-lg font-semibold tracking-tight">5. Close the loop the next morning</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Follow-up Radar shows the threads still waiting on you; Waiting On Them shows the ones
            waiting on someone else. Two minutes there is what keeps inbox zero from being a one-time
            stunt.
          </p>

          <div className="mt-7 rounded-2xl border border-border/50 bg-card/40 p-5">
            <div className="text-sm font-semibold">The fifteen-minute loop</div>
            <ol className="mt-2 space-y-1.5 text-xs leading-relaxed text-muted-foreground">
              <li>1. Triage — let the labels land before you read.</li>
              <li>2. Purge — cold and promo out, reversibly.</li>
              <li>3. Snooze — anything not due today.</li>
              <li>4. Reply — Decision Brief, then Draft Full Reply.</li>
              <li>5. Sweep — Follow-up Radar and Waiting On Them.</li>
            </ol>
          </div>
        </article>
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
