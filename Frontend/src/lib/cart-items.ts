import type { CartItem, SpecialCartItem, Tier, OrderRow } from "@/types";
import { BASE_PRICE, clampSpecialQty } from "@/lib/pricing";
import { priceForQty } from "@/lib/special-pricing";

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

export interface SpecialInput {
  specialItemId: string; code: string; name: string; emoji: string; tiers: Tier[];
}

// Reine Reducer: von useCart genutzt, hier für Tests entkoppelt.
export function addSpecialTo(cart: CartItem[], input: SpecialInput, newCartId: string): CartItem[] {
  const idx = cart.findIndex((x) => isSpecialItem(x) && x.specialItemId === input.specialItemId);
  if (idx >= 0) {
    const cur = cart[idx] as SpecialCartItem;
    const quantity = clampSpecialQty(cur.quantity + 1);
    const next = [...cart];
    next[idx] = { ...cur, quantity, lineTotal: priceForQty(cur.tiers, quantity) };
    return next;
  }
  const item: SpecialCartItem = {
    cartId: newCartId, kind: "special", specialItemId: input.specialItemId, code: input.code,
    name: input.name, emoji: input.emoji, tiers: input.tiers, quantity: 1, lineTotal: priceForQty(input.tiers, 1),
  };
  return [...cart, item];
}

export function setSpecialQtyIn(cart: CartItem[], cartId: string, n: number): CartItem[] {
  return cart.map((x) => {
    if (x.cartId !== cartId || !isSpecialItem(x)) return x;
    const quantity = clampSpecialQty(n);
    return { ...x, quantity, lineTotal: priceForQty(x.tiers, quantity) };
  });
}

// Kundenseitige Diskretion: nach Abholung Sonderartikel ausblenden; reine Special-Bestellung ganz entfernen.
export function redactPickedUpSpecials(orders: OrderRow[]): OrderRow[] {
  const out: OrderRow[] = [];
  for (const o of orders) {
    if (o.status !== "abgeholt") { out.push(o); continue; }
    const items = o.items.filter((it) => !isSpecialItem(it));
    if (items.length === 0) continue;
    out.push({ ...o, items });
  }
  return out;
}

// Reine Sonderartikel-Bestellung: keine einzige Pizza im (nicht leeren) Warenkorb.
// TS-Gegenstück zu `pizza_qty = 0` in validate_order (0013) — beide Seiten leiten das
// unabhängig voneinander aus den Positionen ab, der Client behauptet es nicht.
// Leerer Warenkorb => false: der ist gar nicht bestellbar.
export function isSpecialsOnly(items: CartItem[]): boolean {
  return items.length > 0 && pizzaQuantity(items) === 0;
}
