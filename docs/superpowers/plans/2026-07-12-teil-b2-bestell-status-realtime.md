# Teil-B2 — Bestell-Status + Realtime — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bestell-Status-Workflow (5 Werte) + Live-Updates: Admin sieht/steuert Bestellungen live, Kunde sieht Live-Status seiner Bestellungen — über Supabase Realtime.

**Architecture:** Reine Status-Logik (`lib/order-status.ts`, getestet) + async Store-Funktionen (Supabase-Queries) + ein Realtime-Hook (`postgres_changes` auf `orders`, lädt bei Event neu). Zwei neue Seiten (Admin-Bestellliste, Kunden-Bestellliste) hinter den bestehenden Guards. Signaturen/Muster wie B1.

**Tech Stack:** Bun, Vite 6, React 18, TS, Tailwind v4, shadcn, react-router 7, @supabase/supabase-js. Tests: bun:test (nur reine Logik).

## Global Constraints

- **Umgebung erreicht Supabase NICHT.** Jeder Task verifiziert NUR `cd Frontend && bun run build` (Typecheck) + `cd Frontend && bun test src` (reine Logik). SQL wird geschrieben, nicht ausgeführt. **Kein Task darf laufendes Supabase/Realtime brauchen, um grün zu sein.**
- Bun. Build/Test aus `Frontend/`. `noUnusedLocals` ON — keine ungenutzten Imports.
- **Status-Werte exakt:** `eingegangen | in_arbeit | fertig | abgeholt | storniert` (Default `eingegangen`, schon in B1).
- **Vorwärts-Ablauf:** eingegangen→in_arbeit→fertig→abgeholt; `storniert` von jedem aktiven Status; `abgeholt`/`storniert` = Endzustände.
- **RLS (aus B1):** Kunde liest eigene Bestellungen, Admin liest/ändert alle. B2 fügt KEINE Policies hinzu.
- DB `snake_case` ↔ TS `camelCase` (Mapping in store.ts). Dateinamen kebab-case, Komponenten PascalCase.
- **Referenz-Spec:** `docs/superpowers/specs/2026-07-12-teil-b2-bestell-status-realtime-design.md`.

---

## Dateistruktur (Ziel)

```
supabase/migrations/0004_order_status.sql          (N) CHECK-Constraint auf status
Frontend/src/
├── types/index.ts                                 (M) OrderStatus, OrderRow
├── lib/order-status.ts                            (N) nextStatus/isActive/statusLabel (+Test)
├── lib/data/store.ts                              (M) getOrders/getMyOrders/updateOrderStatus
├── hooks/use-orders-realtime.ts                   (N) Realtime-Abo auf orders
├── components/common/order-status-badge.tsx       (N) Status-Badge (Admin+Kunde)
├── pages/orders/my-orders-page.tsx                (N) Kunde: Meine Bestellungen
├── pages/admin/orders-page.tsx                    (N) Admin: Bestellungen
├── components/layout/bottom-nav.tsx               (M) 5. Tab "Bestellungen"
├── components/layout/admin-shell.tsx              (M) Nav-Punkt "Bestellungen"
└── router.tsx                                     (M) /meine-bestellungen, /admin/bestellungen
```

---

### Task 1: Migration, Typen & Status-Logik

**Files:**
- Create: `supabase/migrations/0004_order_status.sql`
- Modify: `Frontend/src/types/index.ts`
- Create: `Frontend/src/lib/order-status.ts`
- Test: `Frontend/src/lib/__tests__/order-status.test.ts`

**Interfaces:**
- Produces:
```ts
type OrderStatus = "eingegangen" | "in_arbeit" | "fertig" | "abgeholt" | "storniert";
interface OrderRow { id: string; items: CartItem[]; total: number; serviceMode: ServiceMode; pickupDate: string; pickupTime: string; notes: string; status: OrderStatus; createdAt: string; userId: string | null }
export const ORDER_STATUSES: OrderStatus[];
export function nextStatus(s: OrderStatus): OrderStatus | null;
export function isActive(s: OrderStatus): boolean;
export function statusLabel(s: OrderStatus): string;
```

