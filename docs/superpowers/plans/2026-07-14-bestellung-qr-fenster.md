# QR-Fenster aus „Meine Bestellungen" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein Kunde kann in „Meine Bestellungen" eine Bestellung anklicken und ein Fenster mit QR-Code, „Status verfolgen"-Link und Bestelldetails öffnen.

**Architecture:** Reines Frontend. `OrderRow` bekommt das schon vorhandene `public_token`-Feld ins Mapping; ein leichtgewichtiges Overlay-Modal (`OrderQrModal`, hand-gebaut mit `motion`) zeigt die Details; die `my-orders`-Seite lädt zusätzlich `ingredients`+`sauces`, baut daraus eine `labels`-Map und macht die Karten klickbar. Keine DB-/Schema-Änderung.

**Tech Stack:** TypeScript/React 18, Vite, Tailwind, motion, lucide-react, Tests via `bun:test`. Package-Manager: **Bun**.

## Global Constraints

- Package-Manager **Bun** (`bun run`, `bun test`).
- Tests via `bun:test`, Dateien unter `src/**/__tests__/*.test.ts`.
- **Keine** Migration/Schema-Änderung, **kein** ADR, **kein** SETUP — reines Frontend, `main`-Push (Vercel Auto-Deploy).
- QR-URL: `${window.location.origin}/bestellung/${order.publicToken}` (exakt so).
- Preis pro Pizza pauschal `10 €` (konsistent zu Bestätigung/Status-Seite; `BASE_PRICE = 10`).
- Modal schließt per X-Button, Klick auf den Hintergrund und Escape; Karte scrollt intern (`max-h-[85vh] overflow-y-auto`).
- Wiederverwenden statt neu bauen: `QrCode`, `OrderStatusBadge`, `PizzaSVG`, `describeItem` (aus `@/lib/public-order`), `formatPrice`, `formatDateLabel`, `Separator`.

---

### Task 1: `publicToken` in `OrderRow` + `rowToOrder`

**Files:**
- Modify: `Frontend/src/types/index.ts` (`OrderRow`)
- Modify: `Frontend/src/lib/data/store.ts` (`rowToOrder`)

**Interfaces:**
- Produces: `OrderRow.publicToken: string`; `rowToOrder(r)` setzt `publicToken: r.public_token`.

> Nur `rowToOrder` konstruiert `OrderRow` (verifiziert: kein Test-Fixture baut `OrderRow`), daher hält der Build grün, sobald das Mapping ergänzt ist. `getMyOrders`/`getOrders` selektieren `*`, `public_token` ist in den Rohdaten vorhanden.

- [ ] **Step 1: `OrderRow` erweitern**

In `Frontend/src/types/index.ts` das `OrderRow`-Interface um `publicToken` ergänzen (nach `id`):

```ts
export interface OrderRow {
  id: string;
  publicToken: string;
  items: CartItem[];
  total: number;
  serviceMode: ServiceMode;
  pickupDate: string;
  pickupTime: string;
  notes: string;
  status: OrderStatus;
  createdAt: string;
  userId: string | null;
}
```

- [ ] **Step 2: `rowToOrder` mappt `public_token`**

In `Frontend/src/lib/data/store.ts` in der Funktion `rowToOrder(r)` das Feld ergänzen (direkt nach `id: r.id,`):

```ts
    id: r.id, publicToken: r.public_token,
```

- [ ] **Step 3: Build + Suite grün**

Run: `cd Frontend && bun run build && bun test src`
Expected: Build erfolgreich; Tests unverändert grün.

- [ ] **Step 4: Commit**

```bash
git add Frontend/src/types/index.ts Frontend/src/lib/data/store.ts
git commit -m "feat(orders): publicToken in OrderRow + rowToOrder-Mapping"
```

---

### Task 2: Helfer `buildLabels` + Tests

**Files:**
- Create: `Frontend/src/lib/order-labels.ts`
- Test: `Frontend/src/lib/__tests__/order-labels.test.ts`

**Interfaces:**
- Consumes: `IngredientItem`, `Sauce` aus `@/types`.
- Produces: `buildLabels(ingredients: IngredientItem[], sauces: Sauce[]): Record<string, string>` — Map `id → Name` über beide Listen.

