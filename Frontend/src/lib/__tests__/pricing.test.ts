import { describe, it, expect } from "bun:test";
import { formatPrice, computeSubtotal, computeDiscount, computeTotal, validateVoucher } from "@/lib/pricing";
import type { VoucherDef } from "@/types";

const percent: VoucherDef = { id: "1", name: "P", code: "WELCOME10", type: "percent", value: 10, expiresAt: "2999-01-01", active: true, maxUses: 0, uses: 0 };
const fixed: VoucherDef   = { id: "2", name: "F", code: "PIZZA5",    type: "fixed",   value: 5,  expiresAt: "2999-01-01", active: true, maxUses: 0, uses: 0 };
const ingr: VoucherDef    = { id: "3", name: "W", code: "WEED420",   type: "ingredient", value: 0, ingredientName: "Weed", expiresAt: "2999-01-01", active: true, maxUses: 0, uses: 0 };

describe("pricing", () => {
  it("formats german price", () => expect(formatPrice(10)).toBe("10,00 €"));
  it("subtotal = 10€ * count", () => expect(computeSubtotal(3)).toBe(30));
  it("percent discount", () => expect(computeDiscount(20, percent)).toBe(2));
  it("fixed discount", () => expect(computeDiscount(20, fixed)).toBe(5));
  it("ingredient voucher => no money discount", () => expect(computeDiscount(20, ingr)).toBe(0));
  it("no voucher => 0", () => expect(computeDiscount(20, null)).toBe(0));
  it("total never below 0", () => expect(computeTotal(3, 5)).toBe(0));
  it("validateVoucher: unknown code", () => {
    const r = validateVoucher("NOPE", [percent], new Date("2025-01-01"));
    expect(r.ok).toBe(false);
  });
  it("validateVoucher: expired", () => {
    const exp = { ...percent, expiresAt: "2020-01-01" };
    expect(validateVoucher("WELCOME10", [exp], new Date("2025-01-01")).ok).toBe(false);
  });
  it("validateVoucher: valid percent", () => {
    const r = validateVoucher("WELCOME10", [percent], new Date("2025-01-01"));
    expect(r.ok).toBe(true);
  });
  it("validateVoucher: aufgebraucht (uses >= maxUses)", () => {
    const used = { ...percent, maxUses: 5, uses: 5 };
    const r = validateVoucher("WELCOME10", [used], new Date("2025-01-01"));
    expect(r.ok).toBe(false);
  });
  it("validateVoucher: maxUses 0 = unbegrenzt bleibt gültig trotz uses", () => {
    const unlimited = { ...percent, maxUses: 0, uses: 999 };
    expect(validateVoucher("WELCOME10", [unlimited], new Date("2025-01-01")).ok).toBe(true);
  });
});
