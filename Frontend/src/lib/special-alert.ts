// Reiner Nachrichtentext für die Sofort-WhatsApp bei Sonderartikel-Bestellungen.
// Deterministisch: createdTime kommt fertig von außen, damit hier ohne Date/Intl (voll testbar).
// Die Edge Function supabase/functions/notify-special-order/index.ts spiegelt diese Funktion
// als Deno-Copy — bei Änderungen synchron halten!

export interface AlertItem {
  kind?: string;      // "special" | undefined (fehlend = Pizza)
  name?: string;      // Sonderartikel
  emoji?: string;     // Sonderartikel
  pizzaName?: string; // Pizza
  quantity?: number;  // fehlend = 1
}

export interface SpecialAlertOrder {
  id: string;
  createdTime: string; // "HH:MM" in Europe/Berlin
  customerName: string;
  customerPhone: string;
  items: AlertItem[];
  total: number;
  serviceMode: "dinein" | "takeaway";
  notes: string;
}

// Geldformat gespiegelt von lib/pricing.ts formatPrice (special-alert.ts bleibt standalone für die Deno-Copy).
function euro(n: number): string {
  return `${n.toFixed(2).replace(".", ",")} €`;
}

export function formatSpecialAlert(o: SpecialAlertOrder): string {
  const specials = o.items.filter((it) => it.kind === "special");
  const pizzas = o.items.filter((it) => it.kind !== "special");
  const service = o.serviceMode === "dinein" ? "Vor Ort" : "Abholen";
  const lines = [
    "⭐ Sonderartikel-Bestellung",
    `${o.id} · ${o.createdTime} · ${o.customerName} · ${o.customerPhone}`,
    ...specials.map((it) => `  ${it.emoji ?? "⭐"} ${it.name ?? "?"} × ${it.quantity ?? 1}`),
    ...pizzas.map((it) => `  • ${it.pizzaName ?? "?"} × ${it.quantity ?? 1}`),
    `Gesamt ${euro(o.total)} · ${service}`,
  ];
  if (o.notes.trim()) lines.push(`Notiz: ${o.notes.trim()}`);
  return lines.join("\n");
}
