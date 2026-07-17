import type { Tier } from "@/types";

// Reine Staffel-Preislogik. SPIEGELT public.special_line_price aus Migration 0012 — synchron halten!
// Semantik: flach je Stufe — Stückpreis der Stufe mit größtem min_qty <= qty, Zeilenpreis = qty * unit_price.
export function priceForQty(tiers: Tier[], qty: number): number {
  if (!tiers || tiers.length === 0) return 0;
  const sorted = [...tiers].sort((a, b) => a.min_qty - b.min_qty); // stabil => Duplikate behalten Array-Reihenfolge
  let chosen = sorted[0]; // Fallback: kleinste Stufe (qty unter kleinster min_qty)
  let chosenMin = -1;
  for (const t of sorted) {
    // Strikt größer (nicht >=) wie special_line_price: bei doppeltem min_qty gewinnt der ERSTE Eintrag.
    if (t.min_qty <= qty && t.min_qty > chosenMin) {
      chosen = t;
      chosenMin = t.min_qty;
    }
  }
  return qty * chosen.unit_price;
}
