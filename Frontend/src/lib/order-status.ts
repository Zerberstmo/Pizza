import type { OrderStatus } from "@/types";

export const ORDER_STATUSES: OrderStatus[] = ["eingegangen", "in_arbeit", "fertig", "abgeholt", "storniert"];

const FORWARD: Record<OrderStatus, OrderStatus | null> = {
  eingegangen: "in_arbeit",
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

const LABELS: Record<OrderStatus, string> = {
  eingegangen: "Eingegangen",
  in_arbeit: "In Arbeit",
  fertig: "Fertig",
  abgeholt: "Abgeholt",
  storniert: "Storniert",
};

export function statusLabel(s: OrderStatus): string {
  return LABELS[s];
}
