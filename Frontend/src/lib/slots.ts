import type { AppConfig, Hours } from "@/types";

export const DAYS_OF_WEEK = ["Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag","Sonntag"] as const;
export const JS_DAY_MAP: Record<number, string> = { 0:"Sonntag",1:"Montag",2:"Dienstag",3:"Mittwoch",4:"Donnerstag",5:"Freitag",6:"Samstag" };

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function getSelectableDates(config: AppConfig, today: Date): string[] {
  const dates: string[] = [];
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + config.leadTimeDays);
  for (let i = 0; i < 90 && dates.length < 30; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    if (config.days[JS_DAY_MAP[d.getDay()]]) dates.push(toISO(d));
  }
  return dates;
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

export function isSlotAllowed(dateStr: string, time: string, config: AppConfig, now: Date): boolean {
  return getSelectableDates(config, now).includes(dateStr)
    && getAvailableTimes(config.hours).includes(time);
}
