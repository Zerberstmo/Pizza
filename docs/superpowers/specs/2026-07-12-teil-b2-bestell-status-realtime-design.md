# Design: Teil-B2 — Bestell-Status + Realtime

- **Datum:** 2026-07-12
- **Status:** genehmigt (User-Freigabe des Designs)
- **Kontext:** Zweites Sub-Projekt von Teil-B, baut auf B1 (Supabase). Die `orders`-Tabelle existiert mit `status`-Spalte (Default `'eingegangen'`), RLS erlaubt Kunden das Lesen eigener Bestellungen und Admins Lesen/Update aller. Frontend: Vite + React 18 + TS + shadcn, Bun, `@supabase/supabase-js`.

## Ziel

Bestell-Status-Workflow + Live-Updates: Der Admin sieht eingehende Bestellungen (live) und schaltet ihren Status weiter; der Kunde sieht den Live-Status seiner Bestellungen in einer eigenen Liste. Realtime über Supabase `postgres_changes`.

## Voraussetzungen & Umgebungs-Realität (verbindlich)

- **Diese Umgebung erreicht Supabase nicht.** Verifiziert wird hier nur `bun run build` (Typecheck) + die reinen Logik-Tests. Realtime/Queries testet der Betreiber gegen sein Projekt.
- **Betreiber muss Realtime für `orders` aktivieren** (Supabase → Database → Replication/Realtime → Tabelle `orders`). Wird in `SETUP-Supabase.md` ergänzt.

## Nicht-Ziele (bewusste Grenzen)

- **Keine Push-Notifications / kein WhatsApp** (das ist B3). B2 zeigt Status nur in der App (Realtime).
- **Keine serverseitige Preis-/Vorlauf-Validierung** (B4).
- **Kein echter Dashboard-Umbau** — die Mock-Kennzahlen bleiben; B2 fügt nur die Bestellansicht hinzu.
- **Kein Kundenname in der Admin-Liste** — Bestellungen werden über Nummer/QR identifiziert (Name via Profil-Join = späterer Zusatz).

## Status-Modell

```ts
export type OrderStatus = "eingegangen" | "in_arbeit" | "fertig" | "abgeholt" | "storniert";
```
- **Vorwärts-Ablauf:** `eingegangen → in_arbeit → fertig → abgeholt`. `storniert` ist von jedem aktiven Status aus erreichbar (Admin bricht ab). `abgeholt`/`storniert` sind Endzustände.
- **Migration `supabase/migrations/0004_order_status.sql`:** `orders.status` bekommt einen `CHECK`-Constraint auf die 5 Werte (Default `'eingegangen'` bleibt).

### Reine Status-Logik (`Frontend/src/lib/order-status.ts`, getestet)
```ts
export const ORDER_STATUSES: OrderStatus[]; // Reihenfolge für Anzeige
export function nextStatus(s: OrderStatus): OrderStatus | null; // eingegangen→in_arbeit→fertig→abgeholt; sonst null
export function isActive(s: OrderStatus): boolean;              // nicht abgeholt/storniert
export function statusLabel(s: OrderStatus): string;           // deutsche Anzeige, z.B. "In Arbeit"
```

## Typen (`Frontend/src/types/index.ts`)

```ts
export interface OrderRow {
  id: string;
  items: CartItem[];
  total: number;
  serviceMode: ServiceMode;
  pickupDate: string;
  pickupTime: string;
  notes: string;
  status: OrderStatus;
  createdAt: string;   // ISO
  userId: string | null;
}
```
(`OrderData` aus B1 bleibt für den Checkout-Rückgabewert; `OrderRow` ist der Listen-/DB-Typ.)

## Datenschicht (`Frontend/src/lib/data/store.ts`)

```ts
export function getOrders(): Promise<OrderRow[]>;                    // Admin: alle, created_at desc
export function getMyOrders(): Promise<OrderRow[]>;                  // Kunde: eigene (RLS user_id=auth.uid()), created_at desc
export function updateOrderStatus(id: string, status: OrderStatus): Promise<void>; // Admin (RLS: nur Admin)
```
Mapping snake→camel wie in B1 (`created_at→createdAt`, `user_id→userId`, `service_mode→serviceMode`, `pickup_date/time`). `createOrder` (B1) bleibt; es setzt `status` bereits auf `eingegangen`.

## Realtime-Hook (`Frontend/src/hooks/use-orders-realtime.ts`)

