import { describe, it, expect } from "bun:test";
import { getSelectableDates, getAvailableTimes, isSlotAllowed, formatDateLabel } from "@/lib/slots";
import type { AppConfig } from "@/types";

const allDays = { Montag: true, Dienstag: true, Mittwoch: true, Donnerstag: true, Freitag: true, Samstag: true, Sonntag: true };
const cfg = (leadTimeDays: number, days = allDays): AppConfig => ({ days, hours: { from: "11:00", to: "12:00" }, leadTimeDays });

describe("slots", () => {
  it("lead time 3: earliest date is today+3", () => {
    const today = new Date("2026-07-09T10:00:00"); // Do
    const dates = getSelectableDates(cfg(3), today);
    expect(dates[0]).toBe("2026-07-12"); // So
  });
  it("lead time 0: earliest date is today", () => {
    const today = new Date("2026-07-09T10:00:00");
    expect(getSelectableDates(cfg(0), today)[0]).toBe("2026-07-09");
  });
  it("skips disabled weekdays after lead time", () => {
    const days = { ...allDays, Sonntag: false, Montag: false };
    const today = new Date("2026-07-09T10:00:00"); // Do → +3 = So(disabled) → Mo(disabled) → Di 14.
    expect(getSelectableDates(cfg(3, days), today)[0]).toBe("2026-07-14");
  });
  it("times in 15-min steps inclusive", () => {
    expect(getAvailableTimes({ from: "11:00", to: "11:30" })).toEqual(["11:00", "11:15", "11:30"]);
  });
  it("isSlotAllowed rejects date before lead time", () => {
    const now = new Date("2026-07-09T10:00:00");
    expect(isSlotAllowed("2026-07-10", "11:00", cfg(3), now)).toBe(false);
    expect(isSlotAllowed("2026-07-12", "11:00", cfg(3), now)).toBe(true);
  });
  it("formatDateLabel formats german weekday + date", () => {
    expect(formatDateLabel("2026-07-12")).toBe("So, 12.07.2026");
  });
});
