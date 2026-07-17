import { describe, it, expect } from "bun:test";
import { computeDashboard, type DashboardOrder } from "@/lib/dashboard";

const ing = { i_sal: "Salami", i_mush: "Champignons", i_pap: "Paprika" };
const o = (over: Partial<DashboardOrder>): DashboardOrder => ({
  total: 10, status: "eingegangen",
  items: [{ pizzaName: "Margherita", ingredientIds: ["i_sal"] }], ...over,
});

describe("computeDashboard", () => {
  it("leere Liste → Nullwerte", () => {
    const s = computeDashboard([], ing);
    expect(s.totalCount).toBe(0);
    expect(s.totalRevenue).toBe(0);
    expect(s.avgOrderValue).toBe(0);
    expect(s.topIngredient).toBeNull();
    expect(s.topPizzas).toEqual([]);
    expect(s.topIngredients).toEqual([]);
  });
  it("zählt Anzahl/Umsatz/Ø, storniert ausgeschlossen", () => {
    const s = computeDashboard([
      o({ total: 20 }), o({ total: 10 }), o({ total: 999, status: "storniert" }),
    ], ing);
    expect(s.totalCount).toBe(2);
    expect(s.totalRevenue).toBe(30);
    expect(s.avgOrderValue).toBe(15);
  });
  it("beliebteste Pizzen: Häufigkeit, Eigene zusammengefasst, sortiert", () => {
    const s = computeDashboard([
      o({ items: [{ pizzaName: "Eigene Pizza", ingredientIds: [] }] }),
      o({ items: [{ pizzaName: "Eigene Pizza", ingredientIds: [] }] }),
      o({ items: [{ pizzaName: "Margherita", ingredientIds: [] }] }),
    ], ing);
    expect(s.topPizzas[0]).toEqual({ day: "Eigene Pizza", n: 2 });
    expect(s.topPizzas[1]).toEqual({ day: "Margherita", n: 1 });
  });
  it("Top-Zutaten mit Namensauflösung + topIngredient", () => {
    const s = computeDashboard([
      o({ items: [{ pizzaName: "P", ingredientIds: ["i_sal", "i_mush"] }] }),
      o({ items: [{ pizzaName: "P", ingredientIds: ["i_sal"] }] }),
    ], ing);
    expect(s.topIngredient).toEqual({ name: "Salami", v: 2 });
    expect(s.topIngredients.map((t) => t.name)).toEqual(["Salami", "Champignons"]);
  });
  it("unbekannte Zutaten-id → Fallback auf die id", () => {
    const s = computeDashboard([o({ items: [{ pizzaName: "P", ingredientIds: ["i_x"] }] })], ing);
    expect(s.topIngredients[0]).toEqual({ name: "i_x", v: 1 });
  });
  it("Sonderartikel: nicht in Pizza-/Zutaten-Zählung, aber Umsatz zählt", () => {
    const stats = computeDashboard([
      { total: 30, status: "eingegangen", items: [
        { pizzaName: "Margherita", ingredientIds: ["cheese"], quantity: 2 },
        { kind: "special", pizzaName: "", ingredientIds: [], quantity: 3 },
      ] },
    ], { cheese: "Käse" });
    expect(stats.totalRevenue).toBe(30);                            // Umsatz via order.total unverändert
    expect(stats.topPizzas).toEqual([{ day: "Margherita", n: 2 }]); // Special nicht als Pizza
    expect(stats.topIngredients).toEqual([{ name: "Käse", v: 2 }]); // Special-Menge nicht auf Zutaten
  });
  it("gewichtet Pizza-/Zutaten-Zählung mit quantity (fehlend = 1)", () => {
    const stats = computeDashboard(
      [
        { total: 30, status: "eingegangen", items: [{ pizzaName: "Margherita", ingredientIds: ["m"], quantity: 3 }] },
        { total: 10, status: "eingegangen", items: [{ pizzaName: "Salami", ingredientIds: ["m"] }] }, // kein quantity → 1
      ],
      { m: "Mozzarella" },
    );
    expect(stats.topPizzas.find((p) => p.day === "Margherita")?.n).toBe(3);
    expect(stats.topIngredient).toEqual({ name: "Mozzarella", v: 4 }); // 3 + 1
  });
});
