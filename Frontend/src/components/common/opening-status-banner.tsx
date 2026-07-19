import type React from "react";
import type { AppConfig } from "@/types";
import { openingStatus, relativeDateLabel } from "@/lib/opening-status";
import { cn } from "@/lib/utils";

// Momentaner Öffnungs-Status auf der Startseite (kein Live-Ticking).
// Rein aus Config + open_days abgeleitet; die Slot-Validierung bleibt serverautoritativ.
export function OpeningStatusBanner({
  config,
  openDays,
}: {
  config: AppConfig;
  openDays: string[];
}): React.ReactElement {
  const { openNow, nextPickup } = openingStatus(config, openDays, new Date());

  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-3 flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "h-2.5 w-2.5 rounded-full shrink-0",
            openNow ? "bg-green-500" : "bg-muted-foreground",
          )}
        />
        <span className="text-sm font-bold">
          {openNow ? "Jetzt geöffnet" : "Jetzt geschlossen"}
        </span>
      </div>
      <p className="text-xs text-muted-foreground pl-[18px]">
        {nextPickup ? (
          <>
            Nächste Abholung:{" "}
            <span className="text-foreground font-semibold">
              {relativeDateLabel(nextPickup.date, new Date())} ab {nextPickup.time} Uhr
            </span>
          </>
        ) : (
          "Aktuell keine Abholtermine"
        )}
      </p>
    </div>
  );
}
