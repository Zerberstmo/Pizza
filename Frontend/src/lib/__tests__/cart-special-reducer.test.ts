import { describe, it, expect } from "bun:test";
import { addSpecialTo, setSpecialQtyIn } from "@/lib/cart-items";
import type { CartItem } from "@/types";

const base = { specialItemId: "it1", code: "WEED420", name: "Special", emoji: "🌿", tiers: [{ min_qty: 1, unit_price: 6 }, { min_qty: 3, unit_price: 4 }] };

describe("cart special reducer", () => {
  it("addSpecialTo fügt mit Menge 1 + lineTotal hinzu", () => {
    const next = addSpecialTo([], base, "s1");
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ cartId: "s1", kind: "special", quantity: 1, lineTotal: 6 });
  });
  it("addSpecialTo verschmilzt gleiche specialItemId (Menge +1, lineTotal neu)", () => {
    const once = addSpecialTo([], base, "s1");
    const twice = addSpecialTo(once, base, "s2");
    expect(twice).toHaveLength(1);
    expect(twice[0]).toMatchObject({ quantity: 2, lineTotal: 12 });
  });
  it("setSpecialQtyIn klemmt und rechnet lineTotal über Staffel neu", () => {
    const once = addSpecialTo([], base, "s1");
    const bumped = setSpecialQtyIn(once as CartItem[], "s1", 3);
    expect(bumped[0]).toMatchObject({ quantity: 3, lineTotal: 12 });
  });
});
