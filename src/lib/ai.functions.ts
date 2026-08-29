import { createServerFn } from "@tanstack/react-start";

export const lovableAiChat = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    const d = data as { system?: string; prompt: string };
    if (!d || typeof d.prompt !== "string") throw new Error("prompt required");
    return { system: d.system || "", prompt: d.prompt };
  })
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY missing");
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
      },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-lite",
        messages: [
          ...(data.system ? [{ role: "system", content: data.system }] : []),
          { role: "user", content: data.prompt },
        ],
      }),
    });
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      throw new Error(`AI gateway ${r.status}: ${t}`);
    }
    const j = (await r.json()) as any;
    return { text: j.choices?.[0]?.message?.content ?? "" };
  });