```ts
export function useOrdersRealtime(onChange: () => void, scope: { userId?: string }): void;
```
- Abonniert einen Supabase-Channel auf `postgres_changes` (Event `*`, Schema `public`, Tabelle `orders`); bei `scope.userId` mit `filter: user_id=eq.<id>` (Kunde), sonst alle (Admin).
- Bei jedem Event ruft der Hook `onChange()` → die Seite lädt die Liste neu (einfach + robust, kein manuelles Merge).
- `useEffect`-Cleanup: `supabase.removeChannel(channel)`. Re-subscribe bei geändertem `scope.userId`.

## Admin — „Bestellungen" (`/admin/bestellungen`)

- Neue Seite `Frontend/src/pages/admin/orders-page.tsx`; neuer Nav-Punkt in `admin-shell.tsx` (Icon z.B. `ClipboardList`).
- Lädt `getOrders()`, abonniert `useOrdersRealtime(reload, {})` (alle).
- **Standard: aktive Bestellungen** (`isActive`) prominent, neueste zuerst; **Umschalter** „auch erledigte zeigen" blendet `abgeholt`/`storniert` ein.
- Pro Bestellung: Nummer, Uhrzeit (`createdAt`), Modus (Vor Ort/Abholung) + Zeit, Positionen (kurz), **Status-Badge**; Aktionen: **Weiterschalten** (Button `→ {statusLabel(nextStatus)}`, nur wenn `nextStatus` ≠ null) und **Stornieren** (nur wenn `isActive`). Beide via `updateOrderStatus`.

## Kunde — „Meine Bestellungen" (`/meine-bestellungen`)

- Neue Seite `Frontend/src/pages/orders/my-orders-page.tsx` (im Kunden-`AppLayout`, hinter `RequireCustomer`).
- **5. BottomNav-Tab** „Bestellungen" (zwischen Warenkorb und Profil; Icon `ClipboardList`).
- Lädt `getMyOrders()`, abonniert `useOrdersRealtime(reload, { userId: currentUser.id })`.
- Pro Bestellung: Nummer, Datum/Zeit, Positionen, **Live-Status-Badge** (aktualisiert sich, wenn der Admin umschaltet). Leerer Zustand: Hinweis „Noch keine Bestellungen".
- Bestätigungsseite bleibt; ein Link „Meine Bestellungen" führt zur Liste.

## Routing (`router.tsx`)

- Kunde: `/meine-bestellungen` als Kind von `AppLayout` (RequireCustomer).
- Admin: `bestellungen` als Kind von `AdminLayout` (RequireAdmin).

## Tests & Verifikation

- **Reine Logik (bun:test):** `order-status.ts` — `nextStatus` (jede Stufe inkl. Endzustände → null), `isActive` (aktive vs. abgeholt/storniert), `statusLabel`.
- **Store/Realtime/Seiten:** dünne Supabase-Wrapper → hier nur `bun run build` (Typecheck) + bestehende Tests grün. Betreiber testet real (Realtime aktivieren, Admin schaltet Status → Kundenliste aktualisiert sich live).

## Betroffene Dateien

**Neu:** `supabase/migrations/0004_order_status.sql`, `Frontend/src/lib/order-status.ts` (+ Test), `Frontend/src/hooks/use-orders-realtime.ts`, `Frontend/src/pages/admin/orders-page.tsx`, `Frontend/src/pages/orders/my-orders-page.tsx`.
**Geändert:** `Frontend/src/types/index.ts` (`OrderStatus`, `OrderRow`), `Frontend/src/lib/data/store.ts` (`getOrders`/`getMyOrders`/`updateOrderStatus`), `Frontend/src/router.tsx` (2 Routen), `Frontend/src/components/layout/admin-shell.tsx` (Nav), `Frontend/src/components/layout/bottom-nav.tsx` (5. Tab), `Doku/Pizza/SETUP-Supabase.md` (Realtime aktivieren), Changelog/README/TODO.

## Definition of Done

- `bun run build` grün; reine Logik-Tests inkl. `order-status` grün.
- Migration 0004 + neue Seiten/Hook/Store-Funktionen vorhanden; SETUP um „Realtime für orders aktivieren" ergänzt.
- Nach Betreiber-Setup: Admin sieht neue Bestellungen live, schaltet Status weiter/storniert; Kunde sieht seine Bestellungen mit Live-Status; RLS greift (Kunde nur eigene, Update nur Admin).
- Doku (Changelog/README/TODO/SETUP) aktualisiert.
