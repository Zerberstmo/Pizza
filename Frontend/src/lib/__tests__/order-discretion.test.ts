import { describe, it, expect } from "bun:test";
import { redactPickedUpSpecials } from "@/lib/cart-items";
import type { OrderRow, PizzaCartItem, SpecialCartItem } from "@/types";

const mk = (status: OrderRow["status"], items: OrderRow["items"]): OrderRow => ({
  id: "#1", publicToken: "t", items, total: 30, serviceMode: "takeaway",
  pickupDate: "2026-07-16", pickupTime: "18:00", notes: "", status, createdAt: "", userId: "u1",
});
const pizza: PizzaCartItem = { cartId: "p", pizzaName: "Marg", ingredientIds: ["cheese"], quantity: 1 };
const special: SpecialCartItem = { cartId: "s", kind: "special", specialItemId: "it", code: "C", name: "S", emoji: "🌿", tiers: [], quantity: 1, lineTotal: 6 };

describe("redactPickedUpSpecials", () => {
  it("aktiv: nichts filtern", () => {
    const out = redactPickedUpSpecials([mk("in_arbeit", [pizza, special])]);
    expect(out[0].items).toHaveLength(2);
  });
  it("abgeholt + gemischt: Special entfernen, Pizza bleibt", () => {
    const out = redactPickedUpSpecials([mk("abgeholt", [pizza, special])]);
    expect(out[0].items).toHaveLength(1);
    expect(out[0].items[0].cartId).toBe("p");
  });
  it("abgeholt + nur Special: Bestellung ganz raus", () => {
    const out = redactPickedUpSpecials([mk("abgeholt", [special])]);
    expect(out).toHaveLength(0);
  });
  it("storniert + gemischt: Special entfernen, Pizza bleibt", () => {
    const out = redactPickedUpSpecials([mk("storniert", [pizza, special])]);
    expect(out[0].items).toHaveLength(1);
    expect(out[0].items[0].cartId).toBe("p");
  });
  it("storniert + nur Special: Bestellung ganz raus", () => {
    const out = redactPickedUpSpecials([mk("storniert", [special])]);
    expect(out).toHaveLength(0);
  });
});
