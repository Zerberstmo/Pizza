# Design: Mengen im Warenkorb

> Status: freigegeben (Brainstorming 2026-07-15)
> Umfang: **fokussiert** — nur Mengen für den normalen Pizza-Fluss. Das versteckte
> Gutschein-Item ist ein späteres, eigenes Projekt, das dieses Mengen-Modell nur noch nutzt.

## Ziel & Motivation

Der Warenkorb kennt aktuell keine Mengen: `CartItem` = „eine Pizza = ein Eintrag"
(`use-cart.tsx`). Kund:innen, die 3× dieselbe Pizza wollen, müssen sie dreimal
konfigurieren; „Erneut bestellen" dupliziert Zeilen. Dieses Projekt führt eine
`quantity` pro Position ein, verschmilzt identische Positionen und zieht die Menge
sauber durch Preis, Server-Validierung und alle Auswertungen (Dashboard, Digest, Status).

## Entscheidungen (aus dem Brainstorming)

1. **Verschmelzen statt getrennter Zeilen:** identische Positionen werden zu einer
   Zeile mit Mengen-Stepper zusammengeführt.
2. **Gleichheits-Definition:** `pizzaName` **+** sortierte `ingredientIds` **+** `sauceId`
   (mit `sauceId ?? ""`). Sortieren, damit Zutaten-Reihenfolge egal ist.
3. **Obergrenze:** sanftes Limit **20** pro Zeile. Client-Stepper **und** Server klemmen
   identisch auf `[1, 20]`.
4. **Fokus:** nur Mengen; kein verstecktes Item in diesem Projekt.

## 1. Datenmodell (`Frontend/src/types/index.ts`)

`CartItem` erhält ein Pflichtfeld:

```ts
export interface CartItem {
  cartId: string;
  pizzaName: string;
  ingredientIds: string[];
  sauceId?: string;
  quantity: number; // immer >= 1, geklemmt auf [1, 20]
}
```

Gleichheits-Schlüssel (Helfer, z. B. in `use-cart.tsx` oder `lib/`):

```ts
const cartKey = (i: Pick<CartItem, "pizzaName" | "ingredientIds" | "sauceId">) =>
  `${i.pizzaName}|${[...i.ingredientIds].sort().join(",")}|${i.sauceId ?? ""}`;
```

## 2. Warenkorb-Hook (`Frontend/src/hooks/use-cart.tsx`)

Neue/geänderte API:

- `addToCart(pizzaName, ingredientIds, sauceId?, qty = 1)`: berechnet den
  Gleichheits-Schlüssel; existiert eine Zeile → `quantity = clamp(quantity + qty, 1, 20)`;
  sonst neue Zeile mit `quantity = clamp(qty, 1, 20)`. Gilt automatisch für den
  Konfigurator **und** für „Erneut bestellen" (`OrderQrModal`), das die
  Positionen-Mengen der Bestellung durchreicht.
- `setQuantity(cartId, n)`: setzt `clamp(n, 1, 20)`.
- `increment(cartId)` / `decrement(cartId)`: `+1` / `-1`, geklemmt auf `[1, 20]`.
  Der `−`-Button ist bei `quantity === 1` deaktiviert; **Entfernen** bleibt der
  vorhandene Papierkorb-Button (`removeFromCart`).
- `count`: künftig **Summe der Mengen** (`Σ quantity`) statt `cart.length` — für den
  Badge in der Bottom-Nav intuitiver. (Ripple-Check: `bottom-nav.tsx` nutzt `count`.)

`clamp` = `Math.max(1, Math.min(20, Math.floor(n)))`.

## 3. Preis (`Frontend/src/lib/pricing.ts`)

- Neuer Helfer `cartQuantity(items: CartItem[]): number` = `Σ (item.quantity ?? 1)`.
- `computeSubtotal` bekommt die **Gesamtmenge** übergeben statt `items.length`
  (Signatur bleibt `(count: number) => number`; Aufrufer übergeben `cartQuantity(items)`).
- Gutschein-Logik (`computeDiscount`/`computeTotal`/`validateVoucher`) unverändert —
  sie rechnet auf dem Subtotal.

## 4. Server-Migration `supabase/migrations/0011_order_quantity.sql`

