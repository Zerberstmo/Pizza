# Admin-Dashboard Live-Daten — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Das Admin-Dashboard zeigt echte, aggregierte Gesamt-Kennzahlen aus `orders` (statt Mock): Bestellungen gesamt, Umsatz gesamt, Ø-Bestellwert, Top-Zutat + Diagramme „Beliebteste Pizzen"/„Beliebteste Zutaten", `storniert` ausgeschlossen.

**Architecture:** Reine, getestete Aggregations-Funktion `computeDashboard` in `lib/dashboard.ts`; `getDashboardStats()` lädt echte `orders`+`ingredients` und ruft sie; die Dashboard-Seite hängt Kacheln + Charts an die echten Werte. Client-seitig, kein SQL.

**Tech Stack:** Vite, React 18, TS, Bun. Tests: bun:test.

## Global Constraints

- **Umgebung erreicht Supabase NICHT.** Jeder Task verifiziert NUR `cd Frontend && bun run build` + `cd Frontend && bun test src`. Datenladen (`getOrders`/`getIngredients`, admin-RLS) testet der Betreiber real.
- Bun. Build/Test aus `Frontend/`.
- Alles **all-time**, `status === 'storniert'` überall ausschließen. Geldwerte über `formatPrice` (`lib/pricing.ts`).
- Chart-Datenformen (bestehende Komponenten): `SvgBarChart` → `{ day: string; n: number }[]`; `SvgDonutChart` → `{ name: string; v: number }[]`.
- **Referenz-Spec:** `docs/superpowers/specs/2026-07-13-dashboard-live-design.md`.
- Doku-Task am Ende; Build nach jedem Task grün. Implementer NICHT Fable.

---

## Dateistruktur (Ziel)

```
Frontend/src/lib/dashboard.ts                     (N) computeDashboard + Typen
Frontend/src/lib/__tests__/dashboard.test.ts      (N) Tests
Frontend/src/lib/data/store.ts                    (M) getDashboardStats echt + Import-Bereinigung
Frontend/src/pages/admin/dashboard-page.tsx       (M) Kacheln/Charts an echte Werte + Leerzustand
Doku/... , Changelog/README                        (M) Doku (Task 4)
```

---

### Task 1: `computeDashboard` + Tests

**Files:**
- Create: `Frontend/src/lib/dashboard.ts`
- Test: `Frontend/src/lib/__tests__/dashboard.test.ts`

**Interfaces:**
- Produces: `DashboardOrder`, `DashboardStats`, `computeDashboard(orders, ingredientNames)` (siehe Code).

- [ ] **Step 1: Failing Tests** (`Frontend/src/lib/__tests__/dashboard.test.ts`)

```ts
import { describe, it, expect } from "bun:test";
import { computeDashboard, type DashboardOrder } from "@/lib/dashboard";

const ing = { i_sal: "Salami", i_mush: "Champignons", i_pap: "Paprika" };
const o = (over: Partial<DashboardOrder>): DashboardOrder => ({
  total: 10, status: "eingegangen",
  items: [{ pizzaName: "Margherita", ingredientIds: ["i_sal"] }], ...over,
});

describe("computeDashboard", () => {
  it("leere Liste → Nullwerte", () => {
    const s = computeDashboard([], ing);
    expect(s.totalCount).toBe(0);
    expect(s.totalRevenue).toBe(0);
    expect(s.avgOrderValue).toBe(0);
    expect(s.topIngredient).toBeNull();
    expect(s.topPizzas).toEqual([]);
    expect(s.topIngredients).toEqual([]);
  });
  it("zählt Anzahl/Umsatz/Ø, storniert ausgeschlossen", () => {
    const s = computeDashboard([
      o({ total: 20 }), o({ total: 10 }), o({ total: 999, status: "storniert" }),
    ], ing);
    expect(s.totalCount).toBe(2);
    expect(s.totalRevenue).toBe(30);
    expect(s.avgOrderValue).toBe(15);
  });
  it("beliebteste Pizzen: Häufigkeit, Eigene zusammengefasst, sortiert", () => {
    const s = computeDashboard([
      o({ items: [{ pizzaName: "Eigene Pizza", ingredientIds: [] }] }),
      o({ items: [{ pizzaName: "Eigene Pizza", ingredientIds: [] }] }),
      o({ items: [{ pizzaName: "Margherita", ingredientIds: [] }] }),
    ], ing);
    expect(s.topPizzas[0]).toEqual({ day: "Eigene Pizza", n: 2 });
    expect(s.topPizzas[1]).toEqual({ day: "Margherita", n: 1 });
  });
  it("Top-Zutaten mit Namensauflösung + topIngredient", () => {
    const s = computeDashboard([
      o({ items: [{ pizzaName: "P", ingredientIds: ["i_sal", "i_mush"] }] }),
      o({ items: [{ pizzaName: "P", ingredientIds: ["i_sal"] }] }),
    ], ing);
    expect(s.topIngredient).toEqual({ name: "Salami", v: 2 });
    expect(s.topIngredients.map((t) => t.name)).toEqual(["Salami", "Champignons"]);
  });
  it("unbekannte Zutaten-id → Fallback auf die id", () => {
    const s = computeDashboard([o({ items: [{ pizzaName: "P", ingredientIds: ["i_x"] }] })], ing);
    expect(s.topIngredients[0]).toEqual({ name: "i_x", v: 1 });
  });
});
```

