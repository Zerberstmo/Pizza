import type { AppConfig } from "@/types";
import { toISO, getSelectableDates, availableServiceModes } from "@/lib/slots";

export interface OpeningStatus {
  openNow: boolean;
  nextPickup: { date: string; time: string } | null;
}

// "Jetzt geöffnet" = heutiges Datum ist geplanter Öffnungstag (open_days)
// UND aktuelle Uhrzeit in [from..to] UND mind. ein Service aktiv.
export function openingStatus(config: AppConfig, openDays: string[], now: Date): OpeningStatus {
  const openToday = openDays.includes(toISO(now));
  const cur = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const withinHours = cur >= config.hours.from && cur <= config.hours.to;
  const hasService = availableServiceModes(config).length > 0;
  const openNow = openToday && withinHours && hasService;

  const dates = getSelectableDates(openDays, config.leadTimeDays, now);
  const nextPickup = dates.length > 0 ? { date: dates[0], time: config.hours.from } : null;
  return { openNow, nextPickup };
}

// Freundliches Label: heute / morgen / "Mi, 22.07." (relativ zu now).
export function relativeDateLabel(dateStr: string, now: Date): string {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T00:00:00");
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  if (diffDays === 0) return "heute";
  if (diffDays === 1) return "morgen";
  const wd = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"][target.getDay()];
  const dd = String(target.getDate()).padStart(2, "0");
  const mm = String(target.getMonth() + 1).padStart(2, "0");
  return `${wd}, ${dd}.${mm}.`;
}
