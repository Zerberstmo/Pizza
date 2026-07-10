import type React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Sauce } from "@/types";

// Einfachauswahl der Soße (nur verfügbare). Muster wie die Zutaten-Chips.
export function SaucePicker({ sauces, value, onChange }: {
  sauces: Sauce[];
  value: string;
  onChange: (id: string) => void;
}): React.ReactElement {
  return (
    <div className="flex flex-wrap gap-2">
      {sauces.map((s) => {
        const active = s.id === value;
        return (
          <button key={s.id} type="button" onClick={() => onChange(s.id)}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all",
              active ? "border-primary/50 bg-primary/10 text-primary" : "border-border bg-card hover:border-border/80 text-foreground"
            )}>
            <span className="text-base leading-none">{s.emoji}</span>
            {s.name}
            {active && <Check size={11} className="text-primary" />}
          </button>
        );
      })}
    </div>
  );
}
