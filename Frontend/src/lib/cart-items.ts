import type { CartItem, SpecialCartItem } from "@/types";
import { BASE_PRICE } from "@/lib/pricing";

export function isSpecialItem(item: CartItem): item is SpecialCartItem {
  return item.kind === "special";
}

export function itemTitle(item: CartItem): string {
  return isSpecialItem(item) ? `${item.emoji} ${item.name}` : item.pizzaName;
}

export function itemLineTotal(item: CartItem): number {
  return isSpecialItem(item) ? item.lineTotal : BASE_PRICE * (item.quantity ?? 1);
}

export function pizzaQuantity(items: CartItem[]): number {
  return items.reduce((s, i) => (isSpecialItem(i) ? s : s + (i.quantity ?? 1)), 0);
}

export function specialsTotal(items: CartItem[]): number {
  return items.reduce((s, i) => (isSpecialItem(i) ? s + i.lineTotal : s), 0);
}

export function cartSubtotal(items: CartItem[]): number {
  return BASE_PRICE * pizzaQuantity(items) + specialsTotal(items);
}
