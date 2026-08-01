import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sparkles, Send, Wand2, Loader2, Paperclip, X, Save } from "lucide-react";
import { toast } from "sonner";
import { sendMessage, createDraft, fileToOutgoing, formatBytes, type OutgoingAttachment } from "@/lib/gmail";
import { aiWriteEmail, aiImproveTone, aiComplete } from "@/lib/ai";
import { useSettings } from "@/lib/store";

export interface ComposeInitial {
  to?: string;
  subject?: string;
  body?: string;
  threadId?: string;
  cc?: string;
  bcc?: string;
}

export function Compose({
  open,
  onOpenChange,
  initial,
  contacts = [],
  onSent,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial?: ComposeInitial;
  contacts?: string[];
  onSent?: () => void;
}) {
  const settings = useSettings();
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [showCc, setShowCc] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [atts, setAtts] = useState<OutgoingAttachment[]>([]);
  const [sending, setSending] = useState(false);
  const [aiIntent, setAiIntent] = useState("");
  const [aiTone, setAiTone] = useState<"professional" | "casual" | "cold">("professional");
  const [aiBusy, setAiBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTo(initial?.to || "");
      setCc(initial?.cc || "");
      setBcc(initial?.bcc || "");
      setShowCc(!!(initial?.cc || initial?.bcc));
      setSubject(initial?.subject || "");
      const sig = settings.signature ? `\n\n--\n${settings.signature}` : "";
      setBody((initial?.body || "") + sig);
      setAtts([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial]);

  const suggestions = useMemo(() => {
    const term = to.split(",").pop()?.trim().toLowerCase() || "";
    if (term.length < 2) return [];
    return contacts.filter((c) => c.toLowerCase().includes(term)).slice(0, 5);
  }, [to, contacts]);

  const payload = () => ({ to, cc: cc || undefined, bcc: bcc || undefined, subject, body, threadId: initial?.threadId, attachments: atts });

  const send = async () => {
    if (!to || !subject) return toast.error("Add a recipient and subject");
    if (settings.confirmBeforeSend && !window.confirm(`Send this email to ${to}?`)) return;
    const data = payload();
    const delay = Math.max(0, settings.undoSendSeconds || 0);

    if (delay > 0) {
      let cancelled = false;
      onOpenChange(false);
      const timer = setTimeout(async () => {
        if (cancelled) return;
        try {
          await sendMessage(data);
          toast.success("Sent");
          onSent?.();
        } catch (e: any) {
          toast.error(e.message || "Send failed");
        }
      }, delay * 1000);
      toast(`Sending to ${data.to}…`, {
        duration: delay * 1000,
        action: {
          label: "Undo",
          onClick: () => {
            cancelled = true;
            clearTimeout(timer);
            toast.info("Send undone — reopen compose to edit");
          },
        },
      });
      return;
    }

    setSending(true);
    try {
      await sendMessage(data);
      toast.success("Sent");
      onSent?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Send failed");
    } finally {
      setSending(false);
    }
  };

  const saveDraft = async () => {
    setSending(true);
    try {
      await createDraft(payload());
      toast.success("Draft saved to Gmail");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Could not save draft");
    } finally {
      setSending(false);
    }
  };

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    try {
      const out = await Promise.all(Array.from(files).map(fileToOutgoing));
      setAtts((a) => [...a, ...out]);
    } catch {
      toast.error("Could not attach file");
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
      setBody(await aiImproveTone(body, tone));
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
            <div className="relative">
              <div className="flex items-center gap-2">
                <Input placeholder="To" value={to} onChange={(e) => setTo(e.target.value)} className="border-0 border-b border-border rounded-none px-0 focus-visible:ring-0" />
                <button onClick={() => setShowCc((v) => !v)} className="shrink-0 text-xs text-muted-foreground hover:text-foreground">
                  Cc/Bcc
                </button>
              </div>
              {suggestions.length > 0 && (
                <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-border/60 bg-popover shadow-xl">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      className="block w-full px-3 py-1.5 text-left text-xs hover:bg-accent"
                      onClick={() => {
                        const parts = to.split(",");
                        parts[parts.length - 1] = ` ${s}`;
                        setTo(parts.join(",").replace(/^\s+/, "") + ", ");
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {showCc && (
              <div className="animate-drop grid gap-3 sm:grid-cols-2">
                <Input placeholder="Cc" value={cc} onChange={(e) => setCc(e.target.value)} className="border-0 border-b border-border rounded-none px-0 focus-visible:ring-0" />
                <Input placeholder="Bcc" value={bcc} onChange={(e) => setBcc(e.target.value)} className="border-0 border-b border-border rounded-none px-0 focus-visible:ring-0" />
              </div>
            )}
            <Input placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} className="border-0 border-b border-border rounded-none px-0 focus-visible:ring-0" />
            <Textarea
              placeholder="Write your message…"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              className="border-0 focus-visible:ring-0 resize-none px-0 leading-relaxed"
            />

            {atts.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {atts.map((a, i) => (
                  <span key={i} className="flex items-center gap-1.5 rounded-full border border-border/60 bg-card/50 px-3 py-1 text-xs">
                    <Paperclip className="h-3 w-3" /> {a.filename}
                    <span className="text-muted-foreground">{formatBytes(Math.round((a.data.length * 3) / 4))}</span>
                    <button onClick={() => setAtts((p) => p.filter((_, j) => j !== i))} aria-label="Remove attachment">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

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
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 px-6 py-3">
            <div className="flex items-center gap-2">
              <input ref={fileRef} type="file" multiple hidden onChange={(e) => addFiles(e.target.files)} />
              <Button variant="ghost" size="sm" className="gap-1" onClick={() => fileRef.current?.click()}>
                <Paperclip className="h-4 w-4" /> Attach
              </Button>
              <Button variant="ghost" size="sm" className="gap-1" onClick={saveDraft} disabled={sending}>
                <Save className="h-4 w-4" /> Save draft
              </Button>
            </div>
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
