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
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(key)}`,
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
  | { type: "compose"; to: string; subject: string; body: string };

export interface AssistantPlan {
  reply: string;
  actions: AssistantAction[];
}

export async function aiPlanActions(
  command: string,
  context: { id: string; from: string; subject: string; snippet: string; starred: boolean; unread: boolean }[],
  labels: string[],
): Promise<AssistantPlan> {
  const system = `You are an email operations assistant for a Gmail client.
Return ONLY compact JSON: {"reply": string, "actions": Action[]}
Action variants:
{"type":"star","ids":[string]}
{"type":"unstar","ids":[string]}
{"type":"archive","ids":[string]}
{"type":"trash","ids":[string]}
{"type":"markRead","ids":[string]}
{"type":"markUnread","ids":[string]}
{"type":"label","ids":[string],"labelName":string}
{"type":"search","query":string}
{"type":"compose","to":string,"subject":string,"body":string}

Rules:
- Use ONLY ids from the provided list. Never invent ids.
- "first N" = first N messages of the list (already sorted newest first).
- Dates like 10/26/25 or "before Oct 26" -> single {"type":"search","query":"before:YYYY/MM/DD"}.
- "reply" is one short sentence. Return valid JSON only, no markdown fences.`;

  const list = context
    .map(
      (m, i) =>
        `${i + 1}. id=${m.id} from="${m.from}" subject="${m.subject}" starred=${m.starred} unread=${m.unread}`,
    )
    .join("\n");
  const prompt = `Available labels: ${labels.join(", ") || "(none)"}
Current message list (newest first):
${list || "(empty)"}

User command: ${command}`;

  const raw = await aiChat(prompt, system);
  const cleaned = raw.replace(/```json|```/g, "").trim();
  const jsonStart = cleaned.indexOf("{");
  const jsonEnd = cleaned.lastIndexOf("}");
  const slice = jsonStart >= 0 ? cleaned.slice(jsonStart, jsonEnd + 1) : cleaned;
  try {
    const parsed = JSON.parse(slice);
    if (!Array.isArray(parsed.actions)) parsed.actions = [];
    if (typeof parsed.reply !== "string") parsed.reply = "";
    return parsed as AssistantPlan;
  } catch {
    return { reply: "I couldn't parse a plan. Please rephrase.", actions: [] };
  }
}

