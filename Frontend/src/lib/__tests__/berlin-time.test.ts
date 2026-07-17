import { describe, it, expect } from "bun:test";
import { berlinDateTime } from "@/lib/berlin-time";

describe("berlinDateTime", () => {
  it("Sommerzeit: UTC+2", () => {
    // 2026-07-17 19:42 UTC = 21:42 Berlin (CEST)
    expect(berlinDateTime(new Date("2026-07-17T19:42:00Z"))).toEqual({ date: "2026-07-17", time: "21:42" });
  });
  it("Winterzeit: UTC+1", () => {
    // 2026-01-15 23:30 UTC = 2026-01-16 00:30 Berlin (CET) — Datum kippt mit
    expect(berlinDateTime(new Date("2026-01-15T23:30:00Z"))).toEqual({ date: "2026-01-16", time: "00:30" });
  });
  it("Mitternacht wird 00:00, nicht 24:00", () => {
    expect(berlinDateTime(new Date("2026-07-16T22:00:00Z")).time).toBe("00:00");
  });
});
