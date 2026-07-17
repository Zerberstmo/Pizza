import { describe, it, expect } from "bun:test";
import { priceForQty } from "@/lib/special-pricing";
import type { Tier } from "@/types";

const tiers: Tier[] = [
  { min_qty: 1, unit_price: 6 },
  { min_qty: 3, unit_price: 4 },
  { min_qty: 10, unit_price: 3 },
];

describe("priceForQty", () => {
  it("Basisstufe: 1 Stück = 6€", () => expect(priceForQty(tiers, 1)).toBe(6));
  it("unter nächster Stufe: 2 Stück = 12€", () => expect(priceForQty(tiers, 2)).toBe(12));
  it("Stufengrenze exakt: 3 Stück = 12€", () => expect(priceForQty(tiers, 3)).toBe(12));
  it("mittlere Stufe: 9 Stück = 36€", () => expect(priceForQty(tiers, 9)).toBe(36));
  it("oberste Stufe: 10 Stück = 30€", () => expect(priceForQty(tiers, 10)).toBe(30));
  it("unsortierte Tiers liefern dasselbe", () => {
    const unsorted: Tier[] = [{ min_qty: 10, unit_price: 3 }, { min_qty: 1, unit_price: 6 }, { min_qty: 3, unit_price: 4 }];
    expect(priceForQty(unsorted, 3)).toBe(12);
  });
  it("qty unter kleinster Stufe nutzt kleinste Stufe", () => {
    expect(priceForQty([{ min_qty: 2, unit_price: 5 }], 1)).toBe(5);
  });
  it("leere Tiers => 0", () => expect(priceForQty([], 3)).toBe(0));
  // Doppeltes min_qty ist Fehleingabe des Admins, muss aber DIESELBE Stufe wählen wie
  // special_line_price (0012): rohe Array-Reihenfolge, strikt größer => der ERSTE Eintrag gewinnt.
  // Sonst zeigt der Warenkorb einen anderen Preis als der Server verbucht (still, ohne Fehler).
  it("doppeltes min_qty: erster Eintrag gewinnt (spiegelt special_line_price)", () => {
    expect(priceForQty([{ min_qty: 2, unit_price: 5 }, { min_qty: 2, unit_price: 8 }], 2)).toBe(10);
  });
});
