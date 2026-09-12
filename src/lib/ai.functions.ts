import { createServerFn } from "@tanstack/react-start";

const MAX_PROMPT = 60_000;
const MAX_SYSTEM = 20_000;

export const lovableAiChat = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    const d = data as { system?: string; prompt?: string; accessToken?: string };
    if (!d || typeof d.prompt !== "string" || !d.prompt.trim()) throw new Error("prompt required");
    if (typeof d.accessToken !== "string") throw new Error("Unauthorized");
    if (d.prompt.length > MAX_PROMPT) throw new Error("Request too large");
    const system = typeof d.system === "string" ? d.system.slice(0, MAX_SYSTEM) : "";
    return { system, prompt: d.prompt, accessToken: d.accessToken };
  })
  .handler(async ({ data }) => {
    const { verifyGoogleCaller, rateLimit } = await import("./auth.server");
    const { sub } = await verifyGoogleCaller(data.accessToken);
    rateLimit(`ai:${sub}`, 30, 60_000);

    const key = process.env['LOVABLE_API_KEY'];
    if (!key) throw new Error("AI is not configured.");

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
      },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages: [
          ...(data.system ? [{ role: "system", content: data.system }] : []),
          { role: "user", content: data.prompt },
        ],
      }),
    });

    if (!r.ok) {
      // Never leak upstream response bodies to the browser.
      if (r.status === 429) throw new Error("AI is busy right now. Try again in a moment.");
      if (r.status === 402 || r.status === 403) throw new Error("AI credits are unavailable for this workspace.");
      throw new Error("AI request failed. Please try again.");
    }

    const j = (await r.json()) as { choices?: { message?: { content?: string } }[] };
    return { text: j.choices?.[0]?.message?.content ?? "" };
  });
