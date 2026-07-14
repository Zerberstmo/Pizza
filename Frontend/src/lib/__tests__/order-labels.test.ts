import { describe, it, expect } from "bun:test";
import { buildLabels } from "@/lib/order-labels";
import type { IngredientItem, Sauce } from "@/types";

const ing = (id: string, name: string): IngredientItem => ({ id, name, emoji: "🍕", category: "Gemüse", available: true, description: "" });
const sauce = (id: string, name: string): Sauce => ({ id, name, emoji: "🥫", color: "#f00", available: true });

describe("buildLabels", () => {
  it("kombiniert Zutaten- und Soßen-IDs → Namen", () => {
    expect(buildLabels([ing("salami", "Salami")], [sauce("tomate", "Tomatensauce")]))
      .toEqual({ salami: "Salami", tomate: "Tomatensauce" });
  });
  it("leere Listen → {}", () => {
    expect(buildLabels([], [])).toEqual({});
  });
  it("mehrere Einträge, keine verlorenen Keys", () => {
    expect(buildLabels([ing("a", "A"), ing("b", "B")], [sauce("c", "C")]))
      .toEqual({ a: "A", b: "B", c: "C" });
  });
});
