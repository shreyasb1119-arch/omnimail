import { useEffect, useMemo, useRef, useState } from "react";
import {
  Star, Archive, Trash2, Sparkles, ChevronDown, Paperclip, Download, FileText,
  Inbox, Search, Loader2, ListChecks, MessageSquare, Radar, BellOff, Newspaper,
  Languages, Gauge, CalendarClock, Zap, Filter, Check, RotateCcw, ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type DemoMsg = {
  id: string;
  from: string;
  email: string;
  subject: string;
  snippet: string;
  body: string;
  time: string;
  unread: boolean;
  starred: boolean;
  files?: { name: string; kind: string; size: string }[];
  tag?: "high" | "low" | "cold";
};

const SEED: DemoMsg[] = [
  {
    id: "1", from: "Priya Raman", email: "priya@northwind.co",
    subject: "Friday review — deck + numbers attached",
    snippet: "Sending the Q3 deck ahead of Friday. Can you confirm the revenue slide by Thursday 5pm?",
    body: "Hi,\n\nSending the Q3 deck ahead of Friday's review. Two things:\n\n1. Can you confirm the revenue slide by Thursday 5pm?\n2. We moved the review to Friday 10:30am PT, Zoom link in the invite.\n\nThe pricing sheet is attached as well.\n\nThanks,\nPriya",
    time: "9:12", unread: true, starred: false,
    files: [
      { name: "Q3-review.pdf", kind: "pdf", size: "2.4 MB" },
      { name: "pricing-sheet.xlsx", kind: "sheet", size: "48 KB" },
      { name: "hero-mock.png", kind: "image", size: "1.1 MB" },
    ],
  },
  {
    id: "2", from: "Marcus Bell", email: "m.bell@acme.io",
    subject: "Re: contract redlines",
    snippet: "Legal signed off on 3 of 4 clauses. Waiting on your take on the indemnity language.",
    body: "Legal signed off on three of the four clauses. We're still waiting on your take on the indemnity language before we can counter-sign. Anything before Wednesday works.",
    time: "8:40", unread: true, starred: false,
  },
  {
    id: "3", from: "The Overflow Weekly", email: "news@overflow.dev",
    subject: "12 things engineers shipped this week",
    snippet: "Plus: the state of edge runtimes, and why everyone's rewriting their build step again.",
    body: "This week in engineering: edge runtimes, build steps, and a suspicious number of Rust rewrites.",
    time: "7:02", unread: false, starred: false,
  },
  {
    id: "4", from: "Dana Whitfield", email: "dana@series-b.vc",
    subject: "Quick intro — 15 min this week?",
    snippet: "Loved what you're building. Would love to put 15 minutes on the calendar.",
    body: "Hi — loved what you're building. Would love to put 15 minutes on the calendar this week or next. Totally fine if the timing isn't right.",
    time: "Tue", unread: false, starred: true,
  },
  {
    id: "5", from: "CloudScale Sales", email: "outbound@cloudscale.biz",
    subject: "Cut your infra bill by 40% (last chance)",
    snippet: "Hi there, noticed you're scaling fast. Our platform helps teams like yours save…",
    body: "Hi there, noticed you're scaling fast. Our platform helps teams like yours save up to 40% on infrastructure. Worth a chat?",
    time: "Tue", unread: false, starred: false,
  },
  {
    id: "6", from: "Ana Silva", email: "ana@studioform.pt",
    subject: "Proposta de colaboração",
    snippet: "Olá! Gostaríamos de propor uma colaboração para o próximo trimestre.",
    body: "Olá!\n\nGostaríamos de propor uma colaboração para o próximo trimestre. Podemos falar na próxima semana?\n\nCumprimentos,\nAna",
    time: "Mon", unread: false, starred: false,
  },
];

type FeatureKey =
  | "triage" | "purge" | "digest" | "radar" | "scout" | "priority"
  | "summary" | "replies" | "tasks" | "tone" | "meeting" | "translate" | "files"
  | "commitments" | "spend" | "travel" | "deadlines" | "pulse" | "plan" | "rules" | "dupes"
  | "timeline" | "explain" | "variants" | "counter" | "decline" | "ics" | "contacts"
  | "waiting" | "recap" | "riskscan" | "opps"
  | "factcheck" | "contract" | "forward" | "questions";

const INBOX_FEATURES: { key: FeatureKey; label: string; icon: any; blurb: string }[] = [
  { key: "triage", label: "Smart Triage", icon: Filter, blurb: "Tags every message High / Low / Cold." },
  { key: "purge", label: "Auto-Purge", icon: Zap, blurb: "Sweeps cold outreach and promo junk to Trash." },
  { key: "priority", label: "Priority Sort", icon: Gauge, blurb: "Ranks what to open first, and why." },
  { key: "digest", label: "Daily Digest", icon: Newspaper, blurb: "One-screen brief of the whole inbox." },
  { key: "radar", label: "Follow-up Radar", icon: Radar, blurb: "Threads still waiting on your reply." },
  { key: "scout", label: "Unsubscribe Scout", icon: BellOff, blurb: "Senders quietly eating your inbox." },
  { key: "commitments", label: "Commitment Tracker", icon: Check, blurb: "Everything you promised, and to whom." },
  { key: "spend", label: "Spend Scan", icon: Gauge, blurb: "Receipts, invoices and renewals in one view." },
  { key: "travel", label: "Travel Board", icon: CalendarClock, blurb: "Bookings assembled into an itinerary." },
  { key: "deadlines", label: "Deadline Board", icon: CalendarClock, blurb: "Every date across the inbox, in order." },
  { key: "pulse", label: "Relationship Pulse", icon: Radar, blurb: "Who's warm, who's going cold on you." },
  { key: "plan", label: "Daily Plan", icon: ListChecks, blurb: "A time-blocked plan for clearing today." },
  { key: "rules", label: "Rule Builder", icon: Filter, blurb: "Safe auto-rules that kill the noise." },
  { key: "dupes", label: "Duplicate Scan", icon: Zap, blurb: "Resends and repeat chains, clustered." },
  { key: "waiting", label: "Waiting On Them", icon: Radar, blurb: "Who still owes you a reply." },
  { key: "recap", label: "Weekly Recap", icon: Newspaper, blurb: "What moved, what stalled, what's next." },
  { key: "riskscan", label: "Inbox Risk Scan", icon: ShieldCheck, blurb: "Phishing and invoice fraud, inbox-wide." },
  { key: "opps", label: "Opportunity Finder", icon: Gauge, blurb: "Intros and deals hiding in the noise." },
];

const READER_FEATURES: { key: FeatureKey; label: string; icon: any; blurb: string }[] = [
  { key: "summary", label: "Summarize", icon: ListChecks, blurb: "3 bullets + the one action asked of you." },
  { key: "replies", label: "Smart replies", icon: MessageSquare, blurb: "Three one-tap replies." },
  { key: "tasks", label: "Action items", icon: Check, blurb: "Tasks and deadlines as a checklist." },
  { key: "tone", label: "Tone read", icon: Gauge, blurb: "Real intent, urgency and risk of ignoring." },
  { key: "meeting", label: "Meeting extract", icon: CalendarClock, blurb: "Calendar-ready event from the text." },
  { key: "translate", label: "Translate", icon: Languages, blurb: "Read any email in your language." },
  { key: "files", label: "Attachment brief", icon: Paperclip, blurb: "What the files are and which matters." },
  { key: "timeline", label: "Thread timeline", icon: CalendarClock, blurb: "Who said what, and what's on you." },
  { key: "explain", label: "Explain simply", icon: Languages, blurb: "Jargon and legalese in plain English." },
  { key: "variants", label: "Reply in 3 tones", icon: MessageSquare, blurb: "Warm, direct or firm — you pick." },
  { key: "counter", label: "Counter-proposal", icon: Gauge, blurb: "Leverage read + a ready counter." },
  { key: "decline", label: "Politely decline", icon: BellOff, blurb: "A warm no that keeps the door open." },
  { key: "ics", label: "Calendar draft", icon: CalendarClock, blurb: "Paste-ready .ics for any event." },
  { key: "contacts", label: "Extract contacts", icon: ListChecks, blurb: "People, links and reference numbers." },
  { key: "factcheck", label: "Fact check", icon: ShieldCheck, blurb: "Claims and numbers worth verifying." },
  { key: "contract", label: "Terms risk review", icon: FileText, blurb: "Liability and renewal traps, flagged." },
  { key: "forward", label: "Forward note", icon: MessageSquare, blurb: "Context + ask, ready to forward." },
  { key: "questions", label: "Questions to ask", icon: Check, blurb: "What to clarify before you commit." },
];

const INBOX_GROUPS: { name: string; keys: FeatureKey[] }[] = [
  { name: "Triage & cleanup", keys: ["triage", "purge", "priority", "dupes", "scout"] },
  { name: "Daily briefings", keys: ["digest", "plan", "recap"] },
  { name: "People & follow-ups", keys: ["radar", "waiting", "pulse", "commitments", "opps"] },
  { name: "Money, dates & travel", keys: ["spend", "deadlines", "travel"] },
  { name: "Organise & protect", keys: ["rules", "riskscan"] },
];

const READER_GROUPS: { name: string; keys: FeatureKey[] }[] = [
  { name: "Understand", keys: ["summary", "explain", "tone", "timeline", "translate"] },
  { name: "Reply", keys: ["replies", "variants", "counter", "decline", "forward", "questions"] },
  { name: "Extract", keys: ["tasks", "meeting", "ics", "contacts", "files"] },
  { name: "Verify", keys: ["factcheck", "contract", "riskscan"] },
];

const RESULTS: Record<string, string> = {
  priority: `1. Priya Raman — Friday review — hard deadline Thursday 5pm
2. Marcus Bell — contract redlines — blocking counter-signature
3. Ana Silva — proposta — new partner, low urgency
4. Dana Whitfield — intro request — reply when convenient`,
  digest: `URGENT
• Priya needs the revenue slide confirmed by Thu 5pm.
• Marcus is blocked on your indemnity language.

CAN WAIT
• Dana wants a 15-min intro call.
• Ana proposes a Q4 collaboration (Portuguese).

NOISE
• Overflow Weekly, CloudScale outbound.`,
  radar: `1. Marcus Bell — contract redlines — waiting on your indemnity call
2. Priya Raman — Friday review — needs slide confirmation
3. Dana Whitfield — intro — unanswered for 2 days`,
  scout: `The Overflow Weekly — 1 msg — keep — genuinely read, low volume
CloudScale Sales — 1 msg — unsubscribe — pure cold outbound`,
  summary: `• Q3 deck attached ahead of Friday's review.
• Revenue slide needs your confirmation by Thu 5pm.
• Review moved to Fri 10:30am PT on Zoom.
Action: confirm the revenue slide before Thursday 5pm.`,
  tasks: `• Confirm revenue slide — Thursday 5:00pm
• Attend Q3 review — Friday 10:30am PT
• Review pricing sheet — no date`,
  tone: `Tone: warm, deadline-driven
Urgency: high
Real ask: sign off on the revenue slide before Thursday evening.
Risk: Friday's review runs on unverified numbers.`,
  meeting: `Title: Q3 Review
When: Friday 10:30am PT
Where: Zoom (link in calendar invite)
With: Priya Raman + review group
Prep: confirm the revenue slide first`,
  translate: `Subject: Collaboration proposal

Hello!

We'd like to propose a collaboration for next quarter. Could we speak next week?

Best regards,
Ana`,
  files: `Three files: a Q3 review deck, a pricing spreadsheet and a hero mockup.
The deck is what matters — it drives Friday's meeting.
The pricing sheet backs the revenue slide you need to confirm.
Action: open Q3-review.pdf and check slide 4 before Thursday.`,
};

const EXTRA_RESULTS: Record<string, string> = {
  commitments: `Confirm the revenue slide — Priya Raman — Thu 5:00pm
Answer indemnity language — Marcus Bell — before Wed
Reply to intro request — Dana Whitfield — no date`,
  spend: `Charges:
• CloudScale trial — $0.00 — Tue
Recurring:
• Overflow Weekly (free), no paid subscriptions in view
Watch out:
No renewals due in the next 14 days.`,
  travel: `No travel bookings in view.`,
  deadlines: `Wed — Indemnity language back to Marcus — Marcus Bell
Thu 5:00pm — Confirm revenue slide — Priya Raman
Fri 10:30am PT — Q3 review call — review group`,
  pulse: `Warm: Priya Raman, Marcus Bell
Cooling: Dana Whitfield (2 days, no reply), Ana Silva
Reconnect: send Dana a two-line yes/no today.`,
  plan: `09:00-09:25 — Confirm revenue slide for Priya — 25m
09:25-09:50 — Draft indemnity answer for Marcus — 25m
09:50-10:00 — Reply to Dana with a time — 10m
10:00-10:10 — Translate + answer Ana — 10m
10:10-10:15 — Unsubscribe from CloudScale — 5m`,
  rules: `IF from:cloudscale.biz THEN trash
IF from:overflow.dev THEN label Reading, mark read
IF subject:"Q3" THEN label Finance
IF has:attachment from:northwind.co THEN label Deck`,
  dupes: `Cold outbound — 1 — nothing to merge
Newsletters — 1 — keep the latest issue
No duplicate clusters worth cleaning.`,
  timeline: `Priya — sent the Q3 deck and pricing sheet
Priya — moved the review to Friday 10:30am PT
Priya — asked for revenue slide confirmation by Thursday
Now: you owe Priya a yes/no on the revenue slide.`,
  explain: `In short: Priya needs you to verify one slide before Friday's meeting.
What it means:
• The deck is final except the revenue numbers.
• Your sign-off unblocks the meeting.
• The pricing sheet is the source data.
Terms: "revenue slide" = the numbers page presented to leadership.`,
  variants: `Warm:
Thanks Priya — deck looks great. I'll verify the revenue slide against the pricing sheet and confirm by Thursday noon.

Direct:
Confirming by Thursday noon. Friday 10:30 PT works.

Firm:
I can confirm the slide by Thursday only if the pricing sheet is final. Flag now if it isn't.`,
  counter: `Their ask: sign-off on the revenue slide by Thursday 5pm.
Their leverage: the review is already scheduled for Friday.
Your leverage: the numbers can't be presented without you.
Counter: I can confirm by Thursday noon if you lock the pricing sheet today. If it changes after that, we present the slide as draft. Fine either way — just tell me which.`,
  decline: `Thanks for thinking of me, Dana — I'm heads-down through this quarter, so I'll pass on a call for now. Happy to reconnect in the new year if that's still useful.`,
  ics: `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
SUMMARY:Q3 Review
DTSTART:20260731T173000Z
DTEND:20260731T183000Z
LOCATION:Zoom
DESCRIPTION:Q3 review with Priya Raman. Confirm revenue slide first.
END:VEVENT
END:VCALENDAR`,
  contacts: `People: Priya Raman
Companies: Northwind
Contacts: priya@northwind.co
Links: Zoom invite (in calendar)
Refs: Q3-review.pdf, pricing-sheet.xlsx`,
  waiting: `Dana Whitfield — owes you the intro context you asked for — 2 days
Ana Silva — owes you the scope of the collaboration — 1 day
Nudge: "Dana — still keen, can you send who you'd introduce me to?"`,
  recap: `WHAT HAPPENED
• Q3 deck landed and the review moved to Friday 10:30 PT.
• Contract redlines came back from Marcus.
STALLED
• Dana's intro request — no reply for 2 days.
• Ana's Q4 proposal — untranslated, unanswered.
NEXT WEEK
1. Close the indemnity language. 2. Present Q3. 3. Reply to Ana with a date.`,
  riskscan: `CloudScale Sales — medium — cold outbound with a tracked "billing" link — do not click, trash it
Everything else in view is from known senders with matching domains.
No invoice-fraud or spoofing signals found.`,
  opps: `Dana Whitfield — VC intro to two portfolio founders — reply with 2 time slots today
Ana Silva — Q4 studio collaboration — ask for scope and budget range
Priya Raman — visibility with leadership on Friday — bring one metric they haven't seen`,
  factcheck: `Review moved to Friday 10:30am PT — verify: yes — check the calendar invite
Revenue slide needs sign-off by Thu 5pm — verify: yes — confirm against pricing-sheet.xlsx
Deck is otherwise final — verify: no — Priya owns it`,
  contract: `"indemnify for all losses" — unlimited liability — cap it at fees paid in 12 months
"auto-renews annually" — silent renewal — add 30-day notice
"net 60" — slow payment — push to net 30
Nothing else in the message is binding.`,
  forward: `Forwarding Priya's Q3 deck — the review moved to Friday 10:30 PT and the revenue slide still needs confirming.
Can you sanity-check slide 4 against the pricing sheet before Thursday noon?`,
  questions: `1. Is the pricing sheet final, or can the numbers still move?
2. Which revenue figure is authoritative — the deck or the sheet?
3. Who else presents on Friday?
4. Do you need the slide confirmed, or rewritten?`,
};

const REPLIES = ["Confirmed — slide looks right.", "Give me until Thursday noon.", "Can we push the review to Monday?"];

function useTypewriter(text: string, on: boolean) {
  const [shown, setShown] = useState("");
  useEffect(() => {
    if (!on || !text) { setShown(""); return; }
    setShown("");
    let i = 0;
    const step = Math.max(2, Math.round(text.length / 90));
    const iv = window.setInterval(() => {
      i += step;
      setShown(text.slice(0, i));
      if (i >= text.length) window.clearInterval(iv);
    }, 16);
    return () => window.clearInterval(iv);
  }, [text, on]);
  return shown;
}

export function DemoInbox() {
  const [msgs, setMsgs] = useState<DemoMsg[]>(SEED);
  const [openId, setOpenId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [readerMenu, setReaderMenu] = useState(false);
  const [demoGroup, setDemoGroup] = useState<string | null>("Triage & cleanup");
  const [demoReaderGroup, setDemoReaderGroup] = useState<string | null>("Understand");
  const [busy, setBusy] = useState<FeatureKey | null>(null);
  const [result, setResult] = useState<{ title: string; text: string } | null>(null);
  const [replies, setReplies] = useState<string[]>([]);
  const [toast, setToast] = useState("");
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const opened = msgs.find((m) => m.id === openId) || null;
  const typed = useTypewriter(result?.text ?? "", !!result);

  const flash = (t: string) => {
    setToast(t);
    timers.current.push(window.setTimeout(() => setToast(""), 2200));
  };

  const run = (key: FeatureKey, label: string) => {
    setMenuOpen(false);
    setReaderMenu(false);
    setBusy(key);
    setReplies([]);
    setResult(null);
    timers.current.push(
      window.setTimeout(() => {
        setBusy(null);
        if (key === "triage") {
          setMsgs((p) =>
            p.map((m) => ({
              ...m,
              tag: /overflow|cloudscale/i.test(m.email)
                ? (/cloudscale/i.test(m.email) ? "cold" : "low")
                : "high",
            })),
          );
          flash("Triaged 6 messages");
        } else if (key === "purge") {
          setMsgs((p) => p.filter((m) => !/cloudscale/i.test(m.email)));
          flash("1 cold email moved to Trash");
        } else if (key === "replies") {
          setReplies(REPLIES);
        } else {
          setResult({ title: label, text: RESULTS[key] || EXTRA_RESULTS[key] || "" });
        }
      }, 850),
    );
  };

  const reset = () => {
    setMsgs(SEED);
    setOpenId(null);
    setResult(null);
    setReplies([]);
    flash("Demo reset");
  };

  const unread = useMemo(() => msgs.filter((m) => m.unread).length, [msgs]);

  return (
    <div className="glass relative overflow-hidden rounded-3xl p-2 shadow-2xl sm:p-3">
      <div className="flex items-center gap-2 px-2 pb-2 pt-1">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-primary/60" />
          <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40" />
        </div>
        <span className="ml-2 text-[11px] text-muted-foreground">
          Live demo — click around, nothing leaves this page
        </span>
        <button
          onClick={reset}
          className="press ml-auto flex items-center gap-1 rounded-lg border border-border/60 px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="h-3 w-3" /> Reset
        </button>
      </div>

      <div className="grid gap-2 md:grid-cols-[1fr_1.15fr]">
        {/* List */}
        <div className="glass-inbox flex flex-col overflow-hidden rounded-2xl">
          <div className="flex items-center gap-2 border-b border-border/50 px-3 py-2.5">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground">Try 10/26/25 for a date filter…</span>
          </div>

          {/* AI menu — hidden until opened */}
          <div className="border-b border-border/50 px-2 py-2">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="press flex w-full items-center gap-2 rounded-xl bg-primary px-3 py-2 text-xs font-medium text-primary-foreground"
            >
              <Sparkles className="h-3.5 w-3.5" /> AI features
              <ChevronDown className={`ml-auto h-3.5 w-3.5 transition-transform duration-300 ${menuOpen ? "rotate-180" : ""}`} />
            </button>
            <div className="collapsible" data-open={menuOpen}>
              <div className="collapsible-inner">
                <div className="mt-2 space-y-1">
                  {INBOX_GROUPS.map((g) => {
                    const feats = INBOX_FEATURES.filter((f) => g.keys.includes(f.key));
                    if (!feats.length) return null;
                    const open = demoGroup === g.name;
                    return (
                      <div key={g.name} className="rounded-lg border border-border/50 bg-card/30">
                        <button
                          onClick={() => setDemoGroup(open ? null : g.name)}
                          className="press flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
                        >
                          {g.name}
                          <span className="ml-auto text-[10px] font-normal normal-case text-muted-foreground/60">{feats.length}</span>
                          <ChevronDown className={`h-3 w-3 transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
                        </button>
                        <div className="collapsible" data-open={open}>
                          <div className="collapsible-inner">
                            <div className="space-y-1 p-1.5 pt-0">
                              {feats.map((f) => (
                                <button
                                  key={f.key}
                                  onClick={() => run(f.key, f.label)}
                                  className="press flex w-full items-start gap-2 rounded-lg border border-border/50 bg-card/50 px-2.5 py-2 text-left hover:border-primary/60"
                                >
                                  <f.icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                                  <span>
                                    <span className="block text-[11px] font-medium">{f.label}</span>
                                    <span className="block text-[10px] leading-tight text-muted-foreground">{f.blurb}</span>
                                  </span>
                                  {busy === f.key && <Loader2 className="ml-auto h-3 w-3 animate-spin text-primary" />}
                                </button>
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

          <div className="flex items-center gap-2 px-3 py-1.5 text-[10px] text-muted-foreground">
            <Inbox className="h-3 w-3" /> {msgs.length} messages · {unread} unread
          </div>

          <div className="stagger max-h-[340px] overflow-y-auto">
            {msgs.map((m) => (
              <div
                key={m.id}
                onClick={() => { setOpenId(m.id); setResult(null); setReplies([]); setMsgs((p) => p.map((x) => x.id === m.id ? { ...x, unread: false } : x)); }}
                className={`group flex cursor-pointer gap-2 border-b border-border/40 px-3 py-2.5 transition-colors duration-200 ${
                  openId === m.id ? "bg-accent/60" : "hover:bg-accent/25"
                }`}
              >
                <button
                  onClick={(e) => { e.stopPropagation(); setMsgs((p) => p.map((x) => x.id === m.id ? { ...x, starred: !x.starred } : x)); }}
                  className="press mt-0.5 text-muted-foreground hover:text-primary"
                >
                  <Star className={`h-3.5 w-3.5 ${m.starred ? "fill-primary text-primary" : ""}`} />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className={`truncate text-xs ${m.unread ? "font-semibold" : "text-muted-foreground"}`}>{m.from}</span>
                    {m.tag && (
                      <span className={`animate-pop rounded-full border px-1.5 text-[9px] ${
                        m.tag === "high" ? "border-primary/40 bg-primary/15 text-primary"
                        : m.tag === "cold" ? "border-destructive/40 bg-destructive/15 text-destructive"
                        : "border-border bg-muted text-muted-foreground"}`}>
                        {m.tag}
                      </span>
                    )}
                    {m.files && <Paperclip className="h-3 w-3 text-muted-foreground" />}
                    <span className="ml-auto shrink-0 text-[9px] text-muted-foreground">{m.time}</span>
                  </div>
                  <div className="truncate text-xs">{m.subject}</div>
                  <div className="truncate text-[10px] text-muted-foreground/80">{m.snippet}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Reader */}
        <div className="glass-inbox flex min-h-[420px] flex-col overflow-hidden rounded-2xl">
          {!opened ? (
            <div className="m-auto max-w-[240px] p-6 text-center text-xs text-muted-foreground">
              <Sparkles className="mx-auto mb-2 h-5 w-5 animate-float text-primary" />
              The reader only exists once you open something. Click a message on the left.
            </div>
          ) : (
            <div className="animate-in-up flex-1 overflow-y-auto p-4">
              <div className="mb-3 flex items-center gap-1.5">
                <Button size="sm" variant="ghost" className="press h-7 gap-1 text-[11px]" onClick={() => { setMsgs((p) => p.filter((x) => x.id !== opened.id)); setOpenId(null); flash("Archived"); }}>
                  <Archive className="h-3.5 w-3.5" /> Archive
                </Button>
                <Button size="sm" variant="ghost" className="press h-7 gap-1 text-[11px] text-destructive" onClick={() => { setMsgs((p) => p.filter((x) => x.id !== opened.id)); setOpenId(null); flash("Moved to Trash"); }}>
                  <Trash2 className="h-3.5 w-3.5" /> Trash
                </Button>
                <button onClick={() => setOpenId(null)} className="press ml-auto text-[11px] text-muted-foreground hover:text-foreground">Close</button>
              </div>

              {/* Reader AI menu */}
              <button
                onClick={() => setReaderMenu((o) => !o)}
                className="press flex w-full items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 text-[11px] font-medium text-primary"
              >
                <Sparkles className="h-3.5 w-3.5" /> AI tools for this email
                <ChevronDown className={`ml-auto h-3.5 w-3.5 transition-transform duration-300 ${readerMenu ? "rotate-180" : ""}`} />
              </button>
              <div className="collapsible" data-open={readerMenu}>
                <div className="collapsible-inner">
                  <div className="mt-2 space-y-1">
                    {READER_GROUPS.map((g) => {
                      const feats = READER_FEATURES.filter((f) => g.keys.includes(f.key));
                      if (!feats.length) return null;
                      const open = demoReaderGroup === g.name;
                      return (
                        <div key={g.name} className="rounded-lg border border-border/50 bg-card/30">
                          <button
                            onClick={() => setDemoReaderGroup(open ? null : g.name)}
                            className="press flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
                          >
                            {g.name}
                            <span className="ml-auto text-[10px] font-normal normal-case text-muted-foreground/60">{feats.length}</span>
                            <ChevronDown className={`h-3 w-3 transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
                          </button>
                          <div className="collapsible" data-open={open}>
                            <div className="collapsible-inner">
                              <div className="grid gap-1 p-1.5 pt-0 sm:grid-cols-2">
                                {feats.map((f) => (
                                  <button
                                    key={f.key}
                                    onClick={() => run(f.key, f.label)}
                                    className="press flex items-start gap-2 rounded-lg border border-border/50 bg-card/50 px-2.5 py-2 text-left hover:border-primary/60"
                                  >
                                    <f.icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                                    <span>
                                      <span className="block text-[11px] font-medium">{f.label}</span>
                                      <span className="block text-[10px] leading-tight text-muted-foreground">{f.blurb}</span>
                                    </span>
                                  </button>
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

              {busy && (
                <div className="mt-3 flex items-center gap-2 rounded-xl border border-border/50 bg-card/40 px-3 py-2 text-[11px] text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /> Thinking…
                </div>
              )}

              {result && (
                <div className="animate-in-up mt-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-primary">{result.title}</div>
                  <pre className="whitespace-pre-wrap font-sans text-[11px] leading-relaxed">{typed}</pre>
                </div>
              )}

              {replies.length > 0 && (
                <div className="stagger mt-3 flex flex-wrap gap-1.5">
                  {replies.map((r) => (
                    <button key={r} onClick={() => flash("Reply drafted")} className="press rounded-full border border-border/60 bg-card/50 px-2.5 py-1 text-[10px] hover:border-primary hover:text-primary">
                      {r}
                    </button>
                  ))}
                </div>
              )}

              <h3 className="mt-4 text-base font-semibold tracking-tight">{opened.subject}</h3>
              <div className="mt-1 text-[11px] text-muted-foreground">{opened.from} &lt;{opened.email}&gt;</div>

              {opened.files && (
                <div className="mt-3 space-y-1.5">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {opened.files.length} attachments
                  </div>
                  <div className="stagger grid gap-1.5 sm:grid-cols-2">
                    {opened.files.map((f) => (
                      <div key={f.name} className="lift flex items-center gap-2 rounded-xl border border-border/60 bg-card/50 p-2">
                        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
                          <FileText className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[11px] font-medium">{f.name}</div>
                          <div className="text-[9px] text-muted-foreground">{f.size}</div>
                        </div>
                        <button onClick={() => flash(`Downloading ${f.name}`)} className="press rounded p-1 text-muted-foreground hover:text-primary" title="Download">
                          <Download className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => flash(`Saved ${f.name} as PDF`)} className="press rounded p-1 text-muted-foreground hover:text-primary" title="Save as PDF">
                          <FileText className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <pre className="mt-4 whitespace-pre-wrap rounded-xl border border-border/60 bg-card/40 p-3 font-sans text-[11px] leading-relaxed">
                {opened.body}
              </pre>
            </div>
          )}
        </div>
      </div>

      {toast && (
        <div className="animate-pop pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-border/60 bg-card px-3 py-1.5 text-[11px] shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
