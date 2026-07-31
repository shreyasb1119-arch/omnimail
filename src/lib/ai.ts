import { settingsStore } from "./store";
import { lovableAiChat } from "./ai.functions";

const BASE_RULES = `You are Omni Mail's email intelligence engine. Accuracy rules, always:
- Use ONLY the email data given. Never invent senders, dates, amounts, links or facts.
- If the data does not support an answer, say so plainly in one line instead of guessing.
- Quote names, amounts and dates exactly as written; write dates as "Mon D, YYYY".
- Be specific and short. No preamble, no sign-off, no markdown headers, no repeating the prompt.
- Never output more items than the data supports.`;

function withRules(system: string) {
  return system ? `${BASE_RULES}\n\n${system}` : BASE_RULES;
}

export async function aiChat(prompt: string, userSystem = ""): Promise<string> {
  const system = withRules(userSystem);
  const key = settingsStore.get().geminiKey.trim();
  if (key) {
    // Call Gemini directly from the browser
    const contents = [
      ...(system ? [{ role: "user", parts: [{ text: `SYSTEM:\n${system}` }] }] : []),
      { role: "user", parts: [{ text: prompt }] },
    ];
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${encodeURIComponent(key)}`,

      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents }),
      },
    );
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      throw new Error(`Gemini ${r.status}: ${t}`);
    }
    const j = (await r.json()) as any;
    return (j.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ?? "").trim();
  }
  // Fallback: Lovable AI Gateway via server function
  const res = await lovableAiChat({ data: { prompt, system } });
  return (res.text || "").trim();
}

export async function aiWriteEmail(opts: {
  intent: string;
  tone: "professional" | "casual" | "cold";
  context?: string;
}) {
  const system = `You are an elite email writing assistant. Write a complete, ready-to-send email.
Return ONLY the email body with a Subject: line at the top like:
Subject: <subject>

<body>

Tone: ${opts.tone}. Keep it concise, human, and specific. No preamble.`;
  const prompt = `Write an email for this intent:\n${opts.intent}\n${opts.context ? `\nContext:\n${opts.context}` : ""}`;
  const text = await aiChat(prompt, system);
  const subjectMatch = text.match(/^Subject:\s*(.+)/i);
  const subject = subjectMatch ? subjectMatch[1].trim() : "";
  const body = text.replace(/^Subject:.*\n?/i, "").trim();
  return { subject, body };
}

export async function aiImproveTone(text: string, tone: "professional" | "casual" | "cold") {
  const system = `Rewrite the given email in a ${tone} tone. Preserve intent and facts. Return only the rewritten body, no subject, no preamble.`;
  return aiChat(text, system);
}

export async function aiComplete(text: string) {
  const system = `You are an autocomplete engine for email writing. Continue the user's draft naturally in 1-2 short sentences. Return only the continuation.`;
  return aiChat(text, system);
}

export type Triage = "high" | "low" | "cold";
export async function aiTriage(subject: string, from: string, snippet: string): Promise<Triage> {
  const system = `Classify emails into exactly one label: high, low, or cold.
- high: needs the user's timely attention (people they know, direct questions, deadlines, work)
- low: newsletters, notifications, receipts, promotional
- cold: unsolicited cold outreach / sales pitches from strangers
Respond with ONLY the label word.`;
  const prompt = `From: ${from}\nSubject: ${subject}\nSnippet: ${snippet}`;
  const raw = (await aiChat(prompt, system)).toLowerCase();
  if (raw.includes("high")) return "high";
  if (raw.includes("cold")) return "cold";
  return "low";
}

export type AssistantAction =
  | { type: "star"; ids: string[] }
  | { type: "unstar"; ids: string[] }
  | { type: "archive"; ids: string[] }
  | { type: "trash"; ids: string[] }
  | { type: "markRead"; ids: string[] }
  | { type: "markUnread"; ids: string[] }
  | { type: "label"; ids: string[]; labelName: string }
  | { type: "search"; query: string }
  | { type: "compose"; to: string; subject: string; body: string }
  | { type: "schedule"; to: string; subject: string; body: string; delayMs: number; when: string };

export interface AssistantPlan {
  reply: string;
  actions: AssistantAction[];
}

type Ctx = { id: string; from: string; subject: string; snippet: string; starred: boolean; unread: boolean };

const WORD_NUM: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, fifty: 50,
};

const VERB_MAP: { re: RegExp; type: AssistantAction["type"] }[] = [
  { re: /\b(un-?star|remove (the )?stars?)\b/i, type: "unstar" },
  { re: /\b(star|favorite|flag)\b/i, type: "star" },
  { re: /\b(archive)\b/i, type: "archive" },
  { re: /\b(trash|delete|bin)\b/i, type: "trash" },
  { re: /\bmark(ed)?\s+.*\bunread\b/i, type: "markUnread" },
  { re: /\bmark(ed)?\s+.*\bread\b/i, type: "markRead" },
];

