// Reine Digest-Logik (Teil-B3). Deterministisch: dateLabel/todayIso kommen von außen,
// damit hier ohne Date/Intl (und damit voll testbar). Die Edge Function spiegelt formatDigest (Deno-Copy).

export interface DigestOrder {
  pickupDate: string;   // "YYYY-MM-DD"
  pickupTime: string;   // "HH:MM"
  customerName: string;
  customerPhone: string;
  items: { pizzaName: string }[];
  total: number;
  serviceMode: "dinein" | "takeaway";
  notes: string;
}

// Geldformat gespiegelt von lib/pricing.ts formatPrice (digest.ts bleibt standalone für die Deno-Copy).
function euro(n: number): string {
  return `${n.toFixed(2).replace(".", ",")} €`;
}

export function filterTodaysPickups(orders: DigestOrder[], todayIso: string): DigestOrder[] {
  return orders
    .filter((o) => o.pickupDate === todayIso)
    .sort((a, b) => a.pickupTime.localeCompare(b.pickupTime));
}

export function formatDigest(orders: DigestOrder[], dateLabel: string): string {
  if (orders.length === 0) return "";
  const sum = orders.reduce((s, o) => s + o.total, 0);
  const countLabel = `${orders.length} ${orders.length === 1 ? "Bestellung" : "Bestellungen"}`;
  const header = `🍕 Abholungen heute, ${dateLabel}\n${countLabel} · gesamt ${euro(sum)}`;

  const blocks = orders.map((o) => {
    const pizzaCount = o.items.length;
    const pizzaLabel = `${pizzaCount} ${pizzaCount === 1 ? "Pizza" : "Pizzen"}`;
    const service = o.serviceMode === "dinein" ? "Vor Ort" : "Abholen";
    const lines = [
      `${o.pickupTime} · ${o.customerName} · ${o.customerPhone}`,
      `  ${pizzaLabel} · ${euro(o.total)} · ${service}`,
      ...o.items.map((it) => `  • ${it.pizzaName}`),
    ];
    if (o.notes.trim()) lines.push(`  Notiz: ${o.notes.trim()}`);
    return lines.join("\n");
  });

  return `${header}\n\n${blocks.join("\n\n")}`;
}
