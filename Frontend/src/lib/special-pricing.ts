import type { Tier } from "@/types";

// Reine Staffel-Preislogik. SPIEGELT public.special_line_price aus Migration 0012 — synchron halten!
// Semantik: flach je Stufe — Stückpreis der Stufe mit größtem min_qty <= qty, Zeilenpreis = qty * unit_price.
export function priceForQty(tiers: Tier[], qty: number): number {
  if (!tiers || tiers.length === 0) return 0;
  const sorted = [...tiers].sort((a, b) => a.min_qty - b.min_qty);
  let chosen = sorted[0]; // Fallback: kleinste Stufe (qty unter kleinster min_qty)
  for (const t of sorted) {
    if (t.min_qty <= qty) chosen = t;
  }
  return qty * chosen.unit_price;
}