/** Deterministic parser for the common "<verb> the first N messages" family. */
function localPlan(command: string, context: Ctx[]): AssistantPlan | null {
  const cmd = command.trim();
  if (!cmd || !context.length) return null;

  const verb = VERB_MAP.find((v) => v.re.test(cmd));
  if (!verb) return null;
  if (/\bfrom\b|\bsubject\b|\bwith\b|\bcontain|\babout\b|\bnewsletter|\bsender\b/i.test(cmd)) return null;

  const numMatch = cmd.match(/\b(\d{1,3})\b/);
  const wordMatch = cmd.match(
    /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|fifty)\b/i,
  );
  const isAll = /\b(all|every|everything)\b/i.test(cmd);
  let n = numMatch ? parseInt(numMatch[1], 10) : wordMatch ? WORD_NUM[wordMatch[1].toLowerCase()] : isAll ? context.length : NaN;
  if (!Number.isFinite(n) || n <= 0) return null;
  n = Math.min(n, context.length);

  const fromEnd = /\b(last|oldest|bottom)\b/i.test(cmd);
  const slice = fromEnd ? context.slice(-n) : context.slice(0, n);
  const ids = slice.map((m) => m.id);

  return {
    reply: `${verb.type} ${ids.length} ${fromEnd ? "oldest" : "newest"} message${ids.length === 1 ? "" : "s"}.`,
    actions: [{ type: verb.type, ids } as AssistantAction],
  };
}

export async function aiPlanActions(
  command: string,
  context: Ctx[],
  labels: string[],
): Promise<AssistantPlan> {
  const local = localPlan(command, context);
  if (local) return local;

  const system = `You are an email operations assistant for a Gmail client.
Return ONLY compact JSON: {"reply": string, "actions": Action[]}

Messages are referenced by their 1-based POSITION NUMBER in the list, never by id.
Action variants:
{"type":"star","n":[1,2,3]}
{"type":"unstar","n":[...]}
{"type":"archive","n":[...]}
{"type":"trash","n":[...]}
{"type":"markRead","n":[...]}
{"type":"markUnread","n":[...]}
{"type":"label","n":[...],"labelName":string}
{"type":"search","query":string}
{"type":"compose","to":string,"subject":string,"body":string}
{"type":"schedule","to":string,"subject":string,"body":string,"delayMs":number,"when":string}

Rules:
- "first N"/"top N" = positions 1..N. "last N" = the final N positions. "all" = every position.
- If the user asks for N messages you MUST output exactly N position numbers (unless the list is shorter).
- Only use positions that exist (1..${context.length}).
- Dates like 10/26/25 or "before Oct 26" -> single {"type":"search","query":"before:YYYY/MM/DD"}.
- A range like 10/26/25-10/26/24 -> {"type":"search","query":"before:2025/10/26 after:2024/10/26"}.
- If the user wants an email SENT LATER ("send X in 10 minutes", "email bob in an hour"), emit a single
  {"type":"schedule"} action: write the full subject and body yourself, set "delayMs" to the delay in
  milliseconds, and "when" to a human phrase like "in 10 minutes".
- "reply" is one short sentence. Return valid JSON only, no markdown fences.`;

  const list = context
    .map(
      (m, i) =>
        `${i + 1}. from="${m.from}" subject="${m.subject}" starred=${m.starred} unread=${m.unread}`,
    )
    .join("\n");
  const prompt = `Available labels: ${labels.join(", ") || "(none)"}
Messages (${context.length} total, newest first):
${list || "(empty)"}

User command: ${command}`;

  const raw = await aiChat(prompt, system);
  const cleaned = raw.replace(/```json|```/g, "").trim();
  const jsonStart = cleaned.indexOf("{");
  const jsonEnd = cleaned.lastIndexOf("}");
  const slice = jsonStart >= 0 ? cleaned.slice(jsonStart, jsonEnd + 1) : cleaned;

  let parsed: any;
  try {
    parsed = JSON.parse(slice);
  } catch {
    return { reply: "I couldn't parse a plan. Please rephrase.", actions: [] };
  }

  const requested = (() => {
    const m = command.match(/\b(\d{1,3})\b/);
    const w = command.match(
      /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|fifty)\b/i,
    );
    if (m) return Math.min(parseInt(m[1], 10), context.length);
    if (w) return Math.min(WORD_NUM[w[1].toLowerCase()], context.length);
    if (/\b(all|every|everything)\b/i.test(command)) return context.length;
    return 0;
  })();
  const wantsLast = /\b(last|oldest|bottom)\b/i.test(command);

  const actions: AssistantAction[] = [];
  for (const a of Array.isArray(parsed.actions) ? parsed.actions : []) {
    if (!a || typeof a.type !== "string") continue;
    if (a.type === "search" || a.type === "compose" || a.type === "schedule") {
      actions.push(a as AssistantAction);
      continue;
    }
    const nums: number[] = Array.isArray(a.n) ? a.n : Array.isArray(a.indexes) ? a.indexes : [];
    let idxs = Array.from(
      new Set(
        nums
          .map((x: any) => Number(x))
          .filter((x: number) => Number.isFinite(x) && x >= 1 && x <= context.length)
          .map((x: number) => x - 1),
      ),
    );
    // Enforce the count the user explicitly asked for.
    if (requested > 0 && idxs.length !== requested) {
      idxs = wantsLast
        ? context.slice(-requested).map((_, i) => context.length - requested + i)
        : context.slice(0, requested).map((_, i) => i);
    }
    let ids = idxs.map((i) => context[i].id);
    // Fall back to ids if the model returned raw ids anyway.
    if (!ids.length && Array.isArray(a.ids)) {
      const known = new Set(context.map((m) => m.id));
      ids = a.ids.filter((id: string) => known.has(id));
    }
    if (!ids.length) continue;
    actions.push(a.type === "label" ? { type: "label", ids, labelName: String(a.labelName || "New folder") } : ({ type: a.type, ids } as AssistantAction));
  }

  return { reply: typeof parsed.reply === "string" ? parsed.reply : "", actions };
}

