# Design: QR-Fenster aus „Meine Bestellungen"

**Datum:** 2026-07-14
**Status:** freigegeben (Brainstorming)
**Kontext:** Pizza-Vorbestell-App (React/Vite/Supabase). Das QR-Feature (public_token + öffentliche Status-Seite) ist bereits live. Frontend auf Vercel.

## Ziel

Ein Kunde kann in **„Meine Bestellungen"** eine bestehende Bestellung anklicken und bekommt ein
Fenster mit **QR-Code + „Status verfolgen"-Link** (plus Bestelldetails). Bisher erscheint dieses
Fenster nur **direkt nach dem Bestellen** (Bestätigungsseite, Order via Router-State) — eine bereits
getätigte Bestellung ließ sich nicht erneut öffnen, um QR/Link zu sehen.

## Rahmenbedingungen (kein Backend-Aufwand)

- Die Spalte `orders.public_token` existiert bereits für **alle** Bestellungen (Migration `0010`,
  Default `gen_random_uuid()`) — **keine Migration**, kein Betreiber-Schritt.
- `getMyOrders()` selektiert `*`, `public_token` ist also schon in den Rohdaten; es wird nur nicht
  ins `OrderRow`-Mapping übernommen.
- Reines **Frontend**, deployt über den normalen `main`-Push.

## Betroffene Dateien

- **Modify:** `Frontend/src/types/index.ts` (`OrderRow` um `publicToken`)
- **Modify:** `Frontend/src/lib/data/store.ts` (`rowToOrder` mappt `public_token`)
- **Create:** `Frontend/src/lib/order-labels.ts` (reiner Helfer `buildLabels`)
- **Test:** `Frontend/src/lib/__tests__/order-labels.test.ts`
- **Create:** `Frontend/src/components/orders/order-qr-modal.tsx`
- **Modify:** `Frontend/src/pages/orders/my-orders-page.tsx`
- **Docs:** Changelog, TODO

## Komponenten & Verhalten

### 1. Daten-Vorbereitung — `publicToken` in `OrderRow`

- `OrderRow` (types) um `publicToken: string` erweitern.
- `rowToOrder(r)` in `store.ts` ergänzt `publicToken: r.public_token`.
- Alle Bestellungen haben durch den DB-Default einen Token → `publicToken` ist immer gesetzt.

### 2. Label-Helfer — `buildLabels`

- `Frontend/src/lib/order-labels.ts`:
  `buildLabels(ingredients: IngredientItem[], sauces: Sauce[]): Record<string, string>` — baut eine
  Map `id → Name` über beide Listen (für die Zutaten-/Soßen-Auflösung im Modal). Reine Funktion.
- Wird zusammen mit dem bestehenden `describeItem(item, labels)` (aus `lib/public-order.ts`) genutzt,
  sodass die Zutaten-Zeile ohne Zugriff auf die (RLS-geschützten, aber für Eingeloggte lesbaren)
  Menü-Tabellen im Modal auskommt — die Namen werden einmal auf Seiten-Ebene aufgelöst.

### 3. Modal-Komponente — `OrderQrModal`

- `Frontend/src/components/orders/order-qr-modal.tsx`, Props:
  `{ order: OrderRow, labels: Record<string, string>, onClose: () => void }`.
- **Overlay:** `fixed inset-0`, abgedunkelter Hintergrund; **Klick auf den Hintergrund schließt**
  (Klick auf die Karte nicht, via `stopPropagation`). **Escape** schließt (Key-Listener, im Cleanup
  entfernt). Zentrierte Karte mit `motion`-Pop-in (analog Bestätigungsseite), `max-h-[85vh]` +
  `overflow-y-auto` für lange Inhalte. Ein **X**-Button oben rechts.
- **Inhalt:**
  - Bestellnummer (groß), `OrderStatusBadge`.
  - Abholung: `serviceMode === "dinein" ? "Vor Ort" : "Abholung"` + `formatDateLabel(pickupDate)` +
    `pickupTime`.
  - **QR-Code** (`QrCode` mit `data = ${window.location.origin}/bestellung/${order.publicToken}`) +
    antippbarer **„Status verfolgen"**-Link auf dieselbe URL.
  - **Pizza-Liste:** je Position `PizzaSVG` + `pizzaName` + Zutaten-Zeile `describeItem(item, labels)` +
    `10 €` (flacher Preis, konsistent zu Bestätigung/Status-Seite).
  - **Gesamt:** `formatPrice(order.total)`.
- Rein darstellend; kein Daten-Fetch in der Komponente (Order + Labels kommen als Props).

### 4. `my-orders-page.tsx`

- Zusätzlich `ingredients` + `sauces` laden (je `useAsync`), daraus
  `const labels = buildLabels(ingredients ?? [], sauces ?? [])`.
- State `selected: OrderRow | null`.
- Jede Bestell-Karte wird klickbar (`cursor-pointer`, `onClick={() => setSelected(o)}`).
- Wenn `selected` gesetzt: `<OrderQrModal order={selected} labels={labels} onClose={() => setSelected(null)} />`.
- Bestehende Liste/Realtime/`useOrdersRealtime` bleiben unverändert.

## Fehler-/Randfälle

- **Kein `publicToken`:** kann nicht auftreten (DB-Default für alle Zeilen); defensive Annahme:
  Token ist immer da.
- **Menü-Daten laden noch / leer:** `labels` ist dann leer → `describeItem` fällt auf
  „Käse & Sauce" bzw. überspringt fehlende Namen (bestehendes Verhalten). QR/Link funktionieren
  unabhängig davon.
- **Escape/Backdrop:** schließen das Modal; Cleanup des Key-Listeners beim Unmount.

## Tests (bun:test)

- `buildLabels`:
  - kombiniert Zutaten- und Soßen-IDs → Namen in einer Map.
  - leere Listen → `{}`.
  - überlappende/mehrere Einträge korrekt (keine verlorenen Keys).
- `describeItem` ist bereits getestet (QR-Feature) — hier wiederverwendet.
- Modal/Klick-Wiring: `bun run build` + manueller Klicktest (UI, Projekt-Muster).

## Doku

- **Changelog**-Eintrag (2026-07-14).
- **TODO:** kurzer Eintrag „QR/Status aus Meine-Bestellungen erneut öffenbar" als erledigt.
- **Kein ADR**, **kein SETUP**, **keine Migration**.

## Bewusst NICHT im Scope (YAGNI)

- Kein Body-Scroll-Lock hinter dem Modal (Karte scrollt intern; MVP).
- Kein Fokus-Trap / vollständige Dialog-A11y (leichtgewichtiges Overlay; Escape + Backdrop reichen fürs MVP).
- Keine Wiederverwendung/Zusammenlegung mit der Bestätigungsseite (unterschiedliche Datenquellen
  OrderData vs OrderRow; eigenes, fokussiertes Modal ist klarer als ein geteiltes Bauteil mit Sonderfällen).
- Kein Nachladen einzelner Bestellungen per ID (Order kommt aus der bereits geladenen Liste).
