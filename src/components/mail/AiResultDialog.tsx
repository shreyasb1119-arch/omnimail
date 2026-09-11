import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Loader2, CornerDownLeft, Copy, Check } from "lucide-react";
import { aiFollowUp } from "@/lib/ai";

type Turn = { role: "user" | "assistant"; text: string };

/**
 * Shows a finished AI task result and lets the user keep asking about it.
 * Every follow-up carries the original result plus the earlier turns.
 */
export function AiResultDialog({
  scan,
  onClose,
}: {
  scan: { title: string; text: string } | null;
  onClose: () => void;
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  // Reset the thread whenever a new task result opens.
  useEffect(() => {
    setTurns([]);
    setQ("");
    setBusy(false);
    setCopied(false);
  }, [scan?.title, scan?.text]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, busy]);

  const ask = async () => {
    const question = q.trim();
    if (!question || busy || !scan) return;
    setQ("");
    setBusy(true);
    const history = turns;
    setTurns((t) => [...t, { role: "user", text: question }]);
    try {
      const answer = await aiFollowUp(scan.title, scan.text, history, question);
      setTurns((t) => [...t, { role: "assistant", text: answer || "No answer came back." }]);
    } catch (e: any) {
      setTurns((t) => [...t, { role: "assistant", text: e?.message || "That follow-up failed." }]);
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!scan) return;
    try {
      await navigator.clipboard.writeText(scan.text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch { /* clipboard unavailable */ }
  };

  return (
    <Dialog open={!!scan} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="glass-strong grain max-w-xl overflow-hidden p-0">
        <DialogHeader className="border-b border-border/50 px-5 pb-3 pt-5">
          <DialogTitle className="flex items-center gap-2 text-base">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-primary/15 text-primary">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            {scan?.title}
            <button
              onClick={copy}
              className="press ml-auto rounded-full p-1.5 text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              aria-label="Copy result"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </DialogTitle>
        </DialogHeader>

        <div className="no-scrollbar max-h-[52vh] space-y-4 overflow-y-auto px-5 py-4">
          <div className="animate-in-up whitespace-pre-wrap text-sm leading-relaxed">{scan?.text}</div>

          {turns.length > 0 && <div className="h-px bg-border/50" />}

          {turns.map((t, i) => (
            <div
              key={i}
              className={
                t.role === "user"
                  ? "animate-in-up ml-8 rounded-2xl bg-primary/12 px-3.5 py-2 text-sm"
                  : "animate-in-up mr-4 whitespace-pre-wrap text-sm leading-relaxed"
              }
            >
              {t.text}
            </div>
          ))}

          {busy && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className="border-t border-border/50 px-4 py-3">
          <div className="rounded-2xl border border-border/60 bg-card/40 px-3 py-2 transition focus-within:border-primary/50">
            <Textarea
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void ask();
                }
              }}
              rows={1}
              placeholder="Ask about this result — why, which one, what next…"
              className="min-h-0 resize-none border-0 bg-transparent p-0 text-sm focus-visible:ring-0"
            />
            <div className="mt-1.5 flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">
                Answers stay grounded in this result
              </span>
              <Button size="sm" className="h-7 gap-1.5 px-3" onClick={() => void ask()} disabled={busy || !q.trim()}>
                {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <CornerDownLeft className="h-3 w-3" />}
                Ask
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