export async function aiSummarize(subject: string, from: string, body: string) {
  const system = `Summarize the email in at most 3 crisp bullet points, then a line starting with "Action:" stating what the reader should do (or "Action: none").`;
  return aiChat(`From: ${from}\nSubject: ${subject}\n\n${body.slice(0, 6000)}`, system);
}

export async function aiSmartReplies(subject: string, from: string, body: string): Promise<string[]> {
  const system = `Suggest exactly 3 short reply options (max 12 words each) for this email. Return them one per line, no numbering, no quotes.`;
  const raw = await aiChat(`From: ${from}\nSubject: ${subject}\n\n${body.slice(0, 4000)}`, system);
  return raw.split("\n").map((s) => s.replace(/^[-*\d.\s]+/, "").trim()).filter(Boolean).slice(0, 3);
}

export async function aiDigest(
  items: { from: string; subject: string; snippet: string }[],
): Promise<string> {
  const system = `You write a tight daily inbox digest. Group by theme, note anything urgent first, max 8 bullets. Plain text, no preamble.`;
  const list = items
    .map((m, i) => `${i + 1}. from=${m.from} | ${m.subject} | ${m.snippet}`)
    .join("\n");
  return aiChat(`Here are my recent emails:\n${list}`, system);
}



/** AI Action Extractor — pulls tasks, dates and commitments out of an email. */
export async function aiExtractTasks(subject: string, from: string, body: string): Promise<string> {
  const system = `Extract every concrete task, deadline, meeting and commitment from this email.
Output a plain list, one per line, formatted "• <task> — <due/when or 'no date'>".
If there is nothing actionable, output exactly "No action items.". No preamble.`;
  return aiChat(`From: ${from}\nSubject: ${subject}\n\n${body.slice(0, 6000)}`, system);
}

/** AI Follow-up Radar — finds loaded messages that are still waiting on your reply. */
export async function aiFollowUpRadar(
  items: { from: string; subject: string; snippet: string }[],
): Promise<string> {
  const system = `You are a follow-up radar. Given a list of emails, identify only the ones that appear to be
waiting on the reader's reply or action, ordered most urgent first. For each, output
"<n>. <sender> — <subject> — why it needs a reply (max 12 words)".
If none need a reply, output exactly "Nothing is waiting on you.". No preamble.`;
  const list = items.map((m, i) => `${i + 1}. from=${m.from} | ${m.subject} | ${m.snippet}`).join("\n");
  return aiChat(list, system);
}

/** AI Unsubscribe Scout — spots recurring senders worth unsubscribing from. */
export async function aiUnsubscribeScout(
  items: { from: string; subject: string; snippet: string }[],
): Promise<string> {
  const system = `You review an inbox for subscription noise. List the senders that are clearly newsletters,
promotions or automated marketing, with how many of their messages appear and a one-line verdict:
"<sender> — <count> msgs — <keep / unsubscribe> — <reason, max 10 words>".
If the inbox is clean, output exactly "No subscription noise found.". No preamble.`;
  const list = items.map((m) => `from=${m.from} | ${m.subject} | ${m.snippet}`).join("\n");
  return aiChat(list, system);
}

