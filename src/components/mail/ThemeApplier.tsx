import { useEffect } from "react";
import { useSettings } from "@/lib/store";

export function ThemeApplier() {
  const s = useSettings();
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", s.theme);
    root.style.setProperty("--panel-opacity", String(s.panelOpacity));
    root.style.setProperty("--panel-blur", String(s.panelBlur));
    root.style.setProperty("--inbox-opacity", String(s.inboxOpacity));
    root.style.setProperty("--inbox-blur", String(s.inboxBlur));
    root.style.setProperty("--wallpaper-opacity", String(s.wallpaperOpacity));
    root.style.setProperty("--wallpaper-blur", String(s.wallpaperBlur));
  }, [s.theme, s.panelOpacity, s.panelBlur, s.inboxOpacity, s.inboxBlur, s.wallpaperOpacity, s.wallpaperBlur]);
  return (
    <>
      <div className="app-wallpaper-dim" />
      <div
        className="app-wallpaper"
        style={{
          backgroundImage: s.wallpaperUrl ? `url("${s.wallpaperUrl.replace(/"/g, '\\"')}")` : undefined,
        }}
      />
    </>
  );
}
