import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { settingsStore, useSettings, THEMES, WALLPAPERS, LAYOUTS, type Theme, type LayoutId } from "@/lib/store";
import { toast } from "sonner";
import { signOut } from "@/lib/gauth";


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
              <Label>OAuth Client ID (optional)</Label>
              <Input
                placeholder="xxxxxxx.apps.googleusercontent.com"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Omni Mail ships with its own Google client, so you can just sign in. Leave this blank unless
                you want to use your own Web OAuth Client from the Google Cloud Console.
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
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Layout</h3>
            <p className="text-xs text-muted-foreground">Pick how the panes are arranged and how dense the inbox feels.</p>
            <div className="space-y-2">
              {LAYOUTS.map((l) => (
                <button
                  key={l.id}
                  onClick={() => settingsStore.set({ layout: l.id as LayoutId })}
                  className={`press flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition hover:border-primary ${
                    s.layout === l.id ? "border-primary ring-2 ring-primary/40" : "border-border"
                  }`}
                >
                  <div className="flex h-9 w-12 shrink-0 gap-0.5 rounded-md border border-border/60 bg-card/60 p-1">
                    {l.id !== "focus" && <div className="w-1.5 rounded-[2px] bg-primary/50" />}
                    <div className={`rounded-[2px] bg-foreground/25 ${l.id === "stack" ? "flex-1" : "w-3"}`} />
                    {l.id !== "stack" && <div className="flex-1 rounded-[2px] bg-foreground/10" />}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-medium">{l.label}</div>
                    <div className="text-[10px] leading-snug text-muted-foreground">{l.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <Separator />

          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Theme</h3>
            {(["dark", "light"] as const).map((mode) => (
              <div key={mode} className="space-y-2">
                <div className="text-[11px] font-medium capitalize text-muted-foreground">{mode} themes</div>
                <div className="grid grid-cols-2 gap-2">
                  {THEMES.filter((t) => t.mode === mode).map((t) => (
                    <button
                      key={t.id}
                      onClick={() => settingsStore.set({ theme: t.id as Theme })}
                      className={`press group relative rounded-xl border p-2.5 text-left hover:border-primary ${
                        s.theme === t.id ? "border-primary ring-2 ring-primary/40" : "border-border"
                      }`}
                    >
                      <div className="mb-2 flex gap-1">
                        {t.swatch.map((c) => (
                          <div key={c} className="h-6 w-6 rounded-md border border-border/40" style={{ background: c }} />
                        ))}
                      </div>
                      <div className="text-xs font-medium">{t.label}</div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <div className="space-y-2">
              <div className="text-[11px] font-medium text-muted-foreground">Custom theme</div>
              <button
                onClick={() => settingsStore.set({ theme: "custom" })}
                className={`press w-full rounded-xl border p-2.5 text-left hover:border-primary ${
                  s.theme === "custom" ? "border-primary ring-2 ring-primary/40" : "border-border"
                }`}
              >
                <div className="mb-2 flex gap-1">
                  <div className="h-6 w-6 rounded-md border border-border/40" style={{ background: s.customBg }} />
                  <div className="h-6 w-6 rounded-md border border-border/40" style={{ background: s.customFg }} />
                  <div className="h-6 w-6 rounded-md border border-border/40" style={{ background: s.customPrimary }} />
                </div>
                <div className="text-xs font-medium">Use my theme</div>
              </button>
              <div className="grid grid-cols-3 gap-2">
                {([
                  ["Background", "customBg"],
                  ["Text", "customFg"],
                  ["Accent", "customPrimary"],
                ] as const).map(([label, key]) => (
                  <div key={key} className="space-y-1">
                    <Label className="text-[10px]">{label}</Label>
                    <Input
                      type="color"
                      value={s[key]}
                      onChange={(e) => settingsStore.set({ [key]: e.target.value, theme: "custom" } as any)}
                      className="h-9 cursor-pointer p-1"
                    />
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                {(["dark", "light"] as const).map((m) => (
                  <Button
                    key={m}
                    size="sm"
                    variant={s.customMode === m ? "default" : "ghost"}
                    onClick={() => settingsStore.set({ customMode: m })}
                    className="flex-1 capitalize"
                  >
                    {m}
                  </Button>
                ))}
              </div>
            </div>
          </section>

          <Separator />
          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Wallpaper</h3>
            <div className="space-y-2">
              <Label>Built-in wallpapers</Label>
              <div className="grid grid-cols-5 gap-2">
                {WALLPAPERS.map((w) => (
                  <button
                    key={w.id}
                    title={w.label}
                    onClick={() => settingsStore.set({ wallpaperUrl: w.url })}
                    className={`press h-12 overflow-hidden rounded-lg border ${
                      s.wallpaperUrl === w.url ? "border-primary ring-2 ring-primary/40" : "border-border/60"
                    }`}
                  >
                    <img src={w.url} alt={w.label} loading="lazy" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
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