`validate_order` wird per `create or replace` ersetzt (Struktur wie `0007`, nur die
Subtotal-Berechnung ändert sich). Statt `subtotal := 10 * n`:

```sql
-- Menge pro Position serverseitig absichern: fehlend/ungültig -> 1, geklemmt [1,20].
select coalesce(sum(greatest(1, least(20, floor(coalesce((elem->>'quantity')::numeric, 1))::int))), 0)
  into total_qty
  from jsonb_array_elements(new.items) elem;
if coalesce(jsonb_array_length(new.items), 0) < 1 then
  raise exception 'Leere Bestellung';
end if;
subtotal := 10 * total_qty;
```

Damit kann kein manipuliertes JSON (Menge `0`, negativ, `9999`) den Preis austricksen.
Alles Übrige (Gutschein atomar prüfen/zählen, Slot-/Wochentag-/Uhrzeit-/Service-Prüfung)
bleibt **wortgleich** zu `0007`. Der `create trigger` aus `0005` bleibt bestehen (nur die
Funktion wird ersetzt).

**Client/Server-Parität:** beide klemmen `[1, 20]`, fehlend → `1`. Kein „Server hat
deinen Preis korrigiert"-Effekt.

## 5. Lese-Stellen — Abwärtskompatibilität (`quantity ?? 1`)

Bestehende Bestellungen in der DB haben kein `quantity`-Feld. **Kein Datenmigration nötig**
(sie waren implizit Menge 1 und wurden auch so bepreist). Alle Lese-Pfade behandeln fehlendes
`quantity` als `1`:

- **`lib/dashboard.ts`** (`computeDashboard`): Pizza-Zählung, Zutaten-Top-5 und
  abgeleitete Kennzahlen multiplizieren pro Position mit `quantity ?? 1`.
  (Umsatz kommt aus `orders.total` und ist bereits korrekt — nur die Mengen-Zählungen anpassen.)
- **`lib/digest.ts`**:
  - `formatDigest` / Tages-Bestellliste: Pizza-Zeilen zeigen `× n`.
  - `formatPrepList` / Vorbereitungsliste: Zutaten-, Soßen- **und Teiganzahl** × `quantity ?? 1`.
- **Anzeige `× n` pro Zeile:** Checkout (`checkout-page`), Bestätigung
  (`confirmation-page`), „Meine Bestellungen"-Modal (`order-qr-modal`), öffentliche
  Status-Seite (`order-status-page`), Admin-Bestellungen (`orders-page`).
  Ggf. über `lib/order-labels.ts` / `describeItem`, wo bereits Positions-Beschriftung entsteht.

## 6. Tests (bun:test)

- **`pricing`**: `cartQuantity` summiert korrekt; `computeSubtotal` aus Gesamtmenge.
- **`use-cart`**: Verschmelzen bei Gleichheit (inkl. Zutaten-Reihenfolge egal);
  Trennung bei unterschiedlichem Namen/Zutaten/Soße; Klemmen bei 20 (auch beim
  Verschmelzen über 20 hinaus); `decrement` stoppt bei 1; Menge wird beim
  „Erneut bestellen" korrekt durchgereicht.
- **`digest`** + **`dashboard`**: Aggregation × Menge **und** Legacy-Items ohne
  `quantity` zählen als 1.
- Die Migration selbst führt/prüft der Betreiber (`bunx supabase db push`); die
  Klemm-Logik ist client-seitig gespiegelt und dort getestet (Parität).

## Betroffene Dateien (Überblick)

Frontend: `types/index.ts`, `hooks/use-cart.tsx`, `lib/pricing.ts`, `lib/dashboard.ts`,
`lib/digest.ts`, `lib/order-labels.ts`, `components/orders/order-qr-modal.tsx`,
`pages/checkout/checkout-page.tsx`, `pages/confirmation/confirmation-page.tsx`,
`pages/status/order-status-page.tsx`, `pages/admin/orders-page.tsx`,
`components/layout/bottom-nav.tsx` (+ Tests).
Backend: `supabase/migrations/0011_order_quantity.sql`.

## Nicht-Ziele

- Verstecktes/gutschein-freischaltbares Warenkorb-Item (eigenes Projekt).
- Unterschiedliche Preise pro Position (alles bleibt Pauschal-10 €).
- Server-seitige Persistenz einer normalisierten Positions-Tabelle (Items bleiben JSONB).
