import { describe, it, expect } from "bun:test";
import { describeItem, rowToPublicStatus } from "@/lib/public-order";
import type { CartItem, SpecialCartItem } from "@/types";

const labels = { tomate: "Tomatensauce", salami: "Salami", champ: "Champignons" };

describe("describeItem", () => {
  it("verbindet Soße + Zutaten in Reihenfolge", () => {
    const item: CartItem = { cartId: "c1", pizzaName: "Salami", ingredientIds: ["salami", "champ"], sauceId: "tomate", quantity: 1 };
    expect(describeItem(item, labels)).toBe("Tomatensauce, Salami, Champignons");
  });
  it("überspringt fehlende Labels", () => {
    const item: CartItem = { cartId: "c2", pizzaName: "X", ingredientIds: ["salami", "unbekannt"], sauceId: undefined, quantity: 1 };
    expect(describeItem(item, labels)).toBe("Salami");
  });
  it("leere Zutaten/keine Soße → Fallback", () => {
    const item: CartItem = { cartId: "c3", pizzaName: "Margherita", ingredientIds: [], sauceId: undefined, quantity: 1 };
    expect(describeItem(item, labels)).toBe("Käse & Sauce");
  });
  it("Sonderartikel liefert 'Sonderartikel'", () => {
    const special = { cartId: "s", kind: "special", specialItemId: "it", code: "C", name: "S", emoji: "🌿", tiers: [], quantity: 1, lineTotal: 6 } as SpecialCartItem;
    expect(describeItem(special, {})).toBe("Sonderartikel");
  });
});

describe("rowToPublicStatus", () => {
  it("mappt snake_case → camelCase und setzt Defaults", () => {
    const row = {
      id: "#42", status: "in_arbeit", pickup_date: "2026-07-14", pickup_time: "18:00",
      service_mode: "takeaway", items: [{ cartId: "c1", pizzaName: "Salami", ingredientIds: ["salami"], sauceId: "tomate", quantity: 1 }],
      total: "20", created_at: "2026-07-13T10:00:00Z", labels: { salami: "Salami" },
    };
    const s = rowToPublicStatus(row);
    expect(s.id).toBe("#42");
    expect(s.status).toBe("in_arbeit");
    expect(s.pickupDate).toBe("2026-07-14");
    expect(s.serviceMode).toBe("takeaway");
    expect(s.total).toBe(20);
    expect(s.labels).toEqual({ salami: "Salami" });
    expect(s.items).toHaveLength(1);
  });
  it("fehlende items/labels → leere Defaults", () => {
    const s = rowToPublicStatus({ id: "#1", status: "eingegangen", pickup_date: "x", pickup_time: "y", service_mode: "takeaway", total: 0, created_at: "z" });
    expect(s.items).toEqual([]);
    expect(s.labels).toEqual({});
  });
});