- [ ] **Step 1: Migration schreiben** (`supabase/migrations/0004_order_status.sql`)
```sql
-- Teil-B2: Status-Werte auf die 5 erlaubten begrenzen. orders.status Default 'eingegangen' bleibt (aus 0001).
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('eingegangen','in_arbeit','fertig','abgeholt','storniert'));
```

- [ ] **Step 2: Typen ergänzen** in `Frontend/src/types/index.ts` (am Dateiende; `CartItem`/`ServiceMode` existieren bereits):
```ts
export type OrderStatus = "eingegangen" | "in_arbeit" | "fertig" | "abgeholt" | "storniert";

export interface OrderRow {
  id: string;
  items: CartItem[];
  total: number;
  serviceMode: ServiceMode;
  pickupDate: string;
  pickupTime: string;
  notes: string;
  status: OrderStatus;
  createdAt: string; // ISO-Zeitstempel
  userId: string | null;
}
```

- [ ] **Step 3: Failing test `order-status.test.ts`**
```ts
import { describe, it, expect } from "bun:test";
import { nextStatus, isActive, statusLabel, ORDER_STATUSES } from "@/lib/order-status";

describe("order-status", () => {
  it("nextStatus folgt dem Vorwärts-Ablauf", () => {
    expect(nextStatus("eingegangen")).toBe("in_arbeit");
    expect(nextStatus("in_arbeit")).toBe("fertig");
    expect(nextStatus("fertig")).toBe("abgeholt");
  });
  it("nextStatus: Endzustände → null", () => {
    expect(nextStatus("abgeholt")).toBeNull();
    expect(nextStatus("storniert")).toBeNull();
  });
  it("isActive: nur nicht-abgeholt/storniert", () => {
    expect(isActive("eingegangen")).toBe(true);
    expect(isActive("in_arbeit")).toBe(true);
    expect(isActive("fertig")).toBe(true);
    expect(isActive("abgeholt")).toBe(false);
    expect(isActive("storniert")).toBe(false);
  });
  it("statusLabel liefert deutsche Labels", () => {
    expect(statusLabel("in_arbeit")).toBe("In Arbeit");
    expect(statusLabel("eingegangen")).toBe("Eingegangen");
  });
  it("ORDER_STATUSES hat alle 5 in Ablauf-Reihenfolge", () => {
    expect(ORDER_STATUSES).toEqual(["eingegangen","in_arbeit","fertig","abgeholt","storniert"]);
  });
});
```

- [ ] **Step 4: Run → FAIL** — Run: `cd Frontend && bun test src/lib/__tests__/order-status.test.ts` — Expected: FAIL (Modul fehlt).

- [ ] **Step 5: `lib/order-status.ts` implementieren**
```ts
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
```

- [ ] **Step 6: Run → PASS + Build** — Run: `cd Frontend && bun test src/lib/__tests__/order-status.test.ts && bun run build` — Expected: Test PASS, Build grün.

- [ ] **Step 7: Commit**
```bash
git add supabase/migrations/0004_order_status.sql Frontend/src/types/index.ts Frontend/src/lib/order-status.ts Frontend/src/lib/__tests__/order-status.test.ts
git commit -m "feat(b2): Status-Migration, OrderStatus/OrderRow-Typen + Status-Logik (getestet)"
```

---

### Task 2: Store — Bestellungen laden & Status ändern

**Files:**
- Modify: `Frontend/src/lib/data/store.ts`

**Interfaces:**
- Consumes: `supabase` (`@/lib/supabase`), `OrderRow`/`OrderStatus` (`@/types`).
- Produces:
```ts
export function getOrders(): Promise<OrderRow[]>;
export function getMyOrders(): Promise<OrderRow[]>;
export function updateOrderStatus(id: string, status: OrderStatus): Promise<void>;
```

