import type { AppConfig, Hours, ServiceMode } from "@/types";

export const DAYS_OF_WEEK = ["Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag","Sonntag"] as const;
export const JS_DAY_MAP: Record<number, string> = { 0:"Sonntag",1:"Montag",2:"Dienstag",3:"Mittwoch",4:"Donnerstag",5:"Freitag",6:"Samstag" };

export function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Buchbare Tage: geplante offene Tage ab heute + Vorlaufzeit, sortiert & dedupliziert.
export function getSelectableDates(openDates: string[], leadTimeDays: number, today: Date): string[] {
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + leadTimeDays);
  const min = toISO(start);
  return [...new Set(openDates)].filter((d) => d >= min).sort();
}

// Wochenzeilen (Mo–So) ab dem Montag der Woche von `today`, für `weeks` Wochen — für den Admin-Kalender.
export function calendarGrid(today: Date, weeks: number): string[][] {
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  const dow = (start.getDay() + 6) % 7; // Mo=0 … So=6
  start.setDate(start.getDate() - dow);
  const grid: string[][] = [];
  for (let w = 0; w < weeks; w++) {
    const row: string[] = [];
    for (let d = 0; d < 7; d++) {
      const cell = new Date(start);
      cell.setDate(start.getDate() + w * 7 + d);
      row.push(toISO(cell));
    }
    grid.push(row);
  }
  return grid;
}

export function getAvailableTimes(hours: Hours): string[] {
  const [fh, fm] = hours.from.split(":").map(Number);
  const [th, tm] = hours.to.split(":").map(Number);
  const start = fh * 60 + fm, end = th * 60 + tm;
  const slots: string[] = [];
  for (let m = start; m <= end; m += 15) {
    slots.push(`${String(Math.floor(m/60)).padStart(2,"0")}:${String(m%60).padStart(2,"0")}`);
  }
  return slots;
}

export function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const days = ["So","Mo","Di","Mi","Do","Fr","Sa"];
  const dd = String(d.getDate()).padStart(2,"0");
  const mm = String(d.getMonth()+1).padStart(2,"0");
  return `${days[d.getDay()]}, ${dd}.${mm}.${d.getFullYear()}`;
}

export function isSlotAllowed(dateStr: string, time: string, openDates: string[], leadTimeDays: number, hours: Hours, now: Date): boolean {
  return getSelectableDates(openDates, leadTimeDays, now).includes(dateStr)
    && getAvailableTimes(hours).includes(time);
}

export function availableServiceModes(config: AppConfig): ServiceMode[] {
  const modes: ServiceMode[] = [];
  if (config.service.dineIn) modes.push("dinein");
  if (config.service.takeaway) modes.push("takeaway");
  return modes;
}
