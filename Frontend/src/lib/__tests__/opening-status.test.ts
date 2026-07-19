import { describe, it, expect } from "bun:test";
import { openingStatus, relativeDateLabel } from "@/lib/opening-status";
import type { AppConfig } from "@/types";

const base: AppConfig = {
  days: {},
  hours: { from: "11:00", to: "14:00" },
  leadTimeDays: 0,
  service: { dineIn: false, takeaway: true },
  dashboardResetAt: null,
};
const now = new Date("2026-07-20T12:00:00"); // Mo, 12:00 in [11:00..14:00]

describe("openingStatus", () => {
  it("offen: heute in open_days + Uhrzeit drin + Service", () => {
    const s = openingStatus(base, ["2026-07-20"], now);
    expect(s.openNow).toBe(true);
    expect(s.nextPickup).toEqual({ date: "2026-07-20", time: "11:00" });
  });
  it("außerhalb der Uhrzeiten → geschlossen", () => {
    expect(openingStatus(base, ["2026-07-20"], new Date("2026-07-20T15:00:00")).openNow).toBe(false);
  });
  it("heute nicht in open_days → geschlossen", () => {
    expect(openingStatus(base, ["2026-07-25"], now).openNow).toBe(false);
  });
  it("kein Service → geschlossen", () => {
    const cfg = { ...base, service: { dineIn: false, takeaway: false } };
    expect(openingStatus(cfg, ["2026-07-20"], now).openNow).toBe(false);
  });
  it("leeres openDays → nextPickup null", () => {
    expect(openingStatus(base, [], now).nextPickup).toBeNull();
  });
  it("Vorlaufzeit schiebt nextPickup nach vorn", () => {
    const cfg = { ...base, leadTimeDays: 2 };
    const s = openingStatus(cfg, ["2026-07-20", "2026-07-25"], now);
    expect(s.nextPickup?.date).toBe("2026-07-25"); // 20. < 20.+2=22.
  });
});

describe("relativeDateLabel", () => {
  it("heute", () => expect(relativeDateLabel("2026-07-20", now)).toBe("heute"));
  it("morgen", () => expect(relativeDateLabel("2026-07-21", now)).toBe("morgen"));
  it("übermorgen → Wochentag+Datum", () => expect(relativeDateLabel("2026-07-22", now)).toBe("Mi, 22.07."));
});
