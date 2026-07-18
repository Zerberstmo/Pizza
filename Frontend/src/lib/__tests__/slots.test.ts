import { describe, it, expect } from "bun:test";
import { getSelectableDates, calendarGrid, getAvailableTimes, isSlotAllowed, formatDateLabel, availableServiceModes } from "@/lib/slots";
import type { AppConfig } from "@/types";

const allDays = { Montag: true, Dienstag: true, Mittwoch: true, Donnerstag: true, Freitag: true, Samstag: true, Sonntag: true };
const cfg = (leadTimeDays: number): AppConfig => ({ days: allDays, hours: { from: "11:00", to: "12:00" }, leadTimeDays, service: { dineIn: false, takeaway: true }, dashboardResetAt: null });

describe("getSelectableDates (open_days)", () => {
  const today = new Date("2026-07-18T09:00:00"); // Sa
  it("filtert Tage vor heute+Vorlauf, sortiert, dedupliziert", () => {
    const open = ["2026-07-25", "2026-07-19", "2026-07-25", "2026-07-10"];
    expect(getSelectableDates(open, 3, today)).toEqual(["2026-07-25"]); // 19. < 18.+3=21.; 10. Vergangenheit
  });
  it("Vorlauf 0: heute inklusive", () => {
    expect(getSelectableDates(["2026-07-18", "2026-07-17"], 0, today)).toEqual(["2026-07-18"]);
  });
  it("leere Eingabe → leer", () => expect(getSelectableDates([], 3, today)).toEqual([]));
});

describe("calendarGrid", () => {
  it("startet am Montag der Woche, N Wochen à 7 Tage", () => {
    const grid = calendarGrid(new Date("2026-07-18T12:00:00"), 2); // Sa 18.07.
    expect(grid).toHaveLength(2);
    expect(grid[0]).toHaveLength(7);
    expect(grid[0][0]).toBe("2026-07-13"); // Montag dieser Woche
    expect(grid[1][6]).toBe("2026-07-26"); // Sonntag der Folgewoche
  });
});

describe("slots", () => {
  it("times in 15-min steps inclusive", () => {
    expect(getAvailableTimes({ from: "11:00", to: "11:30" })).toEqual(["11:00", "11:15", "11:30"]);
  });
  it("isSlotAllowed: Tag muss offen UND ≥ Vorlauf sein, Zeit im Fenster", () => {
    const now = new Date("2026-07-18T09:00:00");
    const open = ["2026-07-25"];
    expect(isSlotAllowed("2026-07-25", "11:00", open, 3, cfg(3).hours, now)).toBe(true);
    expect(isSlotAllowed("2026-07-19", "11:00", open, 3, cfg(3).hours, now)).toBe(false); // nicht offen
    expect(isSlotAllowed("2026-07-25", "09:00", open, 3, cfg(3).hours, now)).toBe(false); // Zeit außerhalb
  });
  it("formatDateLabel formats german weekday + date", () => {
    expect(formatDateLabel("2026-07-12")).toBe("So, 12.07.2026");
  });
  it("availableServiceModes spiegelt die Config", () => {
    const base = cfg(3);
    expect(availableServiceModes({ ...base, service: { dineIn: true,  takeaway: true  } })).toEqual(["dinein", "takeaway"]);
    expect(availableServiceModes({ ...base, service: { dineIn: false, takeaway: true  } })).toEqual(["takeaway"]);
    expect(availableServiceModes({ ...base, service: { dineIn: true,  takeaway: false } })).toEqual(["dinein"]);
    expect(availableServiceModes({ ...base, service: { dineIn: false, takeaway: false } })).toEqual([]);
  });
});
