import { describe, it, expect, beforeEach } from "bun:test";
import { renderHook, act } from "@testing-library/react";
import { CartProvider, useCart } from "@/hooks/use-cart";

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
    expect(result.current.cart[0].sauceId).toBe("pesto");
  });
});