- [ ] **Step 1: Store-Funktionen ergänzen**

Typ-Import in `store.ts` um `OrderRow, OrderStatus` erweitern. Am Dateiende (nach `createOrder`) einfügen:
```ts
// ── Bestellungen (B2) ──
function rowToOrder(r: any): OrderRow {
  return {
    id: r.id, items: r.items, total: Number(r.total), serviceMode: r.service_mode,
    pickupDate: r.pickup_date, pickupTime: r.pickup_time, notes: r.notes ?? "",
    status: r.status, createdAt: r.created_at, userId: r.user_id ?? null,
  };
}

export async function getOrders(): Promise<OrderRow[]> {
  const { data, error } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToOrder);
}

export async function getMyOrders(): Promise<OrderRow[]> {
  const { data: sess } = await supabase.auth.getUser();
  const uid = sess.user?.id;
  if (!uid) return [];
  const { data, error } = await supabase.from("orders").select("*").eq("user_id", uid).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToOrder);
}

export async function updateOrderStatus(id: string, status: OrderStatus): Promise<void> {
  const { error } = await supabase.from("orders").update({ status }).eq("id", id);
  if (error) throw error;
}
```
> Hinweis: `r: any` ist bewusst — der Supabase-Client ist ohne generierte DB-Typen ungetypt (wie in B1). Kein impliziter any-Fehler.

- [ ] **Step 2: Build → grün** — Run: `cd Frontend && bun run build` — Expected: ohne TS-Fehler.

- [ ] **Step 3: Commit**
```bash
git add Frontend/src/lib/data/store.ts
git commit -m "feat(b2): store getOrders/getMyOrders/updateOrderStatus"
```

---

### Task 3: Realtime-Hook

**Files:**
- Create: `Frontend/src/hooks/use-orders-realtime.ts`

**Interfaces:**
- Consumes: `supabase` (`@/lib/supabase`).
- Produces: `export function useOrdersRealtime(onChange: () => void, scope: { userId?: string }): void`.

- [ ] **Step 1: Hook implementieren**
```ts
import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

// Abonniert Änderungen der orders-Tabelle (INSERT/UPDATE/DELETE) und ruft onChange().
// scope.userId → nur eigene Bestellungen (Kunde); ohne → alle (Admin).
// Voraussetzung: Betreiber hat Realtime für die orders-Tabelle in Supabase aktiviert.
export function useOrdersRealtime(onChange: () => void, scope: { userId?: string }): void {
  const cb = useRef(onChange);
  cb.current = onChange; // immer aktuell, ohne Re-Subscribe

  useEffect(() => {
    const channel = supabase
      .channel(`orders-${scope.userId ?? "all"}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: scope.userId ? `user_id=eq.${scope.userId}` : undefined,
        },
        () => cb.current(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [scope.userId]);
}
```
> Falls der `.on("postgres_changes", …)`-Aufruf einen TS-Typfehler wirft (supabase-js-Realtime-Typen sind streng): das Config-Objekt minimal casten — `{ event: "*", schema: "public", table: "orders", filter: … } as never` in der zweiten Position. Erst ohne Cast versuchen.

- [ ] **Step 2: Build → grün** — Run: `cd Frontend && bun run build` — Expected: ohne TS-Fehler.

- [ ] **Step 3: Commit**
```bash
git add Frontend/src/hooks/use-orders-realtime.ts
git commit -m "feat(b2): useOrdersRealtime (postgres_changes auf orders)"
```

---

### Task 4: Kunden-Seite „Meine Bestellungen" + Badge + Nav + Route

**Files:**
- Create: `Frontend/src/components/common/order-status-badge.tsx`
- Create: `Frontend/src/pages/orders/my-orders-page.tsx`
- Modify: `Frontend/src/components/layout/bottom-nav.tsx`
- Modify: `Frontend/src/router.tsx`

**Interfaces:**
- Consumes: `getMyOrders` (store), `useOrdersRealtime`, `useAuth`, `useAsync`, `AsyncBoundary`, `statusLabel`/`isActive`, `formatPrice`.
- Produces: `OrderStatusBadge` (genutzt auch in Task 5).

- [ ] **Step 1: `order-status-badge.tsx`** (`components/common/`)
```tsx
import type React from "react";
import { cn } from "@/lib/utils";
import { statusLabel } from "@/lib/order-status";
import type { OrderStatus } from "@/types";

