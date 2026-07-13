# Design: Admin-Dashboard auf Live-Daten

- **Datum:** 2026-07-13
- **Status:** genehmigt (User-Freigabe des Designs)
- **Kontext:** Das Admin-Dashboard (`/admin/dashboard`) zeigt bisher **Mock-Daten**: die Kacheln sind hart kodiert, und `getDashboardStats()` (in `lib/data/store.ts`) liefert `{ week: WEEK_DATA, toppings: PIE_DATA }` aus dem Seed. Kommentar dort: „TEIL-B-später: echte Aggregation". Das Supabase-Backend ist seit 2026-07-13 produktiv.

## Ziel

Das Dashboard zeigt echte, aggregierte Kennzahlen aus der `orders`-Tabelle. Fokus **Gesamt** (privater Betrieb, keine Wochen-Statistik). `storniert`-Bestellungen werden überall ausgeschlossen.

## Nicht-Ziele

- Keine Zeitraum-/Wochen-Auswertung, kein „heute"-Bezug (bewusst rein Gesamt).
- Keine serverseitige Aggregation (kein SQL-View/RPC) — Aggregation client-seitig in getesteter TS-Logik.
- Kein UI-Umbau über die bestehenden 4 Kacheln + 2 Diagramme hinaus.

## Umgebungs-Realität

Wie bisher: **Umgebung erreicht Supabase NICHT.** Verifiziert wird nur `bun run build` + `bun test src`. Die reine Aggregations-Logik wird ausgelagert und getestet; das Laden der Daten (`getOrders`/`getIngredients`, admin-RLS) testet der Betreiber real.

## Inhalt

**4 Kacheln** (all-time, ohne `storniert`):
1. **Bestellungen gesamt** — Anzahl.
2. **Umsatz gesamt** — Summe `total`.
3. **Ø-Bestellwert** — Umsatz ÷ Anzahl (bei 0 Bestellungen → 0).
4. **Top-Zutat** — häufigste Zutat (Name + Anzahl); ohne Daten „—".

**2 Diagramme:**
- **Balken „Beliebteste Pizzen":** Häufigkeit je `pizzaName` über alle Bestell-Items; Eigenkreationen teilen sich den Namen „Eigene Pizza" und werden dadurch zusammengefasst; Top 6 absteigend.
- **Donut „Beliebteste Zutaten":** Häufigkeit je `ingredientId` über alle Items, Namen über die `ingredients`-Tabelle aufgelöst; Top 5 absteigend.

Umsatz-/Geldwerte über `formatPrice` aus `lib/pricing.ts`.

## Architektur

### Reine Logik — `Frontend/src/lib/dashboard.ts` (getestet)

```ts
export interface DashboardOrder {
  total: number;
  status: string;
  items: { pizzaName: string; ingredientIds: string[] }[];
}

export interface DashboardStats {
  totalCount: number;
  totalRevenue: number;
  avgOrderValue: number;
  topIngredient: { name: string; v: number } | null;
  topPizzas: { day: string; n: number }[];       // Form für SvgBarChart
  topIngredients: { name: string; v: number }[]; // Form für SvgDonutChart
}

export function computeDashboard(
  orders: DashboardOrder[],
  ingredientNames: Record<string, string>,
): DashboardStats
```

- Zuerst `status === 'storniert'` herausfiltern.
- `totalCount` = Anzahl; `totalRevenue` = Σ `total`; `avgOrderValue` = `totalCount ? totalRevenue / totalCount : 0`.
- Pizzen: `pizzaName` über alle Items zählen → absteigend (bei Gleichstand Name aufsteigend) → Top 6 als `{ day: name, n: count }`.
- Zutaten: `ingredientId` über alle Items zählen → Name via `ingredientNames[id] ?? id` → absteigend (Gleichstand Name aufsteigend) → Top 5 als `{ name, v: count }`.
- `topIngredient` = erstes Element von `topIngredients` (vor dem Top-5-Schnitt identisch, da #1) oder `null`.
- `OrderRow` (aus `getOrders`) ist strukturell zu `DashboardOrder` kompatibel (hat `total`, `status`, `items` mit `pizzaName`/`ingredientIds`) → wird direkt übergeben.

### Store — `getDashboardStats()` echt

```ts
export async function getDashboardStats(): Promise<DashboardStats> {
  const [orders, ingredients] = await Promise.all([getOrders(), getIngredients()]);
  const names = Object.fromEntries(ingredients.map((i) => [i.id, i.name]));
  return computeDashboard(orders, names);
}
```
- `WEEK_DATA`/`PIE_DATA`-Import + der `delay`-Mock entfallen, falls dadurch ungenutzt (noUnusedLocals) — entsprechend bereinigen.

### Seite — `dashboard-page.tsx`

- Kachel-Werte aus `stats` statt hart kodiert (Top-Zutat: `stats.topIngredient?.name ?? "—"`, Sub `${v}× gewählt`).
- Balken: `stats.topPizzas`; Donut + Legende: `stats.topIngredients`.
- **Leerer Zustand:** bei 0 Bestellungen bzw. leeren Chart-Daten einen Hinweis („Noch keine Daten") statt der Diagramme rendern (die SVG-Charts dividieren sonst durch 0 / `Math.max()` von leer).

## Tests & Verifikation

- **bun:test** (`Frontend/src/lib/__tests__/dashboard.test.ts`): `computeDashboard` — Zählung/Summe/Ø, `storniert` ausgeschlossen, Pizzen-Top-Sortierung inkl. „Eigene Pizza"-Zusammenfassung, Zutaten-Top-5 + Namensauflösung + Fallback, `topIngredient`, leeres Array → Nullwerte/leere Listen/`null`.
- **`bun run build`** grün.
- **Live-Daten (`getOrders`/`getIngredients`):** hier nicht ausführbar → Betreiber prüft real im Dashboard.

## Betroffene Dateien

**Neu:** `Frontend/src/lib/dashboard.ts`, `Frontend/src/lib/__tests__/dashboard.test.ts`.
**Geändert:** `Frontend/src/lib/data/store.ts` (`getDashboardStats` echt + Import-Bereinigung), `Frontend/src/pages/admin/dashboard-page.tsx` (Kacheln/Charts an echte Werte + Leerzustand), Doku (Changelog/README) am Ende.

## Definition of Done

- `computeDashboard` + Tests grün; `getDashboardStats` liest echte `orders`+`ingredients`; Kacheln + beide Charts zeigen aggregierte Werte; `storniert` ausgeschlossen; Leerzustand sauber; `bun run build` + Tests grün.
- Nach Betreiber-Check: das Live-Dashboard zeigt reale Bestellzahl/Umsatz/Ø/Top-Zutat + beliebteste Pizzen/Zutaten.
- Doku aktualisiert (Mock-Hinweis entfernt).