- [ ] **Step 2: Tests → FAIL**

Run: `cd Frontend && bun test src/lib/__tests__/dashboard.test.ts`
Expected: FAIL (`computeDashboard` nicht exportiert).

- [ ] **Step 3: `dashboard.ts` implementieren**

```ts
// Reine Dashboard-Aggregation (all-time, storniert ausgeschlossen). Deterministisch → getestet.
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
): DashboardStats {
  const active = orders.filter((o) => o.status !== "storniert");
  const totalCount = active.length;
  const totalRevenue = active.reduce((s, o) => s + o.total, 0);
  const avgOrderValue = totalCount ? totalRevenue / totalCount : 0;

  const pizzaCounts: Record<string, number> = {};
  const ingCounts: Record<string, number> = {};
  for (const o of active) {
    for (const it of o.items) {
      pizzaCounts[it.pizzaName] = (pizzaCounts[it.pizzaName] ?? 0) + 1;
      for (const id of it.ingredientIds) ingCounts[id] = (ingCounts[id] ?? 0) + 1;
    }
  }

  const topPizzas = Object.entries(pizzaCounts)
    .map(([name, n]) => ({ day: name, n }))
    .sort((a, b) => b.n - a.n || a.day.localeCompare(b.day))
    .slice(0, 6);

  const rankedIngredients = Object.entries(ingCounts)
    .map(([id, v]) => ({ name: ingredientNames[id] ?? id, v }))
    .sort((a, b) => b.v - a.v || a.name.localeCompare(b.name));

  return {
    totalCount,
    totalRevenue,
    avgOrderValue,
    topIngredient: rankedIngredients[0] ?? null,
    topPizzas,
    topIngredients: rankedIngredients.slice(0, 5),
  };
}
```

- [ ] **Step 4: Tests → PASS**

Run: `cd Frontend && bun test src/lib/__tests__/dashboard.test.ts`
Expected: alle grün.

- [ ] **Step 5: Build + Suite grün**

Run: `cd Frontend && bun run build && bun test src`
Expected: grün.

- [ ] **Step 6: Commit**

```bash
git add Frontend/src/lib/dashboard.ts Frontend/src/lib/__tests__/dashboard.test.ts
git commit -m "feat(dashboard): reine computeDashboard-Aggregation mit Tests"
```

---

### Task 2: Store — `getDashboardStats()` echt

**Files:**
- Modify: `Frontend/src/lib/data/store.ts`

**Interfaces:**
- Consumes: `getOrders()` (liefert `OrderRow[]`, strukturell zu `DashboardOrder` kompatibel), `getIngredients()`, `computeDashboard` (Task 1).

- [ ] **Step 1: Import-Zeile (Seed) bereinigen**

`import { TEMPLATES, WEEK_DATA, PIE_DATA } from "./seed";` ersetzen durch:
```ts
import { TEMPLATES } from "./seed";
```

