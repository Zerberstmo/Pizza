import { createContext, useContext, useEffect, useState } from "react";
import type { CartItem } from "@/types";
import { clampQty, cartQuantity } from "@/lib/pricing";

const uid = () => Math.random().toString(36).slice(2, 9);
const KEY = "pizza-cart";

const cartKey = (i: Pick<CartItem, "pizzaName" | "ingredientIds" | "sauceId">) =>
  `${i.pizzaName}|${[...i.ingredientIds].sort().join(",")}|${i.sauceId ?? ""}`;

interface CartContextValue {
  cart: CartItem[];
  addToCart(pizzaName: string, ingredientIds: string[], sauceId?: string, qty?: number): void;
  removeFromCart(cartId: string): void;
  setQuantity(cartId: string, n: number): void;
  increment(cartId: string): void;
  decrement(cartId: string): void;
  clearCart(): void;
  count: number;
}
const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>(() => {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    // Abwärtskompatibel: Alt-Einträge ohne quantity → 1.
    return (JSON.parse(raw) as CartItem[]).map((i) => ({ ...i, quantity: clampQty(i.quantity ?? 1) }));
  });
  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(cart));
  }, [cart]);

  const addToCart = (pizzaName: string, ingredientIds: string[], sauceId?: string, qty = 1) =>
    setCart((p) => {
      const key = cartKey({ pizzaName, ingredientIds, sauceId });
      const idx = p.findIndex((x) => cartKey(x) === key);
      if (idx >= 0) {
        const next = [...p];
        next[idx] = { ...next[idx], quantity: clampQty(next[idx].quantity + qty) };
        return next;
      }
      return [...p, { cartId: uid(), pizzaName, ingredientIds, sauceId, quantity: clampQty(qty) }];
    });

  const removeFromCart = (cartId: string) => setCart((p) => p.filter((x) => x.cartId !== cartId));
  const setQuantity = (cartId: string, n: number) =>
    setCart((p) => p.map((x) => (x.cartId === cartId ? { ...x, quantity: clampQty(n) } : x)));
  const increment = (cartId: string) =>
    setCart((p) => p.map((x) => (x.cartId === cartId ? { ...x, quantity: clampQty(x.quantity + 1) } : x)));
  const decrement = (cartId: string) =>
    setCart((p) => p.map((x) => (x.cartId === cartId ? { ...x, quantity: clampQty(x.quantity - 1) } : x)));
  const clearCart = () => setCart([]);

  return (
    <CartContext.Provider
      value={{ cart, addToCart, removeFromCart, setQuantity, increment, decrement, clearCart, count: cartQuantity(cart) }}
    >
      {children}
    </CartContext.Provider>
  );
}
export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