/** Drafts a subject+body for a scheduled send from a short intent. */
export async function aiDraftScheduled(intent: string, to: string) {
  return aiWriteEmail({ intent: `Email to ${to}: ${intent}`, tone: "professional" });
}

/* ------------------------------------------------------------------ */
/* Efficiency: batch triage — one round-trip instead of N.             */
/* ------------------------------------------------------------------ */
export async function aiTriageBatch(
  items: { id: string; from: string; subject: string; snippet: string }[],
): Promise<Record<string, Triage>> {
  if (!items.length) return {};
  const system = `Classify each email into exactly one label: high, low, or cold.
- high: needs timely attention (real people, direct questions, deadlines, work, money)
- low: newsletters, notifications, receipts, promos
- cold: unsolicited cold outreach or sales pitches from strangers
Return ONLY lines of the form "<number>:<label>", one per input email, no other text.`;
  const list = items
    .map((m, i) => `${i + 1}. from=${m.from} | subject=${m.subject} | ${m.snippet.slice(0, 140)}`)
    .join("\n");
  const raw = await aiChat(list, system);
  const out: Record<string, Triage> = {};
  for (const line of raw.split("\n")) {
    const m = line.match(/(\d{1,3})\s*[:.\-]\s*(high|low|cold)/i);
    if (!m) continue;
    const item = items[parseInt(m[1], 10) - 1];
    if (item) out[item.id] = m[2].toLowerCase() as Triage;
  }
  return out;
}

/** AI Translate — render an email in another language. */
export async function aiTranslate(subject: string, body: string, language: string) {
  const system = `Translate the email into ${language}. Keep formatting and tone. Output the translated subject on the first line prefixed "Subject: ", then a blank line, then the body. No commentary.`;
  return aiChat(`Subject: ${subject}\n\n${body.slice(0, 6000)}`, system);
}

/** AI Tone & Intent Read — how the sender actually feels and what they want. */
export async function aiToneRead(subject: string, from: string, body: string) {
  const system = `Analyse the sender's tone and intent. Output exactly these four lines, nothing else:
Tone: <2-4 words>
Urgency: <low | medium | high>
Real ask: <one sentence>
Risk: <what happens if ignored, one short sentence>`;
  return aiChat(`From: ${from}\nSubject: ${subject}\n\n${body.slice(0, 6000)}`, system);
}

/** AI Meeting Extractor — pulls a calendar-ready event out of an email. */
export async function aiMeetingExtract(subject: string, from: string, body: string) {
  const system = `Find any proposed meeting, call or event in this email.
If found, output exactly:
Title: <title>
When: <date and time as written, plus timezone if stated>
Where: <location or link, or "not stated">
With: <attendees>
Prep: <one line of what to prepare>
If there is no meeting, output exactly "No meeting found.". No preamble.`;
  return aiChat(`From: ${from}\nSubject: ${subject}\n\n${body.slice(0, 6000)}`, system);
}

/** AI Priority Sort — rank what to open first across the loaded inbox. */
export async function aiPrioritySort(
  items: { from: string; subject: string; snippet: string }[],
): Promise<string> {
  const system = `Rank these emails by what the reader should handle first.
Output at most 8 lines: "<rank>. <sender> — <subject> — <why, max 10 words>".
Ignore anything not worth opening today. No preamble.`;
  const list = items.map((m, i) => `${i + 1}. from=${m.from} | ${m.subject} | ${m.snippet}`).join("\n");
  return aiChat(list, system);
}

/** AI Attachment Brief — explains what the files in an email are and what to do with them. */
export async function aiAttachmentBrief(
  subject: string,
  from: string,
  files: { filename: string; mimeType: string; size: number }[],
) {
  if (!files.length) return "No attachments.";
  const system = `Given an email and its attachment filenames, explain in at most 4 lines what these files most
likely are, which one matters most, and the single action the reader should take. Plain text, no preamble.`;
  const list = files.map((f) => `${f.filename} (${f.mimeType}, ${f.size} bytes)`).join("\n");
  return aiChat(`From: ${from}\nSubject: ${subject}\nAttachments:\n${list}`, system);
}

/** AI Security Check — flags phishing, spoofing and social-engineering cues in one email. */
export async function aiSecurityCheck(subject: string, from: string, body: string) {
  const system = `You are an email security analyst. Judge whether this message looks like phishing, spoofing,
invoice fraud or social engineering.
Output exactly:
Verdict: Safe | Suspicious | Dangerous
Signals: <up to 3 short bullets of concrete evidence>
Do: <one line telling the reader what to do>
No preamble.`;
  return aiChat(`From: ${from}\nSubject: ${subject}\n\n${body.slice(0, 6000)}`, system);
}