const COLORS: Record<OrderStatus, string> = {
  eingegangen: "bg-muted text-foreground",
  in_arbeit: "bg-amber-400/15 text-amber-400 border border-amber-400/25",
  fertig: "bg-green-500/15 text-green-400 border border-green-500/25",
  abgeholt: "bg-muted text-muted-foreground",
  storniert: "bg-destructive/15 text-destructive border border-destructive/25",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }): React.ReactElement {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold", COLORS[status])}>
      {statusLabel(status)}
    </span>
  );
}
```

- [ ] **Step 2: `my-orders-page.tsx`** (`pages/orders/`)
```tsx
import type React from "react";
import { useCallback } from "react";
import { getMyOrders } from "@/lib/data/store";
import { useAsync } from "@/hooks/use-async";
import { useAuth } from "@/hooks/use-auth";
import { useOrdersRealtime } from "@/hooks/use-orders-realtime";
import { formatPrice } from "@/lib/pricing";
import type { OrderRow } from "@/types";
import { AsyncBoundary } from "@/components/common/async-boundary";
import { OrderStatusBadge } from "@/components/common/order-status-badge";
import { PizzaSVG } from "@/components/pizza/pizza-svg";
import { Card, CardContent } from "@/components/ui/card";

export default function MyOrdersPage(): React.ReactElement {
  const { currentUser } = useAuth();
  const { data, loading, error, reload } = useAsync(getMyOrders);
  const onChange = useCallback(() => reload(), [reload]);
  useOrdersRealtime(onChange, { userId: currentUser?.id });

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
              <Card key={o.id}>
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
    </div>
  );
}
```

- [ ] **Step 3: BottomNav — 5. Tab „Bestellungen"**

In `bottom-nav.tsx` den Icon-Import um `ClipboardList` erweitern und einen `NavLink` **zwischen Warenkorb und Profil** einfügen:
```tsx
        <NavLink to="/meine-bestellungen" className={({ isActive }) => cn(base, isActive ? active : idle)}>
          {({ isActive }) => (
            <>
              <ClipboardList size={21} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] font-semibold">Bestellungen</span>
            </>
          )}
        </NavLink>
```

- [ ] **Step 4: Route** in `router.tsx` — Import `MyOrdersPage` und als Kind des `AppLayout`/`RequireCustomer`-Blocks (bei den Kundenrouten):
```tsx
      { path: "/meine-bestellungen", element: <MyOrdersPage /> },
