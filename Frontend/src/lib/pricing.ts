import type { VoucherDef } from "@/types";

export const BASE_PRICE = 10.0;

export const MAX_QTY = 20;

export function clampQty(n: number): number {
  return Math.max(1, Math.min(MAX_QTY, Math.floor(n)));
}

export const MAX_SPECIAL_QTY = 99;

export function clampSpecialQty(n: number): number {
  return Math.max(1, Math.min(MAX_SPECIAL_QTY, Math.floor(n)));
}

export function cartQuantity(items: { quantity?: number }[]): number {
  return items.reduce((s, i) => s + (i.quantity ?? 1), 0);
}

export function formatPrice(n: number): string {
  return `${n.toFixed(2).replace(".", ",")} €`;
}

export function computeSubtotal(itemCount: number): number {
  return BASE_PRICE * itemCount;
}

export function computeDiscount(subtotal: number, voucher: VoucherDef | null): number {
  if (!voucher || voucher.type === "ingredient") return 0;
  return voucher.type === "percent" ? (subtotal * voucher.value) / 100 : voucher.value;
}

export function computeTotal(subtotal: number, discount: number): number {
  return Math.max(0, subtotal - discount);
}

export type VoucherResult =
  | { ok: true; voucher: VoucherDef; message: string }
  | { ok: false; message: string };

export function validateVoucher(code: string, vouchers: VoucherDef[], now: Date): VoucherResult {
  const found = vouchers.find((v) => v.code === code && v.active);
  if (!found) return { ok: false, message: "Ungültiger Code." };
  if (new Date(found.expiresAt) < now) return { ok: false, message: "Gutschein abgelaufen." };
  // Parität zum validate_order-Trigger: aufgebraucht → ungültig (max_uses <= 0 = unbegrenzt).
  if (found.maxUses > 0 && found.uses >= found.maxUses) return { ok: false, message: "Gutschein aufgebraucht." };
  const message = found.type === "ingredient"
    ? `Sonderzutat: ${found.ingredientName} 🎁`
    : "Erfolgreich eingelöst!";
  return { ok: true, voucher: found, message };
}