/** AI Sender Brief — who this person is and how you've dealt with them. */
export async function aiSenderBrief(from: string, items: { subject: string; snippet: string }[]) {
  const system = `Given every loaded email from one sender, write a short profile.
Output exactly:
Who: <one line>
They usually want: <one line>
Open loops: <up to 3 short bullets, or "None">
Suggested stance: <one line>
No preamble.`;
  const list = items.slice(0, 20).map((m, i) => `${i + 1}. ${m.subject} — ${m.snippet}`).join("\n");
  return aiChat(`Sender: ${from}\n\n${list}`, system);
}

/** AI Cleanup Plan — a concrete plan for getting the visible inbox to zero. */
export async function aiCleanupPlan(items: { from: string; subject: string; snippet: string }[]) {
  const system = `You are an inbox cleanup planner. Given the emails in view, propose a concrete plan.
Output exactly three sections, each with short bullets:
Archive now:
Reply today:
Unsubscribe or trash:
Reference senders and subjects. Maximum 12 bullets total. No preamble.`;
  const list = items.map((m, i) => `${i + 1}. from=${m.from} | ${m.subject} | ${m.snippet}`).join("\n");
  return aiChat(list, system);
}

/* ------------------------------------------------------------------ */
/* Natural-language email finder                                       */
/* ------------------------------------------------------------------ */

const NL_HINT =
  /\b(find|show|get|search for|look for|who|what|emails? (from|about|with)|my|all|oldest|newest|latest|last week|last month|yesterday|today|unread|attachment|bigger|larger|recent)\b/i;

/** Heuristic: is the user talking to the AI, or typing a raw query? */
export function looksNaturalLanguage(input: string): boolean {
  const q = input.trim();
  if (!q) return false;
  // Raw Gmail operators or a bare date/range => plain search.
  if (/\b(from|to|subject|label|has|before|after|older_than|newer_than|is|in|filename):/i.test(q)) return false;
  if (/^\s*[\d/.-]+\s*$/.test(q)) return false;
  return q.split(/\s+/).length >= 3 && NL_HINT.test(q);
}

/** Turns "find my oldest emails from spotify" into a real Gmail search query. */
export async function aiNaturalSearch(
  request: string,
  labels: string[] = [],
): Promise<{ query: string; sort: "date" | "oldest" | "sender"; explain: string }> {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "/");
  const system = `You convert natural language into Gmail search queries.
Today is ${today}. Available user labels: ${labels.join(", ") || "(none)"}.
Return ONLY compact JSON: {"query": string, "sort": "date"|"oldest"|"sender", "explain": string}
Rules:
- Use real Gmail operators: from:, to:, subject:, label:, in:, is:unread, is:starred, has:attachment,
  before:YYYY/MM/DD, after:YYYY/MM/DD, older_than:7d, newer_than:1m, larger:5M.
- "oldest" requests -> set "sort":"oldest" (and no date operator unless one was named).
- "from spotify" -> from:spotify. "in my inbox" -> in:inbox.
- Keep the query short; never invent senders that were not mentioned.
- "explain" is a max-8-word description of the filter. No markdown fences.`;
  const raw = await aiChat(request, system);
  const cleaned = raw.replace(/```json|```/g, "").trim();
  const s = cleaned.indexOf("{");
  const e = cleaned.lastIndexOf("}");
  try {
    const p = JSON.parse(s >= 0 ? cleaned.slice(s, e + 1) : cleaned);
    return {
      query: String(p.query || "").trim(),
      sort: p.sort === "oldest" || p.sort === "sender" ? p.sort : "date",
      explain: String(p.explain || "").trim(),
    };
  } catch {
    return { query: request, sort: "date", explain: "" };
  }
}

/** AI Reply Draft — writes a full, ready-to-send reply to the open email. */
export async function aiReplyDraft(subject: string, from: string, body: string) {
  const system = `Write a complete reply to the email below. Match the sender's register, stay concise and
specific, answer every question asked, and end with a clear next step. Return ONLY the reply body — no
subject line, no greeting placeholders like [Name], no preamble.`;
  return aiChat(`From: ${from}\nSubject: ${subject}\n\n${body.slice(0, 6000)}`, system);
}

/** AI VIP Radar — finds the people who actually matter in the loaded inbox. */
export async function aiVipScan(items: { from: string; subject: string; snippet: string }[]) {
  const system = `Identify the senders that look like real, important humans (colleagues, clients, family,
recruiters, money) as opposed to automated mail. Output at most 8 lines:
"<sender> — <why they matter, max 10 words>". If none, output exactly "No VIP senders in view.". No preamble.`;
  return aiChat(items.map((m) => `from=${m.from} | ${m.subject} | ${m.snippet}`).join("\n"), system);
}

