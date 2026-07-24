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
