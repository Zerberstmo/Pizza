import { createContext, useContext, useEffect, useState } from "react";
import type { CartItem } from "@/types";

const uid = () => Math.random().toString(36).slice(2, 9);
const KEY = "pizza-cart";

interface CartContextValue {
  cart: CartItem[];
  addToCart(pizzaName: string, ingredientIds: string[], sauceId?: string): void;
  removeFromCart(cartId: string): void;
  clearCart(): void;
  count: number;
}
const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>(() => {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  });
  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(cart));
  }, [cart]);

  const addToCart = (pizzaName: string, ingredientIds: string[], sauceId?: string) =>
    setCart((p) => [...p, { cartId: uid(), pizzaName, ingredientIds, sauceId }]);
  const removeFromCart = (cartId: string) => setCart((p) => p.filter((x) => x.cartId !== cartId));
  const clearCart = () => setCart([]);

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, clearCart, count: cart.length }}>
      {children}
    </CartContext.Provider>
  );
}
export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