- [ ] **Step 1: Failing test schreiben**

Create `Frontend/src/lib/__tests__/order-labels.test.ts`:

```ts
import { describe, it, expect } from "bun:test";
import { buildLabels } from "@/lib/order-labels";
import type { IngredientItem, Sauce } from "@/types";

const ing = (id: string, name: string): IngredientItem => ({ id, name, emoji: "🍕", category: "Gemüse", available: true, description: "" });
const sauce = (id: string, name: string): Sauce => ({ id, name, emoji: "🥫", color: "#f00", available: true });

describe("buildLabels", () => {
  it("kombiniert Zutaten- und Soßen-IDs → Namen", () => {
    expect(buildLabels([ing("salami", "Salami")], [sauce("tomate", "Tomatensauce")]))
      .toEqual({ salami: "Salami", tomate: "Tomatensauce" });
  });
  it("leere Listen → {}", () => {
    expect(buildLabels([], [])).toEqual({});
  });
  it("mehrere Einträge, keine verlorenen Keys", () => {
    expect(buildLabels([ing("a", "A"), ing("b", "B")], [sauce("c", "C")]))
      .toEqual({ a: "A", b: "B", c: "C" });
  });
});
```

- [ ] **Step 2: Test laufen lassen — muss fehlschlagen**

Run: `cd Frontend && bun test src/lib/__tests__/order-labels.test.ts`
Expected: FAIL („Cannot find module '@/lib/order-labels'").

- [ ] **Step 3: Helfer implementieren**

Create `Frontend/src/lib/order-labels.ts`:

```ts
import type { IngredientItem, Sauce } from "@/types";

// Map id → Name über Zutaten und Soßen (für describeItem im Bestell-Modal).
export function buildLabels(ingredients: IngredientItem[], sauces: Sauce[]): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const i of ingredients) labels[i.id] = i.name;
  for (const s of sauces) labels[s.id] = s.name;
  return labels;
}
```

- [ ] **Step 4: Test laufen lassen — muss bestehen**

Run: `cd Frontend && bun test src/lib/__tests__/order-labels.test.ts`
Expected: PASS (3 Tests grün).

- [ ] **Step 5: Commit**

```bash
git add Frontend/src/lib/order-labels.ts Frontend/src/lib/__tests__/order-labels.test.ts
git commit -m "feat(orders): buildLabels-Helfer (id→Name für Zutaten/Soßen)"
```

---

### Task 3: Komponente `OrderQrModal`

**Files:**
- Create: `Frontend/src/components/orders/order-qr-modal.tsx`

**Interfaces:**
- Consumes: `OrderRow` (mit `publicToken`, Task 1); `describeItem` (`@/lib/public-order`); `QrCode`, `OrderStatusBadge`, `PizzaSVG`, `Separator`, `formatPrice`, `formatDateLabel`.
- Produces: `OrderQrModal({ order, labels, onClose })` — rein darstellendes Overlay-Modal.

- [ ] **Step 1: Komponente erstellen**

Create `Frontend/src/components/orders/order-qr-modal.tsx`:

```tsx
import type React from "react";
import { useEffect } from "react";
import { motion } from "motion/react";
import { X } from "lucide-react";
import type { OrderRow } from "@/types";
import { describeItem } from "@/lib/public-order";
import { formatPrice } from "@/lib/pricing";
import { formatDateLabel } from "@/lib/slots";
import { QrCode } from "@/components/common/qr-code";
import { OrderStatusBadge } from "@/components/common/order-status-badge";
import { PizzaSVG } from "@/components/pizza/pizza-svg";
import { Separator } from "@/components/ui/separator";

// Overlay-Modal: zeigt QR + Status-Link + Details einer bereits getätigten Bestellung.
// Rein darstellend — order + labels kommen als Props.
export function OrderQrModal({ order, labels, onClose }: {
  order: OrderRow;
  labels: Record<string, string>;
  onClose: () => void;
}): React.ReactElement {
  // Escape schließt das Modal.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const statusUrl = `${window.location.origin}/bestellung/${order.publicToken}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4" onClick={onClose}>
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", bounce: 0.25 }}
        className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-2xl border border-border bg-card text-card-foreground p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em]">Bestellung</p>
            <p className="text-3xl font-black text-primary">{order.id}</p>
          </div>
          <button onClick={onClose} aria-label="Schließen" className="text-muted-foreground hover:text-foreground">
            <X size={20} />
          </button>
        </div>

        <div><OrderStatusBadge status={order.status} /></div>

        <div className="text-center space-y-2">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">QR-Code</p>
          <div className="w-36 h-36 mx-auto"><QrCode data={statusUrl} /></div>
          <a href={statusUrl} className="inline-block text-xs text-primary underline underline-offset-2">Status verfolgen</a>
        </div>

        <Separator />
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{order.serviceMode === "dinein" ? "Vor Ort" : "Abholung"}</span>
          <span className="font-semibold">{formatDateLabel(order.pickupDate)} · {order.pickupTime} Uhr</span>
        </div>
        <Separator />

        <div className="space-y-3 text-sm">
          {order.items.map((item, i) => (
            <div key={item.cartId ?? i}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 shrink-0"><PizzaSVG selected={item.ingredientIds} /></div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">{item.pizzaName}</p>
                  <p className="text-xs text-muted-foreground truncate">{describeItem(item, labels)}</p>
                </div>
                <span className="text-primary font-bold shrink-0">10 €</span>
              </div>
              {i < order.items.length - 1 && <Separator className="mt-3" />}
            </div>
          ))}
        </div>

        <Separator />
        <div className="flex justify-between font-black">
          <span>Gesamt (bar)</span>
          <span className="text-primary">{formatPrice(order.total)}</span>
        </div>
      </motion.div>
    </div>
  );
}
```

- [ ] **Step 2: Build prüfen**

Run: `cd Frontend && bun run build`
Expected: Build erfolgreich (alle Imports auflösbar). Danach `cd Frontend && bun test src` → unverändert grün.

- [ ] **Step 3: Commit**

```bash
git add Frontend/src/components/orders/order-qr-modal.tsx
git commit -m "feat(orders): OrderQrModal (Overlay mit QR/Status-Link/Details)"
```

---

### Task 4: `my-orders-page.tsx` — Karten klickbar + Modal

**Files:**
- Modify (komplett ersetzen): `Frontend/src/pages/orders/my-orders-page.tsx`

**Interfaces:**
- Consumes: `buildLabels` (Task 2), `OrderQrModal` (Task 3), `getIngredients`/`getSauces` (store), `OrderRow.publicToken` (Task 1).

- [ ] **Step 1: Datei komplett ersetzen**

`Frontend/src/pages/orders/my-orders-page.tsx` vollständig ersetzen durch:

```tsx
import type React from "react";
import { useCallback, useState } from "react";
import { getMyOrders, getIngredients, getSauces } from "@/lib/data/store";
import { useAsync } from "@/hooks/use-async";
import { useAuth } from "@/hooks/use-auth";
import { useOrdersRealtime } from "@/hooks/use-orders-realtime";
import { buildLabels } from "@/lib/order-labels";
import { formatPrice } from "@/lib/pricing";
import type { OrderRow } from "@/types";
import { AsyncBoundary } from "@/components/common/async-boundary";
import { OrderStatusBadge } from "@/components/common/order-status-badge";
import { PizzaSVG } from "@/components/pizza/pizza-svg";
import { OrderQrModal } from "@/components/orders/order-qr-modal";
import { Card, CardContent } from "@/components/ui/card";

