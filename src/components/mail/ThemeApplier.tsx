import { useEffect } from "react";
import { useSettings, themeMode } from "@/lib/store";

/** Resolve a CSS custom property to a concrete color string the canvas can paint. */
function resolveColor(varName: string, fallback: string) {
  try {
    const probe = document.createElement("span");
    probe.style.color = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    probe.style.display = "none";
    document.body.appendChild(probe);
    const c = getComputedStyle(probe).color;
    probe.remove();
    return c || fallback;
  } catch {
    return fallback;
  }
}

/** Draws a transparent-background Omni mark in the live theme's accent color. */
function paintFavicon() {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const primary = resolveColor("--primary", "#ffffff");
  ctx.clearRect(0, 0, size, size);

  // Ring
  ctx.strokeStyle = primary;
  ctx.lineWidth = 6;
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.arc(32, 32, 25, 0, Math.PI * 2);
  ctx.stroke();

  // Envelope flap inside the ring
  ctx.lineWidth = 5.5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(19, 25);
  ctx.lineTo(32, 37);
  ctx.lineTo(45, 25);
  ctx.stroke();

  const href = canvas.toDataURL("image/png");
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.type = "image/png";
  link.href = href;
}

export function ThemeApplier() {
  const s = useSettings();
  const [flash, setFlash] = useState(false);
  const firstRun = useRef(true);

  // Animate whenever the theme (or light/dark mode) changes.
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const root = document.documentElement;
    root.classList.add("theme-swapping");
    setFlash(true);
    const t1 = window.setTimeout(() => root.classList.remove("theme-swapping"), 560);
    const t2 = window.setTimeout(() => setFlash(false), 600);
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); };
  }, [s.theme, s.customMode]);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", s.theme);
    root.style.setProperty("--c-bg", s.customBg);
    root.style.setProperty("--c-fg", s.customFg);
    root.style.setProperty("--c-primary", s.customPrimary);
    root.classList.toggle("dark", themeMode(s.theme) === "dark");
    root.style.setProperty("--panel-opacity", String(s.panelOpacity));
    root.style.setProperty("--panel-blur", String(s.panelBlur));
    root.style.setProperty("--inbox-opacity", String(s.inboxOpacity));
    root.style.setProperty("--inbox-blur", String(s.inboxBlur));
    root.style.setProperty("--wallpaper-opacity", String(s.wallpaperOpacity));
    root.style.setProperty("--wallpaper-blur", String(s.wallpaperBlur));
    root.style.setProperty("--cmd-opacity", String(s.cmdOpacity));
    root.style.setProperty("--cmd-blur", String(s.cmdBlur));
    // Favicon follows the theme accent.
    const id = window.requestAnimationFrame(() => paintFavicon());
    return () => window.cancelAnimationFrame(id);
  }, [s.theme, s.customBg, s.customFg, s.customPrimary, s.panelOpacity, s.panelBlur, s.inboxOpacity, s.inboxBlur, s.wallpaperOpacity, s.wallpaperBlur, s.cmdOpacity, s.cmdBlur]);
  return (
    <>
      <div className="app-wallpaper-dim" />
      <div
        className="app-wallpaper"
        style={{
          backgroundImage: s.wallpaperUrl ? `url("${s.wallpaperUrl.replace(/"/g, '\\"')}")` : undefined,
        }}
      />
      <div className={`theme-flash ${flash ? "is-on" : ""}`} aria-hidden="true" />
    </>
  );
}

