import type React from "react";
import { getOpenDays, addOpenDay, removeOpenDay } from "@/lib/data/store";
import { calendarGrid, toISO, formatDateLabel } from "@/lib/slots";
import { useAsync } from "@/hooks/use-async";
import { cn } from "@/lib/utils";

const WEEKS = 4;
const WD = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

// Admin: Öffnungstage als konkrete Kalendertage (ersetzt das Wochentags-Muster).
// Das Raster muss auch bei 0 geöffneten Tagen rendern — sonst könnte der Admin den ersten Tag
// nie anlegen (open_days startet leer). Deshalb kein AsyncBoundary (blendet leere Arrays aus).
export default function DaysPage(): React.ReactElement {
  const { data, loading, error, reload } = useAsync(getOpenDays);
  const todayIso = toISO(new Date());
  const grid = calendarGrid(new Date(), WEEKS);
  const open = new Set(data ?? []);

  const toggle = async (date: string, isOpen: boolean) => {
    if (isOpen) await removeOpenDay(date);
    else await addOpenDay(date);
    reload();
  };

  return (
    <div className="p-4 space-y-4">
      <div>
        <h2 className="font-bold text-lg">Öffnungstage</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Tippe die Tage an, an denen du geöffnet hast. Nur markierte Tage sind buchbar.
        </p>
      </div>

      {loading && <div className="flex items-center justify-center py-16 text-muted-foreground">Lädt…</div>}
      {error && <div className="flex items-center justify-center py-16 text-center text-destructive">Etwas ist schiefgelaufen.</div>}

      {!loading && !error && (
        <div className="space-y-2">
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
            {WD.map((w) => <div key={w}>{w}</div>)}
          </div>
          {grid.map((week) => (
            <div key={week[0]} className="grid grid-cols-7 gap-1">
              {week.map((date) => {
                const past = date < todayIso;
                const isOpen = open.has(date);
                const day = Number(date.slice(8, 10));
                return (
                  <button
                    key={date}
                    type="button"
                    disabled={past}
                    aria-pressed={isOpen}
                    aria-label={formatDateLabel(date)}
                    onClick={() => toggle(date, isOpen)}
                    className={cn(
                      "aspect-square rounded-md text-sm font-semibold transition-colors",
                      past && "opacity-30 cursor-not-allowed",
                      !past && isOpen && "bg-primary text-primary-foreground",
                      !past && !isOpen && "bg-card border border-border text-foreground hover:bg-accent",
                    )}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          ))}
          <p className="text-xs text-muted-foreground pt-1">
            {open.size} {open.size === 1 ? "Tag" : "Tage"} geöffnet in den nächsten {WEEKS} Wochen.
          </p>
        </div>
      )}
    </div>
  );
}
