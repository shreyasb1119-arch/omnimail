import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sparkles, Send, Wand2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { sendMessage } from "@/lib/gmail";
import { aiWriteEmail, aiImproveTone, aiComplete } from "@/lib/ai";

export interface ComposeInitial {
  to?: string;
  subject?: string;
  body?: string;
  threadId?: string;
}

export function Compose({
  open,
  onOpenChange,
  initial,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial?: ComposeInitial;
}) {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [aiIntent, setAiIntent] = useState("");
  const [aiTone, setAiTone] = useState<"professional" | "casual" | "cold">("professional");
  const [aiBusy, setAiBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setTo(initial?.to || "");
      setSubject(initial?.subject || "");
      setBody(initial?.body || "");
    }
  }, [open, initial]);

  const send = async () => {
    if (!to || !subject) return toast.error("Add a recipient and subject");
    setSending(true);
    try {
      await sendMessage({ to, subject, body, threadId: initial?.threadId });
      toast.success("Sent");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Send failed");
    } finally {
      setSending(false);
    }
  };

  const aiWrite = async () => {
    if (!aiIntent.trim()) return;
    setAiBusy(true);
    try {
      const r = await aiWriteEmail({ intent: aiIntent, tone: aiTone, context: body });
      if (r.subject) setSubject(r.subject);
      setBody(r.body);
      toast.success("Draft ready");
    } catch (e: any) {
      toast.error(e.message || "AI failed");
    } finally {
      setAiBusy(false);
    }
  };

  const improveTone = async (tone: "professional" | "casual" | "cold") => {
    if (!body.trim()) return;
    setAiBusy(true);
    try {
      const out = await aiImproveTone(body, tone);
      setBody(out);
    } catch (e: any) {
      toast.error(e.message || "AI failed");
    } finally {
      setAiBusy(false);
    }
  };

  const completeSentence = async () => {
    if (!body.trim()) return;
    setAiBusy(true);
    try {
      const cont = await aiComplete(body);
      setBody((b) => (b.endsWith(" ") ? b + cont : b + " " + cont));
    } catch (e: any) {
      toast.error(e.message || "AI failed");
    } finally {
      setAiBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl overflow-hidden border-border/60 bg-transparent p-0">
        <div className="glass-strong rounded-2xl">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle className="text-base font-semibold">New Message</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 p-6 pt-4">
            <Input placeholder="To" value={to} onChange={(e) => setTo(e.target.value)} className="border-0 border-b border-border rounded-none px-0 focus-visible:ring-0" />
            <Input placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} className="border-0 border-b border-border rounded-none px-0 focus-visible:ring-0" />
            <Textarea
              placeholder="Write your message…"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              className="border-0 focus-visible:ring-0 resize-none px-0 leading-relaxed"
            />
            <Tabs defaultValue="write" className="rounded-xl border border-border/60 bg-card/40 p-3">
              <TabsList className="bg-transparent">
                <TabsTrigger value="write"><Sparkles className="mr-1.5 h-3.5 w-3.5" /> AI Writer</TabsTrigger>
                <TabsTrigger value="tone"><Wand2 className="mr-1.5 h-3.5 w-3.5" /> Tone</TabsTrigger>
              </TabsList>
              <TabsContent value="write" className="mt-3 space-y-2">
                <Textarea
                  placeholder="What is this email about? e.g. 'Ask Sam to review the Q4 deck by Friday'"
                  rows={2}
                  value={aiIntent}
                  onChange={(e) => setAiIntent(e.target.value)}
                />
                <div className="flex flex-wrap items-center gap-2">
                  {(["professional", "casual", "cold"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setAiTone(t)}
                      className={`rounded-full border px-3 py-1 text-xs capitalize transition ${
                        aiTone === t ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
                      }`}
                    >
                      {t === "cold" ? "Cold outreach" : t}
                    </button>
                  ))}
                  <Button size="sm" onClick={aiWrite} disabled={aiBusy || !aiIntent.trim()} className="ml-auto">
                    {aiBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Generate
                  </Button>
                  <Button size="sm" variant="ghost" onClick={completeSentence} disabled={aiBusy || !body.trim()}>
                    Autocomplete
                  </Button>
                </div>
              </TabsContent>
              <TabsContent value="tone" className="mt-3">
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => improveTone("professional")} disabled={aiBusy}>Professional</Button>
                  <Button size="sm" variant="secondary" onClick={() => improveTone("casual")} disabled={aiBusy}>Casual</Button>
                  <Button size="sm" variant="secondary" onClick={() => improveTone("cold")} disabled={aiBusy}>Cold Outreach</Button>
                </div>
              </TabsContent>
            </Tabs>
          </div>
          <div className="flex items-center justify-between border-t border-border/60 px-6 py-3">
            <span className="text-xs text-muted-foreground">Omni Mail · AI-powered</span>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Discard</Button>
              <Button onClick={send} disabled={sending}>
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