/** AI Inbox Report — a stats-style read on the mail currently loaded. */
export async function aiInboxReport(items: { from: string; subject: string; snippet: string }[]) {
  const system = `Write a short analytics-style report on this inbox. Output exactly these sections, one short
line or up to 3 bullets each:
Volume:
Top senders:
Themes:
Time sinks:
Recommendation:
No preamble.`;
  return aiChat(items.map((m, i) => `${i + 1}. from=${m.from} | ${m.subject} | ${m.snippet}`).join("\n"), system);
}

/* ------------------------------------------------------------------ */
/* Extra inbox-level intelligence                                      */
/* ------------------------------------------------------------------ */

type Item = { from: string; subject: string; snippet: string };
const listOf = (items: Item[]) =>
  items.map((m, i) => `${i + 1}. from=${m.from} | ${m.subject} | ${m.snippet}`).join("\n");

/** Promises you made and are still on the hook for. */
export async function aiCommitments(items: Item[]) {
  const system = `Find every commitment the USER appears to owe someone based on these emails.
Output up to 8 lines: "<what you owe> — <to whom> — <due or 'no date'>".
If nothing, output exactly "No outstanding commitments in view.". No preamble.`;
  return aiChat(listOf(items), system);
}

/** Money view: receipts, invoices, subscriptions. */
export async function aiSpendScan(items: Item[]) {
  const system = `Extract every receipt, invoice, subscription, renewal or charge mentioned.
Output exactly:
Charges:
<merchant — amount — date, up to 8 bullets>
Recurring:
<subscriptions you seem to pay for>
Watch out:
<one line: renewals or unusual amounts>
If nothing financial, say "No billing mail in view.". No preamble.`;
  return aiChat(listOf(items), system);
}

/** Travel board: flights, hotels, reservations. */
export async function aiTravelBoard(items: Item[]) {
  const system = `Build a travel itinerary from these emails: flights, hotels, trains, restaurant or event bookings.
Output chronological lines: "<date> — <what> — <time/place> — <confirmation code if any>".
If none, output exactly "No travel bookings in view.". No preamble.`;
  return aiChat(listOf(items), system);
}

/** Every date and deadline across the inbox. */
export async function aiDeadlineBoard(items: Item[]) {
  const system = `Extract every deadline, due date and scheduled event mentioned across these emails.
Output chronological lines: "<date/when> — <what> — <who's waiting>". Max 12 lines.
If none, output exactly "No deadlines in view.". No preamble.`;
  return aiChat(listOf(items), system);
}

/** Relationships going quiet. */
export async function aiRelationshipPulse(items: Item[]) {
  const system = `Judge the health of the user's email relationships from these messages.
Output exactly:
Warm: <people actively engaged, max 4>
Cooling: <people who wrote and got no reply, max 4>
Reconnect: <one line suggestion>
No preamble.`;
  return aiChat(listOf(items), system);
}

/** Suggested folders / labels for the mail in view. */
export async function aiSmartFolders(items: Item[]) {
  const system = `Propose 4-6 folders (labels) that would organise this inbox well.
Output lines: "<Folder name> — <what goes in it> — <example sender or subject>". No preamble.`;
  return aiChat(listOf(items), system);
}

/** Auto-rule builder: Gmail-style filters described in plain language. */
export async function aiRuleBuilder(items: Item[]) {
  const system = `Propose up to 6 automatic mail rules that would cut this inbox's noise.
Output lines: "IF <condition using from:/subject:/has:> THEN <archive | label X | mark read | trash>".
Only propose rules that are safe and obviously correct. No preamble.`;
  return aiChat(listOf(items), system);
}

/** A time-blocked plan for clearing what's in view. */
export async function aiDailyPlan(items: Item[]) {
  const system = `Turn this inbox into a time-blocked plan for today.
Output 4-6 lines: "<time block> — <task> — <est. minutes>". Start with the highest-leverage work. No preamble.`;
  return aiChat(listOf(items), system);
}

/** Detect duplicate / near-duplicate threads and clutter clusters. */
export async function aiDuplicateScan(items: Item[]) {
  const system = `Group these emails into clusters of duplicates, resends, and repeated notification chains.
Output lines: "<cluster name> — <count> — <keep which one>". If nothing repeats, say "No duplicate clusters in view.". No preamble.`;
  return aiChat(listOf(items), system);
}

/* ------------------------------------------------------------------ */
/* Extra reader-level intelligence                                     */
/* ------------------------------------------------------------------ */

