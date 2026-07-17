import { describe, it, expect } from "bun:test";
import { isSpecialItem, itemTitle, itemLineTotal, pizzaQuantity, specialsTotal, cartSubtotal, isSpecialsOnly } from "@/lib/cart-items";
import type { CartItem, PizzaCartItem, SpecialCartItem } from "@/types";

const pizza: PizzaCartItem = { cartId: "p1", pizzaName: "Margherita", ingredientIds: ["cheese"], quantity: 2 };
const special: SpecialCartItem = {
  cartId: "s1", kind: "special", specialItemId: "it1", code: "WEED420",
  name: "Special", emoji: "🌿", tiers: [{ min_qty: 1, unit_price: 6 }], quantity: 3, lineTotal: 18,
};
const cart: CartItem[] = [pizza, special];

describe("cart-items", () => {
  it("isSpecialItem erkennt Specials", () => {
    expect(isSpecialItem(special)).toBe(true);
    expect(isSpecialItem(pizza)).toBe(false);
  });
  it("itemTitle: Pizza=Name, Special=Emoji+Name", () => {
    expect(itemTitle(pizza)).toBe("Margherita");
    expect(itemTitle(special)).toBe("🌿 Special");
  });
  it("itemLineTotal: Pizza=10*qty, Special=lineTotal", () => {
    expect(itemLineTotal(pizza)).toBe(20);
    expect(itemLineTotal(special)).toBe(18);
  });
  it("pizzaQuantity zählt nur Pizzas", () => expect(pizzaQuantity(cart)).toBe(2));
  it("specialsTotal summiert lineTotal der Specials", () => expect(specialsTotal(cart)).toBe(18));
  it("cartSubtotal = 10*Pizzamenge + Specials", () => expect(cartSubtotal(cart)).toBe(38));
});

describe("isSpecialsOnly", () => {
  it("nur Sonderartikel => true", () => expect(isSpecialsOnly([special])).toBe(true));
  it("gemischt => false", () => expect(isSpecialsOnly(cart)).toBe(false));
  it("nur Pizza => false", () => expect(isSpecialsOnly([pizza])).toBe(false));
  it("leerer Warenkorb => false (nicht bestellbar, nicht 'sofort')", () => expect(isSpecialsOnly([])).toBe(false));
});
