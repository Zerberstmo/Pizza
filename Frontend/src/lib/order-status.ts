import type { OrderStatus } from "@/types";

export const ORDER_STATUSES: OrderStatus[] = ["eingegangen", "angenommen", "in_arbeit", "fertig", "abgeholt", "storniert"];

const FORWARD: Record<OrderStatus, OrderStatus | null> = {
  eingegangen: "angenommen",
  angenommen: "in_arbeit",
  in_arbeit: "fertig",
  fertig: "abgeholt",
  abgeholt: null,
  storniert: null,
};

export function nextStatus(s: OrderStatus): OrderStatus | null {
  return FORWARD[s];
}

export function isActive(s: OrderStatus): boolean {
  return s !== "abgeholt" && s !== "storniert";
}

// Kunde darf stornieren, solange die Zubereitung noch nicht begonnen hat.
export function isCancellable(s: OrderStatus): boolean {
  return s === "eingegangen" || s === "angenommen";
}

const LABELS: Record<OrderStatus, string> = {
  eingegangen: "Eingegangen",
  angenommen: "Angenommen",
  in_arbeit: "In Arbeit",
  fertig: "Fertig",
  abgeholt: "Abgeholt",
  storniert: "Storniert",
};

export function statusLabel(s: OrderStatus): string {
  return LABELS[s];
}