const mailOf = (subject: string, from: string, body: string) =>
  `From: ${from}\nSubject: ${subject}\n\n${body.slice(0, 6000)}`;

/** Timeline of what happened in this thread. */
export async function aiThreadTimeline(subject: string, from: string, body: string) {
  const system = `Reconstruct this thread as a timeline. Output up to 8 lines: "<who> — <what they said/decided>".
End with a final line "Now: <what is waiting on the user>". No preamble.`;
  return aiChat(mailOf(subject, from, body), system);
}

/** Plain-English explainer for jargon-heavy or legal mail. */
export async function aiExplainSimply(subject: string, from: string, body: string) {
  const system = `Explain this email to a smart person with zero context, in plain English.
Output exactly:
In short: <one sentence>
What it means: <up to 3 bullets, no jargon>
Terms: <define any jargon or legal terms used, max 3>
No preamble.`;
  return aiChat(mailOf(subject, from, body), system);
}

/** Three replies in three registers. */
export async function aiToneVariants(subject: string, from: string, body: string) {
  const system = `Write three complete replies to this email, in three registers.
Output exactly:
Warm:
<reply>

Direct:
<reply>

Firm:
<reply>
Each 2-4 sentences. No preamble.`;
  return aiChat(mailOf(subject, from, body), system);
}

/** Negotiation / counter-proposal helper. */
export async function aiCounterProposal(subject: string, from: string, body: string) {
  const system = `Treat this email as a proposal or ask. Help the user respond strategically.
Output exactly:
Their ask: <one line>
Their leverage: <one line>
Your leverage: <one line>
Counter: <a ready-to-send 3-sentence counter-proposal>
No preamble.`;
  return aiChat(mailOf(subject, from, body), system);
}

/** A graceful decline. */
export async function aiPoliteDecline(subject: string, from: string, body: string) {
  const system = `Write a warm, short, unambiguous decline to this email. Keep the door open without promising anything.
Return only the reply body. No preamble.`;
  return aiChat(mailOf(subject, from, body), system);
}

/** Calendar-ready ICS text for any event in the email. */
export async function aiCalendarDraft(subject: string, from: string, body: string) {
  const system = `Find the event in this email and output a valid iCalendar VEVENT block only:
BEGIN:VCALENDAR ... END:VCALENDAR with SUMMARY, DTSTART, DTEND, LOCATION and DESCRIPTION.
Use UTC (Z) timestamps. If no event exists, output exactly "No event found in this email.". No preamble or code fences.`;
  return aiChat(mailOf(subject, from, body), system);
}

/** Contacts and identifiers mentioned in the email. */
export async function aiExtractContacts(subject: string, from: string, body: string) {
  const system = `Extract every person, company, email address, phone number, link and reference number in this email.
Output grouped lines under People:, Companies:, Contacts:, Links:, Refs:. Skip empty groups. No preamble.`;
  return aiChat(mailOf(subject, from, body), system);
}

/* ------------------------------------------------------------------ */
/* Additional inbox-level intelligence                                 */
/* ------------------------------------------------------------------ */

export async function aiWaitingOnThem(items: Item[]) {
  const system = `List the threads where YOU already replied and the other person still owes you something.
Output lines: "<person> — <what they owe> — <how long it's been>". End with one nudge you could send today. No preamble.`;
  return aiChat(listOf(items), system);
}

export async function aiWeeklyRecap(items: Item[]) {
  const system = `Write a weekly recap of this mail: what happened, what moved, what stalled, and the 3 things to carry into next week.
Use headers WHAT HAPPENED / STALLED / NEXT WEEK. Short lines. No preamble.`;
  return aiChat(listOf(items), system);
}

export async function aiInboxRiskScan(items: Item[]) {
  const system = `Sweep these emails for phishing, spoofed senders, invoice fraud and suspicious links.
Output lines: "<sender> — <risk: high/medium/low> — <why> — <what to do>". Only include anything not clearly safe. If all clean, say "Nothing suspicious in view.". No preamble.`;
  return aiChat(listOf(items), system);
}

export async function aiOpportunityFinder(items: Item[]) {
  const system = `Find the opportunities hiding in this mail: warm intros, potential deals, partnerships, invitations and referrals.
Output lines: "<sender> — <opportunity> — <the one move to make>". If none, say "No clear opportunities in view.". No preamble.`;
  return aiChat(listOf(items), system);
}

/* ------------------------------------------------------------------ */
/* Additional reader-level intelligence                                */
/* ------------------------------------------------------------------ */

export async function aiFactCheck(subject: string, from: string, body: string) {
  const system = `List every factual claim, number, date and promise in this email, and flag which ones you should verify before acting.
Output lines: "<claim> — <verify: yes/no> — <how to check>". No preamble.`;
  return aiChat(mailOf(subject, from, body), system);
}

