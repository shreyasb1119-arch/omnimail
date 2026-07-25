import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send, Sparkles, CheckCircle2, AlertCircle } from "lucide-react";
import { aiPlanActions, type AssistantAction, type AssistantPlan } from "@/lib/ai";
import type { ParsedMessage } from "@/lib/gmail";

interface Turn {
  role: "user" | "assistant";
  text: string;
  plan?: AssistantPlan;
  status?: "pending" | "executing" | "done" | "error";
  error?: string;
}

export function AiAssistant({
  open,
  onOpenChange,
  messages,
  labelNames,
  onExecute,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  messages: ParsedMessage[];
  labelNames: string[];
  onExecute: (actions: AssistantAction[]) => Promise<{ ok: number; failed: number; summary: string }>;
}) {
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const cmd = input.trim();
    if (!cmd || busy) return;
    setInput("");
    setBusy(true);
    setTurns((t) => [...t, { role: "user", text: cmd }]);
    try {
      const context = messages.map((m) => ({
        id: m.id,
        from: m.from.slice(0, 60),
        subject: m.subject.slice(0, 80),
        snippet: m.snippet.slice(0, 80),
        starred: m.starred,
        unread: m.unread,
      }));
      const plan = await aiPlanActions(cmd, context, labelNames);
      setTurns((t) => [
        ...t,
        { role: "assistant", text: plan.reply || "Here's the plan.", plan, status: "pending" },
      ]);
    } catch (e: any) {
      setTurns((t) => [...t, { role: "assistant", text: e.message || "AI failed", status: "error" }]);
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (idx: number) => {
    const turn = turns[idx];
    if (!turn.plan) return;
    setTurns((t) => t.map((x, i) => (i === idx ? { ...x, status: "executing" } : x)));
    try {
      const res = await onExecute(turn.plan.actions);
      setTurns((t) =>
        t.map((x, i) =>
          i === idx
            ? { ...x, status: res.failed ? "error" : "done", text: res.summary }
            : x,
        ),
      );
    } catch (e: any) {
      setTurns((t) => t.map((x, i) => (i === idx ? { ...x, status: "error", error: e.message } : x)));
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[440px] sm:max-w-[440px] glass-strong flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> AI Assistant
          </SheetTitle>
          <p className="text-xs text-muted-foreground">
            Ask me to star, archive, trash, label, or search. e.g. "star the first 10 messages",
            "archive newsletters", "show emails before 10/26/25". I'll show a plan for you to confirm before running.
          </p>
        </SheetHeader>

        <div className="mt-4 flex-1 space-y-3 overflow-y-auto pr-1">
          {turns.length === 0 && (
            <div className="rounded-xl border border-border/60 bg-card/40 p-4 text-xs text-muted-foreground">
              I can see your currently loaded messages ({messages.length}). Try:
              <ul className="mt-2 list-disc space-y-1 pl-4">
                <li>"Star the first 5 messages"</li>
                <li>"Archive everything from LinkedIn"</li>
                <li>"Mark the first 3 as read"</li>
                <li>"Show emails before 10/26/25"</li>
                <li>"Label the first message as 'Follow up'"</li>
              </ul>
            </div>
          )}
          {turns.map((t, i) => (
            <div
              key={i}
              className={`rounded-2xl px-3 py-2 text-sm ${
                t.role === "user"
                  ? "ml-8 bg-primary/15 text-foreground"
                  : "mr-8 border border-border/60 bg-card/60"
              }`}
            >
              <div className="whitespace-pre-wrap">{t.text}</div>
              {t.plan && t.plan.actions.length > 0 && (
                <div className="mt-2 space-y-1 rounded-lg border border-border/50 bg-background/40 p-2 text-xs">
                  <div className="font-semibold text-muted-foreground">
                    Plan ({t.plan.actions.length} action{t.plan.actions.length === 1 ? "" : "s"}):
                  </div>
                  {t.plan.actions.map((a, j) => (
                    <div key={j} className="font-mono text-[11px] text-muted-foreground">
                      • {describeAction(a)}
                    </div>
                  ))}
                  {t.status === "pending" && (
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" className="h-7" onClick={() => confirm(i)}>Confirm & run</Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7"
                        onClick={() =>
                          setTurns((tt) =>
                            tt.map((x, k) => (k === i ? { ...x, status: "done", text: "Cancelled." } : x)),
                          )
                        }
                      >
                        Cancel
                      </Button>
                    </div>
                  )}
                  {t.status === "executing" && (
                    <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" /> Running…
                    </div>
                  )}
                  {t.status === "done" && (
                    <div className="mt-1 flex items-center gap-1 text-[11px] text-primary">
                      <CheckCircle2 className="h-3 w-3" /> Done
                    </div>
                  )}
                  {t.status === "error" && (
                    <div className="mt-1 flex items-center gap-1 text-[11px] text-destructive">
                      <AlertCircle className="h-3 w-3" /> {t.error || "Some actions failed"}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-3 rounded-xl border border-border/60 bg-card/40 p-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="Ask the assistant…"
            rows={2}
            className="resize-none border-0 bg-transparent p-1 focus-visible:ring-0"
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={submit} disabled={busy || !input.trim()} className="gap-1">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Send
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function describeAction(a: AssistantAction): string {
  switch (a.type) {
    case "star": return `Star ${a.ids.length} message${a.ids.length === 1 ? "" : "s"}`;
    case "unstar": return `Unstar ${a.ids.length} message${a.ids.length === 1 ? "" : "s"}`;
    case "archive": return `Archive ${a.ids.length} message${a.ids.length === 1 ? "" : "s"}`;
    case "trash": return `Move ${a.ids.length} to Trash`;
    case "markRead": return `Mark ${a.ids.length} as read`;
    case "markUnread": return `Mark ${a.ids.length} as unread`;
    case "label": return `Apply label "${a.labelName}" to ${a.ids.length}`;
    case "search": return `Search: ${a.query}`;
    case "compose": return `Compose to ${a.to} — "${a.subject}"`;
  }
}
