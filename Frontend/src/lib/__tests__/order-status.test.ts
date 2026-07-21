import { describe, it, expect } from "bun:test";
import { nextStatus, isActive, isCancellable, statusLabel, ORDER_STATUSES } from "@/lib/order-status";

describe("order-status", () => {
  it("nextStatus folgt dem Vorwärts-Ablauf", () => {
    expect(nextStatus("eingegangen")).toBe("angenommen");
    expect(nextStatus("angenommen")).toBe("in_arbeit");
    expect(nextStatus("in_arbeit")).toBe("fertig");
    expect(nextStatus("fertig")).toBe("abgeholt");
  });
  it("nextStatus: Endzustände → null", () => {
    expect(nextStatus("abgeholt")).toBeNull();
    expect(nextStatus("storniert")).toBeNull();
  });
  it("isActive: nur nicht-abgeholt/storniert", () => {
    expect(isActive("eingegangen")).toBe(true);
    expect(isActive("angenommen")).toBe(true);
    expect(isActive("in_arbeit")).toBe(true);
    expect(isActive("fertig")).toBe(true);
    expect(isActive("abgeholt")).toBe(false);
    expect(isActive("storniert")).toBe(false);
  });
  it("isCancellable: nur vor Zubereitung (eingegangen/angenommen)", () => {
    expect(isCancellable("eingegangen")).toBe(true);
    expect(isCancellable("angenommen")).toBe(true);
    expect(isCancellable("in_arbeit")).toBe(false);
    expect(isCancellable("fertig")).toBe(false);
    expect(isCancellable("abgeholt")).toBe(false);
    expect(isCancellable("storniert")).toBe(false);
  });
  it("statusLabel liefert deutsche Labels", () => {
    expect(statusLabel("in_arbeit")).toBe("In Arbeit");
    expect(statusLabel("eingegangen")).toBe("Eingegangen");
    expect(statusLabel("angenommen")).toBe("Angenommen");
  });
  it("ORDER_STATUSES hat alle 6 in Ablauf-Reihenfolge", () => {
    expect(ORDER_STATUSES).toEqual(["eingegangen","angenommen","in_arbeit","fertig","abgeholt","storniert"]);
  });
});