export async function aiContractRisk(subject: string, from: string, body: string) {
  const system = `Review this email (and any terms in it) for risky language: liability, indemnity, auto-renewal, exclusivity, deadlines, payment terms.
Output lines: "<clause/phrase> — <risk> — <suggested edit>". If nothing risky, say "No risky terms found.". No preamble.`;
  return aiChat(mailOf(subject, from, body), system);
}

export async function aiForwardBlurb(subject: string, from: string, body: string) {
  const system = `Write a short forwarding note for this email: 2 sentences of context plus a clear ask for the person you're forwarding it to. Return only the note. No preamble.`;
  return aiChat(mailOf(subject, from, body), system);
}

export async function aiClarifyingQuestions(subject: string, from: string, body: string) {
  const system = `List the 3-5 clarifying questions worth sending back before you act on this email, ordered by how much they unblock you.
Numbered lines, one question each. No preamble.`;
  return aiChat(mailOf(subject, from, body), system);
}

/* ------------------------------------------------------------------ */
/* Newest inbox + reader intelligence                                  */
/* ------------------------------------------------------------------ */

/** One readable brief across every newsletter in view. */
export async function aiNewsletterDigest(items: Item[]) {
  const system = `From these emails, take only the newsletters, digests and automated updates and merge them into one short read.
Output 4-7 bullets of "<topic> — <what's new> — <source>", then a final line "Skip: <senders not worth reading>". No preamble.`;
  return aiChat(listOf(items), system);
}

/** Suggests a category for each message so bulk filing is one pass. */
export async function aiBulkCategorize(items: Item[]) {
  const system = `Assign each email exactly one category from: Work, Money, Travel, Personal, Newsletter, Promo, Notification, Spam.
Output lines: "<sender> — <subject, trimmed> — <category>". No preamble.`;
  return aiChat(listOf(items), system);
}

/** Who you are slow to answer, and what it's costing. */
export async function aiResponseCoach(items: Item[]) {
  const system = `Judge this mail as a responsiveness coach. Identify who is waiting longest, which threads are going stale, and where slow replies are costing the user.
Output lines: "<person/thread> — <how stale> — <risk> — <reply today? yes/no>". End with "Today: <the 3 to answer first>". No preamble.`;
  return aiChat(listOf(items), system);
}

/** An index of files that arrived in the mail in view. */
export async function aiAttachmentIndex(items: Item[]) {
  const system = `Find every email that appears to carry a document, invoice, contract, image or file (based on subject and snippet).
Output lines: "<sender> — <likely file/document> — <why it matters> — <keep or discard>". If none, say "No documents in view.". No preamble.`;
  return aiChat(listOf(items), system);
}

/** A do-this-next checklist for one email. */
export async function aiChecklist(subject: string, from: string, body: string) {
  const system = `Turn this email into a do-next checklist.
Output numbered steps, each "<action> — <owner> — <when>". Max 6 steps, concrete verbs only. No preamble.`;
  return aiChat(mailOf(subject, from, body), system);
}

/** Pre-empt pushback before you send a reply. */
export async function aiObjections(subject: string, from: string, body: string) {
  const system = `You are prepping the user's reply to this email. List the objections or pushback the sender is most likely to raise, and how to defuse each.
Output lines: "<likely objection> — <your answer>". Max 5. No preamble.`;
  return aiChat(mailOf(subject, from, body), system);
}

/** Reply written in the sender's own language. */
export async function aiReplyInLanguage(subject: string, from: string, body: string) {
  const system = `Detect the language this email is written in and write a complete, natural reply in that same language.
Start with a line "Language: <name>", then a blank line, then only the reply body. No preamble.`;
  return aiChat(mailOf(subject, from, body), system);
}

/** What to snooze and until when, so the inbox only shows what's live today. */
export async function aiSnoozePlan(items: Item[]) {
  const system = `Decide what should leave the inbox now and come back later.
For each email that is not actionable today, output "<sender> — <subject, trimmed> — snooze until <specific day or date> — <why>".
Skip anything genuinely due today. End with "Stay: <count> emails still need you today.".`;
  return aiChat(listOf(items), system);
}

/** One-line executive brief: the decision this email demands. */
export async function aiDecisionBrief(subject: string, from: string, body: string) {
  const system = `Reduce this email to the decision it demands.
Output exactly these lines:
TL;DR: <one sentence>
Decision: <the choice you must make, or "None — FYI only">
Deadline: <date or "none stated">
If you ignore it: <consequence>
Recommended: <the single move to make>`;
  return aiChat(mailOf(subject, from, body), system);
}
