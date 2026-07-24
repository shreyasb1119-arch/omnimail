import { useEffect, useState } from "react";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Inbox, Star, Send, Trash2, Search, PenSquare, Sparkles, Settings, Archive, LogOut } from "lucide-react";

export interface Cmd {
  id: string;
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  action: () => void;
  group?: string;
}

export function CommandPalette({
  open,
  onOpenChange,
  commands,
  onSearch,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  commands: Cmd[];
  onSearch: (q: string) => void;
}) {
  const [q, setQ] = useState("");
  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl overflow-hidden border-border/60 bg-transparent p-0 shadow-2xl">
        <div className="glass-strong rounded-2xl">
          <Command className="bg-transparent">
            <CommandInput
              placeholder="Search mail or run a command…"
              value={q}
              onValueChange={setQ}
              onKeyDown={(e) => {
                if (e.key === "Enter" && q && !commands.some((c) => c.label.toLowerCase().includes(q.toLowerCase()))) {
                  onSearch(q);
                  onOpenChange(false);
                }
              }}
            />
            <CommandList className="max-h-[420px]">
              <CommandEmpty>
                <button
                  className="w-full py-2 text-sm text-primary"
                  onClick={() => {
                    onSearch(q);
                    onOpenChange(false);
                  }}
                >
                  Search Gmail for "{q}"
                </button>
              </CommandEmpty>
              {Array.from(new Set(commands.map((c) => c.group || "Actions"))).map((g) => (
                <CommandGroup key={g} heading={g}>
                  {commands
                    .filter((c) => (c.group || "Actions") === g)
                    .map((c) => (
                      <CommandItem
                        key={c.id}
                        onSelect={() => {
                          onOpenChange(false);
                          setTimeout(c.action, 50);
                        }}
                      >
                        {c.icon}
                        <span className="ml-2">{c.label}</span>
                        {c.shortcut && (
                          <span className="ml-auto text-xs text-muted-foreground">{c.shortcut}</span>
                        )}
                      </CommandItem>
                    ))}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export const iconFor = {
  inbox: <Inbox className="h-4 w-4" />,
  star: <Star className="h-4 w-4" />,
  send: <Send className="h-4 w-4" />,
  trash: <Trash2 className="h-4 w-4" />,
  search: <Search className="h-4 w-4" />,
  compose: <PenSquare className="h-4 w-4" />,
  ai: <Sparkles className="h-4 w-4" />,
  settings: <Settings className="h-4 w-4" />,
  archive: <Archive className="h-4 w-4" />,
  logout: <LogOut className="h-4 w-4" />,
};