export default function MyOrdersPage(): React.ReactElement {
  const { currentUser } = useAuth();
  const { data, loading, error, reload } = useAsync(getMyOrders);
  const { data: ingredients } = useAsync(getIngredients);
  const { data: sauces } = useAsync(getSauces);
  const [selected, setSelected] = useState<OrderRow | null>(null);
  const onChange = useCallback(() => reload(), [reload]);
  useOrdersRealtime(onChange, { userId: currentUser?.id });

  const labels = buildLabels(ingredients ?? [], sauces ?? []);

  return (
    <div className="pb-24">
      <div className="px-5 pt-10 pb-4">
        <h1 className="text-3xl font-black tracking-tight">Meine <span className="text-primary">Bestellungen</span></h1>
      </div>
      <AsyncBoundary
        loading={loading}
        error={error}
        data={data}
        empty={<p className="px-5 py-16 text-center text-muted-foreground text-sm">Noch keine Bestellungen.</p>}
      >
        {(orders: OrderRow[]) => (
          <div className="px-4 space-y-3">
            {orders.map((o) => (
              <Card key={o.id} className="cursor-pointer transition-colors hover:border-primary/30" onClick={() => setSelected(o)}>
                <CardContent className="py-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-primary">{o.id}</span>
                    <OrderStatusBadge status={o.status} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {o.serviceMode === "dinein" ? "Vor Ort" : "Abholung"} · {o.pickupDate} · {o.pickupTime} Uhr
                  </p>
                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    {o.items.map((item, i) => (
                      <div key={item.cartId ?? i} className="w-8 h-8"><PizzaSVG selected={item.ingredientIds} /></div>
                    ))}
                    <span className="text-sm font-bold text-primary ml-auto">{formatPrice(o.total)}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </AsyncBoundary>

      {selected && (
        <OrderQrModal order={selected} labels={labels} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Build + Suite grün**

Run: `cd Frontend && bun run build && bun test src`
Expected: Build erfolgreich; Tests grün.

- [ ] **Step 3: Commit**

```bash
git add Frontend/src/pages/orders/my-orders-page.tsx
git commit -m "feat(orders): Bestell-Karte klickbar → OrderQrModal (Meine Bestellungen)"
```

---

### Task 5: Dokumentation

**Files:**
- Modify: `Doku/Pizza/Changelog.md` (Eintrag unter `## 2026-07-14`)
- Modify: `Doku/Pizza/TODO.md` (Eintrag „erledigt")

- [ ] **Step 1: Changelog-Eintrag**

In `Doku/Pizza/Changelog.md` als **obersten** Punkt unter der bestehenden Überschrift `## 2026-07-14` einfügen (direkt unter der Zeile `## 2026-07-14`):

```markdown
- **QR/Status aus „Meine Bestellungen" erneut öffnen:** Klick auf eine Bestellung öffnet ein
  Overlay-Fenster (`OrderQrModal`) mit QR-Code, „Status verfolgen"-Link, Status, Abholzeit, Pizza-Liste
  und Betrag — bisher war der QR nur direkt nach dem Bestellen sichtbar. `OrderRow` mappt jetzt
  `publicToken`; die Seite lädt `ingredients`+`sauces` und löst Zutatennamen via `buildLabels`
  (`lib/order-labels.ts`, getestet) + `describeItem` auf. Modal schließt per X/Backdrop/Escape.
  Reines Frontend, keine Migration.
```

- [ ] **Step 2: TODO-Eintrag**

In `Doku/Pizza/TODO.md` in der Tabelle (bei den erledigten QR-nahen Einträgen, z. B. direkt unter der QR-Zeile) eine neue Zeile einfügen:

```markdown
| P3 | ~~QR/Status aus „Meine Bestellungen" erneut öffnen~~ | erledigt (2026-07-14) — `OrderQrModal` (Overlay, X/Backdrop/Escape), `publicToken` in `OrderRow`, `buildLabels` | Frontend-Deployment |
```

- [ ] **Step 3: Commit**

```bash
git add Doku/Pizza/Changelog.md Doku/Pizza/TODO.md
git commit -m "docs: QR-Fenster aus Meine Bestellungen (Changelog/TODO)"
```

---

## Verifikation gesamt

- `cd Frontend && bun test src` → alle Tests grün (inkl. `order-labels.test.ts`).
- `cd Frontend && bun run build` → erfolgreich.
- Manueller Klicktest (nach Merge/Deploy): „Meine Bestellungen" → Bestellung antippen → Fenster mit QR öffnet; X/Klick-daneben/Escape schließt; „Status verfolgen" öffnet die öffentliche Status-Seite; Zutaten-Zeile zeigt Namen.