- [ ] **Step 2: `computeDashboard`-Import ergänzen** (bei den anderen `@/lib`-Imports oben)

```ts
import { computeDashboard, type DashboardStats } from "@/lib/dashboard";
```

- [ ] **Step 3: `delay`-Mock + Mock-`getDashboardStats` ersetzen**

Die Zeile `const delay = <T>(v: T): Promise<T> => new Promise((r) => setTimeout(() => r(v), 120));` **entfernen** (nur der Mock nutzte sie).
Die Zeile `export const getDashboardStats = () => delay({ week: WEEK_DATA, toppings: PIE_DATA }); // TEIL-B-später: echte Aggregation` ersetzen durch:

```ts
// Dashboard-Kennzahlen aus echten Bestellungen (Admin-RLS) aggregieren.
export async function getDashboardStats(): Promise<DashboardStats> {
  const [orders, ingredients] = await Promise.all([getOrders(), getIngredients()]);
  const names = Object.fromEntries(ingredients.map((i) => [i.id, i.name]));
  return computeDashboard(orders, names);
}
```

- [ ] **Step 4: Build + Suite grün** (fängt evtl. übrig gebliebene ungenutzte Importe/`delay` ab — noUnusedLocals)

Run: `cd Frontend && bun run build && bun test src`
Expected: Build grün; Tests grün.

- [ ] **Step 5: Commit**

```bash
git add Frontend/src/lib/data/store.ts
git commit -m "feat(dashboard): getDashboardStats aus echten orders+ingredients"
```

---

### Task 3: Dashboard-Seite an echte Werte

**Files:**
- Modify: `Frontend/src/pages/admin/dashboard-page.tsx`

> Kacheln (bisher hart kodiert) + beide Charts an `stats` hängen; Leerzustand ergänzen. Die Kacheln wandern in den `AsyncBoundary`-Render, weil sie jetzt echte Werte brauchen.

- [ ] **Step 1: Datei ersetzen** (kompletter Inhalt)

```tsx
import type React from "react";
import { getDashboardStats } from "@/lib/data/store";
import type { DashboardStats } from "@/lib/dashboard";
import { useAsync } from "@/hooks/use-async";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/pricing";
import { SvgBarChart } from "@/components/common/bar-chart";
import { SvgDonutChart } from "@/components/common/donut-chart";
import { AsyncBoundary } from "@/components/common/async-boundary";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Chart-Palette (präsentational).
const CHART_COLORS = ["#F97316", "#EAB308", "#22C55E", "#3B82F6", "#A855F7"];

// Admin-Dashboard mit echten Kennzahlen aus orders (all-time, storniert ausgeschlossen).
export default function DashboardPage(): React.ReactElement {
  const { data, loading, error } = useAsync(getDashboardStats);

  return (
    <div className="p-4 space-y-5">
      <h2 className="font-bold text-lg">Dashboard</h2>
      <AsyncBoundary loading={loading} error={error} data={data}>
        {(stats: DashboardStats) => {
          const tiles = [
            { label: "Bestellungen gesamt", val: String(stats.totalCount),    sub: "ohne stornierte", col: "text-primary" },
            { label: "Umsatz gesamt",       val: formatPrice(stats.totalRevenue),  sub: "alle Abholungen", col: "text-chart-2" },
            { label: "Ø-Bestellwert",       val: formatPrice(stats.avgOrderValue), sub: "pro Bestellung",  col: "text-chart-3" },
            { label: "Top-Zutat",           val: stats.topIngredient?.name ?? "—",
              sub: stats.topIngredient ? `${stats.topIngredient.v}× gewählt` : "noch keine", col: "text-chart-5" },
          ];
          return (
            <>
              <div className="grid grid-cols-2 gap-3">
                {tiles.map(({ label, val, sub, col }) => (
                  <Card key={label}>
                    <CardContent className="pt-4 pb-4">
                      <p className={cn("font-black text-2xl leading-none mb-1", col)}>{val}</p>
                      <p className="text-xs font-semibold">{label}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card>
                <CardHeader><CardTitle className="text-sm">Beliebteste Pizzen</CardTitle></CardHeader>
                <CardContent className="pt-0">
                  {stats.topPizzas.length > 0
                    ? <SvgBarChart data={stats.topPizzas} />
                    : <p className="text-xs text-muted-foreground py-6 text-center">Noch keine Daten.</p>}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-sm">Beliebteste Zutaten</CardTitle></CardHeader>
                <CardContent className="pt-0">
                  {stats.topIngredients.length > 0 ? (
                    <div className="flex items-center gap-4">
                      <SvgDonutChart data={stats.topIngredients} colors={CHART_COLORS} />
                      <div className="space-y-1.5 flex-1">
                        {stats.topIngredients.map((d, i) => (
                          <div key={d.name} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: CHART_COLORS[i] }} />
                              <span className="text-xs text-muted-foreground">{d.name}</span>
                            </div>
                            <span className="text-xs font-bold">{d.v}×</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : <p className="text-xs text-muted-foreground py-6 text-center">Noch keine Daten.</p>}
                </CardContent>
              </Card>
            </>
          );
        }}
      </AsyncBoundary>
    </div>
  );
}
```

