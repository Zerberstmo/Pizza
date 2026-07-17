import { describe, it, expect, beforeEach } from "bun:test";
import { renderHook, act } from "@testing-library/react";
import { CartProvider, useCart } from "@/hooks/use-cart";
import type { PizzaCartItem } from "@/types";

const wrapper = ({ children }: { children: React.ReactNode }) => <CartProvider>{children}</CartProvider>;
beforeEach(() => localStorage.clear());

describe("useCart", () => {
  it("adds and counts items", () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.addToCart("Margherita", ["mozzarella"]));
    expect(result.current.count).toBe(1);
  });
  it("removes items", () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.addToCart("Salami", []));
    const id = result.current.cart[0].cartId;
    act(() => result.current.removeFromCart(id));
    expect(result.current.count).toBe(0);
  });
  it("persists to localStorage", () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.addToCart("Hawaii", []));
    expect(localStorage.getItem("pizza-cart")).toContain("Hawaii");
  });
  it("übernimmt die sauceId", () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.addToCart("Eigene Pizza", ["salami"], "pesto"));
    // addToCart legt immer Pizza-Positionen an; für den Feldzugriff auf die Pizza-Variante eingrenzen.
    expect((result.current.cart[0] as PizzaCartItem).sauceId).toBe("pesto");
  });
  it("verschmilzt identische Positionen und summiert quantity in count", () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.addToCart("Margherita", ["salami", "mozzarella"]));
    act(() => result.current.addToCart("Margherita", ["mozzarella", "salami"])); // Reihenfolge egal
    expect(result.current.cart).toHaveLength(1);
    expect(result.current.cart[0].quantity).toBe(2);
    expect(result.current.count).toBe(2);
  });
  it("trennt bei unterschiedlicher Soße/Name/Zutat", () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.addToCart("Margherita", ["mozzarella"], "tomate"));
    act(() => result.current.addToCart("Margherita", ["mozzarella"], "pesto"));
    expect(result.current.cart).toHaveLength(2);
  });
  it("increment/decrement/setQuantity klemmt auf [1,20]", () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.addToCart("Salami", []));
    const id = result.current.cart[0].cartId;
    act(() => result.current.decrement(id)); // bleibt 1
    expect(result.current.cart[0].quantity).toBe(1);
    act(() => result.current.setQuantity(id, 99)); // klemmt 20
    expect(result.current.cart[0].quantity).toBe(20);
    act(() => result.current.increment(id)); // bleibt 20
    expect(result.current.cart[0].quantity).toBe(20);
  });
  it("addToCart mit Menge verschmilzt geklemmt (Erneut bestellen)", () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.addToCart("Hawaii", [], undefined, 15));
    act(() => result.current.addToCart("Hawaii", [], undefined, 15)); // 30 → klemmt 20
    expect(result.current.cart[0].quantity).toBe(20);
  });
});
