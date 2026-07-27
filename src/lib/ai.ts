import { settingsStore } from "./store";
import { lovableAiChat } from "./ai.functions";

export async function aiChat(prompt: string, system = ""): Promise<string> {
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