- [ ] **Step 2: Build + Suite grün**

Run: `cd Frontend && bun run build && bun test src`
Expected: Build grün; Tests grün.

- [ ] **Step 3: Commit**

```bash
git add Frontend/src/pages/admin/dashboard-page.tsx
git commit -m "feat(dashboard): Kacheln + Charts an echte Werte, Leerzustand"
```

---

### Task 4: Doku & Verifikation

**Files:**
- Modify: `Doku/Pizza/Changelog.md`, `Frontend/README.md` (+ ggf. TODO)

- [ ] **Step 1: Gesamt-Verifikation**

Run: `cd Frontend && bun run build && bun test src`
Expected: Build grün; Tests grün.

- [ ] **Step 2: Doku**

- `Doku/Pizza/Changelog.md` (2026-07-13, oben): „Admin-Dashboard auf Live-Daten — echte Aggregation aus `orders` (`computeDashboard`, getestet): Bestellungen/Umsatz/Ø-Bestellwert/Top-Zutat gesamt + Diagramme beliebteste Pizzen/Zutaten, `storniert` ausgeschlossen; Mock (`WEEK_DATA`/`PIE_DATA`) entfernt."
- `Frontend/README.md`: im Admin-Abschnitt den Hinweis auf echte Dashboard-Kennzahlen ergänzen (Mock-Erwähnung entfernen, falls vorhanden).

- [ ] **Step 3: Commit**

```bash
git add Doku/ Frontend/README.md
git commit -m "docs(dashboard): Changelog/README (Live-Daten)"
```

---

## Self-Review (durchgeführt)

- **Spec-Abdeckung:** `computeDashboard` + Tests (Anzahl/Umsatz/Ø, storniert raus, Pizzen-Top inkl. „Eigene Pizza", Zutaten-Top-5 + Namensauflösung/Fallback, `topIngredient`, leer→Null/leer/`null`) → T1; echtes `getDashboardStats` + Import-Bereinigung → T2; Kacheln/Charts + Leerzustand → T3; Doku → T4. Nicht-Ziele (kein Zeitbezug, kein SQL, kein UI-Umbau darüber hinaus) eingehalten.
- **Grün ohne Supabase:** T1 rein testbar; T2/T3 verifizieren Build+Tests (Datenladen läuft erst real beim Betreiber).
- **Typ-Konsistenz:** `DashboardStats`/`DashboardOrder` in T1 definiert, in T2 (`store`) + T3 (`page`) identisch genutzt; `topPizzas` als `{day,n}` = `SvgBarChart`-Form, `topIngredients` als `{name,v}` = `SvgDonutChart`-Form; `OrderRow` (aus `getOrders`) ist strukturell zu `DashboardOrder` kompatibel.
- **noUnusedLocals:** `delay` + `WEEK_DATA`/`PIE_DATA` werden in T2 mit entfernt (waren nur vom Mock genutzt), sonst bräche der Build.
- **Platzhalter:** keine.
