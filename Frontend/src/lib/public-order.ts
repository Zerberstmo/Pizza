import type { CartItem, PublicOrderStatus } from "@/types";
import { isSpecialItem } from "@/lib/cart-items";

// Zutaten-/Soßennamen einer Bestellposition auflösen (Reihenfolge: Soße, dann Zutaten).
// labels = Map id->Name (aus der get_order_status-RPC). Fehlende Labels werden übersprungen.
export function describeItem(item: CartItem, labels: Record<string, string>): string {
  if (isSpecialItem(item)) return "Sonderartikel";
  const parts = [
    item.sauceId ? labels[item.sauceId] : undefined,
    ...item.ingredientIds.map((id) => labels[id]),
  ].filter(Boolean);
  return parts.join(", ") || "Käse & Sauce";
}

// RPC-Row (snake_case) → PublicOrderStatus (camelCase).
export function rowToPublicStatus(row: any): PublicOrderStatus {
  return {
    id: row.id,
    status: row.status,
    pickupDate: row.pickup_date,
    pickupTime: row.pickup_time,
    serviceMode: row.service_mode,
    items: row.items ?? [],
    total: Number(row.total),
    createdAt: row.created_at,
    labels: row.labels ?? {},
  };
}
