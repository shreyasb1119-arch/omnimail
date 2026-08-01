import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type GlassOption = { value: string; label: string };

type Props = {
  value?: string;
  onValueChange: (value: string) => void;
  options: GlassOption[];
  placeholder?: string;
  "aria-label"?: string;
  className?: string;
  align?: "start" | "end";
};

export function GlassSelect({
  value = "",
  onValueChange,
  options,
  placeholder = "Select…",
  className,
  align = "start",
  ...rest
}: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = options.find((o) => o.value === value);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={rest["aria-label"]}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex items-center gap-1 rounded-full border border-border/60 bg-card/50 px-2.5 py-1 text-[11px] text-muted-foreground backdrop-blur-xl transition-all hover:text-foreground hover:border-border active:scale-95",
          open && "text-foreground border-border bg-card/70",
          className,
        )}
      >
        <span className="truncate">{current?.label ?? placeholder}</span>
        <ChevronDown className={cn("h-3 w-3 transition-transform duration-200", open && "rotate-180")} />
      </button>

      <div
        className={cn(
          "absolute z-50 mt-1 grid transition-all duration-200 ease-out",
          align === "end" ? "right-0" : "left-0",
          open ? "grid-rows-[1fr] opacity-100 translate-y-0" : "pointer-events-none grid-rows-[0fr] opacity-0 -translate-y-1",
        )}
      >
        <div className="overflow-hidden">
          <ul
            role="listbox"
            className="no-scrollbar max-h-72 min-w-[10rem] overflow-y-auto rounded-2xl border border-border/60 bg-card/70 p-1 shadow-2xl backdrop-blur-2xl"
          >
            {options.map((o) => (
              <li key={o.value || "__placeholder"}>
                <button
                  type="button"
                  role="option"
                  aria-selected={o.value === value}
                  onClick={() => {
                    setOpen(false);
                    onValueChange(o.value);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-1.5 text-left text-[11px] text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground",
                    o.value === value && "bg-accent/40 text-foreground",
                  )}
                >
                  <span className="truncate">{o.label}</span>
                  {o.value === value && <Check className="h-3 w-3 shrink-0" />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
