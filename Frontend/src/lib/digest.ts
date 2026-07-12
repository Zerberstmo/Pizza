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

export interface PrepItem { ingredientIds: string[]; sauceId?: string }
export interface PrepOrder { items: PrepItem[] }

// Aggregierte Einkaufs-/Vorbereitungsliste für einen Tag (Teil-B5). Rein & deterministisch;
// die Edge Function spiegelt diese Funktion als Deno-Copy — bei Änderungen synchron halten.
export function formatPrepList(
  orders: PrepOrder[],
  ingredientNames: Record<string, string>,
  sauceNames: Record<string, string>,
  dateLabel: string,
): string {
  if (orders.length === 0) return "";

  let doughCount = 0;
  const ing: Record<string, number> = {};
  const sau: Record<string, number> = {};
  for (const o of orders) {
    for (const it of o.items) {
      doughCount++;
      for (const id of it.ingredientIds) ing[id] = (ing[id] ?? 0) + 1;
      if (it.sauceId) sau[it.sauceId] = (sau[it.sauceId] ?? 0) + 1;
    }
  }

  const section = (title: string, counts: Record<string, number>, names: Record<string, string>): string => {
    const entries = Object.entries(counts);
    if (entries.length === 0) return "";
    const lines = entries
      .map(([id, c]) => ({ name: names[id] ?? id, c }))
      .sort((a, b) => b.c - a.c || a.name.localeCompare(b.name))
      .map((e) => `  ${e.c}× ${e.name}`);
    return `\n\n${title}:\n${lines.join("\n")}`;
  };

  const doughLabel = `${doughCount} ${doughCount === 1 ? "Pizza" : "Pizzen"} (= ${doughCount} ${doughCount === 1 ? "Teig" : "Teige"})`;
  const header = `🧾 Einkauf/Vorbereitung für morgen, ${dateLabel}\n${doughLabel}`;
  return header + section("Zutaten", ing, ingredientNames) + section("Soßen", sau, sauceNames);
}