```

- [ ] **Step 5: Build → grün** — Run: `cd Frontend && bun run build && bun test src` — Expected: Build grün, Tests grün.

- [ ] **Step 6: Commit**
```bash
git add Frontend/src/components/common/order-status-badge.tsx Frontend/src/pages/orders Frontend/src/components/layout/bottom-nav.tsx Frontend/src/router.tsx
git commit -m "feat(b2): Kunden-Seite Meine Bestellungen (live) + Status-Badge + Nav/Route"
```

---

### Task 5: Admin-Seite „Bestellungen" + Nav + Route

**Files:**
- Create: `Frontend/src/pages/admin/orders-page.tsx`
- Modify: `Frontend/src/components/layout/admin-shell.tsx`
- Modify: `Frontend/src/router.tsx`

**Interfaces:**
- Consumes: `getOrders`, `updateOrderStatus` (store), `useOrdersRealtime`, `useAsync`, `AsyncBoundary`, `OrderStatusBadge`, `nextStatus`/`isActive`/`statusLabel`, `formatPrice`.

- [ ] **Step 1: `orders-page.tsx`** (`pages/admin/`)
```tsx
import type React from "react";
import { useCallback, useState } from "react";
import { getOrders, updateOrderStatus } from "@/lib/data/store";
import { useAsync } from "@/hooks/use-async";
import { useOrdersRealtime } from "@/hooks/use-orders-realtime";
import { nextStatus, isActive, statusLabel } from "@/lib/order-status";
import { formatPrice } from "@/lib/pricing";
import type { OrderRow, OrderStatus } from "@/types";
import { AsyncBoundary } from "@/components/common/async-boundary";
import { OrderStatusBadge } from "@/components/common/order-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function OrdersPage(): React.ReactElement {
  const { data, loading, error, reload } = useAsync(getOrders);
  const onChange = useCallback(() => reload(), [reload]);
  useOrdersRealtime(onChange, {});
  const [showDone, setShowDone] = useState(false);

  const setStatus = async (id: string, status: OrderStatus) => {
    await updateOrderStatus(id, status);
    reload();
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-lg">Bestellungen</h2>
        <Button variant="outline" size="sm" className="text-xs" onClick={() => setShowDone((v) => !v)}>
          {showDone ? "Nur aktive" : "Auch erledigte"}
        </Button>
      </div>
      <AsyncBoundary
        loading={loading}
        error={error}
        data={data}
        empty={<p className="text-sm text-muted-foreground text-center py-8">Keine Bestellungen.</p>}
      >
        {(orders: OrderRow[]) => {
          const shown = showDone ? orders : orders.filter((o) => isActive(o.status));
          if (shown.length === 0) {
            return <p className="text-sm text-muted-foreground text-center py-8">Keine {showDone ? "" : "aktiven "}Bestellungen.</p>;
          }
          return (
            <div className="space-y-3">
              {shown.map((o) => {
                const nx = nextStatus(o.status);
                return (
                  <Card key={o.id}>
                    <CardContent className="py-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-black text-primary">{o.id}</span>
                        <OrderStatusBadge status={o.status} />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {o.serviceMode === "dinein" ? "Vor Ort" : "Abholung"} · {o.pickupDate} · {o.pickupTime} Uhr · {o.items.length} Pizza{o.items.length !== 1 ? "en" : ""} · {formatPrice(o.total)}
                      </p>
                      {o.notes && <p className="text-xs text-foreground/70">Bemerkung: {o.notes}</p>}
                      {isActive(o.status) && (
                        <div className="flex gap-2 pt-1">
                          {nx && (
                            <Button size="sm" className="text-xs" onClick={() => setStatus(o.id, nx)}>
                              → {statusLabel(nx)}
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="text-xs text-muted-foreground hover:text-destructive" onClick={() => setStatus(o.id, "storniert")}>
                            Stornieren
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          );
        }}
      </AsyncBoundary>
    </div>
  );
}
```

- [ ] **Step 2: AdminShell — Nav-Punkt**

In `admin-shell.tsx` den Icon-Import um `ClipboardList` erweitern und im `NAV`-Array **als ersten Eintrag** (Bestellungen sind das Wichtigste) einfügen:
```tsx
  { to: "/admin/bestellungen",    icon: ClipboardList, label: "Bestellungen"  },
```

- [ ] **Step 3: Route** in `router.tsx` — Import `OrdersPage` und im Admin-`children`-Array (z. B. nach `dashboard`):
```tsx
      { path: "bestellungen", element: <OrdersPage /> },
```

- [ ] **Step 4: Build → grün** — Run: `cd Frontend && bun run build && bun test src` — Expected: Build grün, Tests grün.

- [ ] **Step 5: Commit**
```bash
git add Frontend/src/pages/admin/orders-page.tsx Frontend/src/components/layout/admin-shell.tsx Frontend/src/router.tsx
git commit -m "feat(b2): Admin-Seite Bestellungen (live, Status weiterschalten/stornieren) + Nav/Route"
```

---

### Task 6: Doku & Gesamt-Verifikation

**Files:**
- Modify: `Doku/Pizza/SETUP-Supabase.md`, `Doku/Pizza/Changelog.md`, `Doku/Pizza/TODO.md`, `Frontend/README.md`

- [ ] **Step 1: Gesamt-Verifikation**

Run: `cd Frontend && bun run build && bun test src`
Expected: Build grün; reine Logik-Tests grün (inkl. order-status).

- [ ] **Step 2: SETUP — Realtime aktivieren**

`Doku/Pizza/SETUP-Supabase.md`: einen Schritt ergänzen (nach dem Migrations-Schritt): „**Realtime aktivieren:** Supabase → Database → Replication (bzw. Realtime) → Tabelle `public.orders` für Realtime freigeben. Ohne das aktualisieren sich die Bestell-Listen nicht live." Migration `0004_order_status.sql` in die Liste der auszuführenden Migrationen aufnehmen (nach 0003).

- [ ] **Step 3: Changelog + README + TODO**

`Doku/Pizza/Changelog.md` (oben, 2026-07-12): „Teil-B2: Bestell-Status (eingegangen/in_arbeit/fertig/abgeholt/storniert, Migration 0004) + Realtime. Admin-Seite `/admin/bestellungen` (live, Status weiterschalten/stornieren); Kunden-Seite `/meine-bestellungen` (live Status). Realtime-Hook auf `orders`. Hier nur Build/Typecheck verifiziert; Betreiber muss Realtime für `orders` aktivieren."
`Frontend/README.md`: im Supabase-Abschnitt ergänzen: Bestell-Status/Realtime, Hinweis „Realtime für `orders` aktivieren".
`Doku/Pizza/TODO.md`: „Teil-B2 (Bestell-Status + Realtime) — erledigt"; B3/B4 offen lassen; unter dem Betreiber-Setup-Punkt „+ Realtime für orders aktivieren" ergänzen.

- [ ] **Step 4: Commit**
```bash
git add Doku/ Frontend/README.md
git commit -m "docs(b2): SETUP (Realtime), Changelog/README/TODO"
```

---

## Self-Review (durchgeführt)

- **Spec-Abdeckung:** Status-Modell + Migration → T1; reine Status-Logik (nextStatus/isActive/statusLabel) → T1 (getestet); OrderRow-Typ → T1; Store (getOrders/getMyOrders/updateOrderStatus) → T2; Realtime-Hook → T3; Kunden-Seite + BottomNav-Tab → T4; Admin-Seite + Nav → T5; Badge (geteilt) → T4/T5; Routing → T4/T5; SETUP-Realtime + Doku → T6. Nicht-Ziele (WhatsApp/Server-Validierung/Dashboard-Umbau/Kundenname) ausgelassen.
- **Grün ohne Supabase:** T1 testet reine Logik; T2/T3/T4/T5 verifizieren nur `bun run build` (supabase-js typt ohne Verbindung); SQL (T1) ist nicht Teil des Vite-Builds.
- **Typ-/Signatur-Konsistenz:** `OrderStatus`/`OrderRow` (T1) durchgängig in store (T2), Hook-Scope, Seiten (T4/T5), Badge; `getOrders/getMyOrders/updateOrderStatus` (T2) in T4/T5 genutzt; `useOrdersRealtime(onChange, {userId?})` (T3) in beiden Seiten; `nextStatus/isActive/statusLabel` (T1) in Admin-Seite + Badge; `OrderStatusBadge` (T4) in T5 wiederverwendet.
- **Platzhalter:** keine; der `r: any`-Mapper und der optionale Realtime-Cast sind bewusste, begründete Notizen (ungetypter supabase-js-Client), keine offenen TODOs.
