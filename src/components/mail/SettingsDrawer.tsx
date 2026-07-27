import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { settingsStore, useSettings, type Theme } from "@/lib/store";
import { toast } from "sonner";
import { signOut } from "@/lib/gauth";

const themes: { id: Theme; label: string; swatch: string[] }[] = [
  { id: "superhuman", label: "Superhuman Dark", swatch: ["#1a1c26", "#e05a4a"] },
  { id: "nordic", label: "Nordic Light", swatch: ["#f7f9fc", "#4c78c9"] },
  { id: "oled", label: "OLED Midnight", swatch: ["#000000", "#e2b83f"] },
  { id: "cyberpunk", label: "Cyberpunk Glass", swatch: ["#2a1543", "#f13ab4"] },
  { id: "forest", label: "Forest Green", swatch: ["#1e2e26", "#5cb98a"] },
  { id: "ocean", label: "Ocean Blue", swatch: ["#152438", "#4aa4d6"] },
];

export function SettingsDrawer({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const s = useSettings();
  const [clientId, setClientId] = useState(s.clientId);
  const [geminiKey, setGeminiKey] = useState(s.geminiKey);

  const save = () => {
    settingsStore.set({ clientId: clientId.trim(), geminiKey: geminiKey.trim() });
    toast.success("Settings saved");
  };

  const onFile = (f: File) => {
    const reader = new FileReader();
    reader.onload = () => settingsStore.set({ wallpaperUrl: String(reader.result) });
    reader.readAsDataURL(f);
  };

  const onAvatar = (f: File) => {
    const reader = new FileReader();
    reader.onload = () => settingsStore.set({ avatarUrl: String(reader.result) });
    reader.readAsDataURL(f);
  };


  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[420px] sm:max-w-[420px] glass-strong overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Settings</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-6 pr-1">
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Google Account</h3>
            <div className="space-y-2">
              <Label>OAuth Client ID</Label>
              <Input
                placeholder="xxxxxxx.apps.googleusercontent.com"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Create a Web OAuth Client in Google Cloud Console. Add this origin as an Authorized JavaScript
                origin. Enable the Gmail API.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Gemini API Key (optional)</Label>
              <Input
                type="password"
                placeholder="AIza…"
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                With a key, requests go straight to <b>Gemini 3.1 Flash Lite</b>. Leave empty to use built-in AI.
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={save}>Save</Button>
              <Button variant="ghost" onClick={() => signOut()}>Sign out</Button>
            </div>
          </section>
          <Separator />
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Avatar</h3>
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full border border-border/60 bg-primary/15 text-sm font-semibold text-primary">
                {s.avatarUrl ? (
                  <img src={s.avatarUrl} alt="Your avatar" className="h-full w-full object-cover" />
                ) : (
                  "You"
                )}
              </div>
              <div className="flex-1 space-y-2">
                <Input
                  placeholder="https://image-url…"
                  value={s.avatarUrl}
                  onChange={(e) => settingsStore.set({ avatarUrl: e.target.value })}
                />
                <Input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && onAvatar(e.target.files[0])} />
              </div>
            </div>
            {s.avatarUrl && (
              <Button variant="ghost" size="sm" onClick={() => settingsStore.set({ avatarUrl: "" })}>
                Reset to Google photo
              </Button>
            )}
          </section>
          <Separator />

          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Theme</h3>
            <div className="grid grid-cols-2 gap-2">
              {themes.map((t) => (
                <button
                  key={t.id}
                  onClick={() => settingsStore.set({ theme: t.id })}
                  className={`group relative rounded-xl border p-3 text-left transition hover:border-primary ${
                    s.theme === t.id ? "border-primary ring-2 ring-primary/40" : "border-border"
                  }`}
                >
                  <div className="mb-2 flex gap-1">
                    {t.swatch.map((c) => (
                      <div key={c} className="h-6 w-6 rounded-md border border-border/40" style={{ background: c }} />
                    ))}
                  </div>
                  <div className="text-sm font-medium">{t.label}</div>
                </button>
              ))}
            </div>
          </section>
          <Separator />
          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Wallpaper</h3>
            <div className="space-y-2">
              <Label>Image URL</Label>
              <Input
                placeholder="https://..."
                value={s.wallpaperUrl}
                onChange={(e) => settingsStore.set({ wallpaperUrl: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Upload</Label>
              <Input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
            </div>
            {s.wallpaperUrl && (
              <Button variant="ghost" size="sm" onClick={() => settingsStore.set({ wallpaperUrl: "" })}>
                Clear wallpaper
              </Button>
            )}
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Wallpaper visibility</span><span>{s.wallpaperOpacity}%</span>
              </div>
              <Slider
                value={[s.wallpaperOpacity]}
                min={0}
                max={100}
                step={1}
                onValueChange={([v]) => settingsStore.set({ wallpaperOpacity: v })}
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Wallpaper blur</span><span>{s.wallpaperBlur}px</span>
              </div>
              <Slider
                value={[s.wallpaperBlur]}
                min={0}
                max={40}
                step={1}
                onValueChange={([v]) => settingsStore.set({ wallpaperBlur: v })}
              />
            </div>
          </section>
          <Separator />
          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sidebar panels</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Panel opacity</span><span>{s.panelOpacity}%</span>
              </div>
              <Slider value={[s.panelOpacity]} min={20} max={100} step={1} onValueChange={([v]) => settingsStore.set({ panelOpacity: v })} />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Panel blur</span><span>{s.panelBlur}px</span>
              </div>
              <Slider value={[s.panelBlur]} min={0} max={60} step={1} onValueChange={([v]) => settingsStore.set({ panelBlur: v })} />
            </div>
          </section>
          <Separator />
          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Inbox pane</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Inbox opacity</span><span>{s.inboxOpacity}%</span>
              </div>
              <Slider value={[s.inboxOpacity]} min={0} max={100} step={1} onValueChange={([v]) => settingsStore.set({ inboxOpacity: v })} />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Inbox blur</span><span>{s.inboxBlur}px</span>
              </div>
              <Slider value={[s.inboxBlur]} min={0} max={60} step={1} onValueChange={([v]) => settingsStore.set({ inboxBlur: v })} />
            </div>
          </section>
          <Separator />
          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Command palette</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Palette transparency</span><span>{s.cmdOpacity}%</span>
              </div>
              <Slider value={[s.cmdOpacity]} min={0} max={100} step={1} onValueChange={([v]) => settingsStore.set({ cmdOpacity: v })} />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Palette blur</span><span>{s.cmdBlur}px</span>
              </div>
              <Slider value={[s.cmdBlur]} min={0} max={60} step={1} onValueChange={([v]) => settingsStore.set({ cmdBlur: v })} />
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
