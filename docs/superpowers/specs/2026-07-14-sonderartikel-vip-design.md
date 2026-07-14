# Design: Sonderartikel (VIP-Items mit Freischaltung, Preis & Staffeln)

**Datum:** 2026-07-14
**Status:** freigegeben (Brainstorming) — Gesamt-Design, Umsetzung in Phasen
**Kontext:** Pizza-Vorbestell-App (React/Vite/Supabase). Frontend live auf Vercel. Bestehende Preis-/
Bestell-Härtung: Trigger `validate_order` rechnet serverseitig `total = 10 € × Anzahl Items`.

## Ziel

Ein Admin kann versteckte **Sonderartikel** anlegen und einzelnen **registrierten Kunden** freischalten —
mit **pro Kunde individuellem Preis** und **mehreren Mengen-Staffeln**. Ein freigeschalteter Kunde gibt
im Checkout einen **Code** ein und bekommt das Item mit **wählbarer Menge** in den Warenkorb; es fließt
mit dem korrekten (serverseitig autoritativen) Preis in die Bestellung ein. Nicht freigeschaltete
Kunden können den Code nicht nutzen.

## Grundprinzipien

- **Server autoritativ:** Preis und Zugang werden im DB-Trigger/RPC bestimmt; Client-Preise sind reine
  Anzeige (analog zum bestehenden `validate_order`, der Client-`total` überschreibt).
- **Zugang hängt am Konto:** Freischaltungen (grants) verweisen auf `auth.users` — nur eingeloggte,
  freigeschaltete Nutzer. (Bestellen erfordert ohnehin Login.)
- **Kein Leak:** Der Einlöse-RPC liefert bei unbekanntem Code UND bei fehlender Freischaltung dasselbe
  „nicht verfügbar"; Grants/Preise anderer Nutzer sind nicht auslesbar.

## Datenmodell (neue Migration, Phase 1)

### `special_items`
| Spalte | Typ | Hinweise |
|---|---|---|
| `id` | uuid pk (`gen_random_uuid()`) | |
| `code` | text **unique** | Freischalt-Code, z. B. `weed420` |
| `name` | text | Anzeigename |
| `emoji` | text | Symbol fürs UI |
| `active` | boolean default true | global aus/an |
| `created_at` | timestamptz default now() | |

### `special_item_grants`
| Spalte | Typ | Hinweise |
|---|---|---|
| `id` | uuid pk | |
| `item_id` | uuid → `special_items(id)` on delete cascade | |
| `user_id` | uuid → `auth.users(id)` on delete cascade | |
| `tiers` | jsonb | `[{ "min_qty": int, "unit_price": numeric }, …]`, aufsteigend; enthält `min_qty:1` als Basispreis |
| `active` | boolean default true | Freischaltung aus/an |
| `created_at` | timestamptz default now() | |
| | | **unique(item_id, user_id)** |

- **Staffel-Semantik (flach je Stufe):** für Menge `q` gilt der Stückpreis der Stufe mit dem größten
  `min_qty ≤ q`; Zeilenpreis = `q × unit_price`. Beispiel `[{1,6},{3,4},{10,3}]`: 2 Stück → 12 €,
  3 Stück → 12 €, 10 Stück → 30 €.

### RLS
- Beide Tabellen: RLS an. **Nur Admin** (`is_admin()`) darf lesen/schreiben (Verwaltung).
- Kunden lesen **nicht** direkt — der Zugriff läuft ausschließlich über den SECURITY-DEFINER-RPC
  (liefert nur die eigene Freischaltung). Grants für `db push`-Grants-Muster wie `0009` beachten.

## Preis-Logik (rein, geteilt Client + Server)

- **Client (TypeScript):** `priceForQty(tiers: Tier[], qty: number): number` in
  `Frontend/src/lib/special-pricing.ts` — wählt die passende Stufe, gibt `qty × unit_price`. Reine,
  getestete Funktion (bun:test): Stufengrenzen, unsortierte Tiers, qty unter `min_qty:1`, leere Tiers.
- **Server (SQL):** dieselbe Logik im Trigger nachbilden (über `tiers`-jsonb iterieren, größte passende
  Stufe wählen). Kommentar: „Spiegelt `priceForQty` aus special-pricing.ts — synchron halten."

## Warenkorb-Modell

- `CartItem` wird eine **diskriminierte Union**:
  - Pizza (wie bisher): `{ cartId, kind?: "pizza", pizzaName, ingredientIds, sauceId? }` (fehlendes
    `kind` = Pizza, rückwärtskompatibel zu bestehenden localStorage-Warenkörben).
  - Sonderartikel: `{ cartId, kind: "special", specialItemId, code, name, emoji, qty, lineTotal }`
    (`lineTotal` = client-berechneter Anzeigepreis; **nicht** autoritativ).
- `useCart`: neue `addSpecial(item)` und `setSpecialQty(cartId, qty)`; `count`/Header zählen künftig nur
  **Pizzas** (Sonderartikel getrennt).
- localStorage-Migration: alte Einträge ohne `kind` gelten als Pizza (keine Datenmigration nötig).

## Bestell-Ablauf

1. **Einlösen (Checkout, Gutscheinfeld):** Der Code-Handler prüft zuerst per RPC
   `unlock_special_item(p_code)` (SECURITY DEFINER, `grant execute to authenticated`):
   - Aktive `special_items`-Zeile mit `code = p_code` UND aktive `special_item_grants`-Zeile für
     `auth.uid()` vorhanden → liefert `{ specialItemId, name, emoji, tiers }`.
   - sonst → leeres Ergebnis. Client: Item mit Menge 1 in den Warenkorb (`addSpecial`), Preis-Vorschau
     aus `tiers` via `priceForQty`.
   - Ist der Code kein Sonderartikel-Code → normaler Gutschein-Flow wie bisher (`validateVoucher`).
2. **Bestellen:** Sonderartikel gehen als `{ kind:"special", specialItemId, name, emoji, qty, lineTotal }`
   ins `items`-jsonb.
3. **Server `validate_order` (Migration, ersetzt 0007):**
   - `subtotal = 10 × (Anzahl Pizza-Items) + Σ (Sonderartikel-Zeilenpreise)`.
   - Je Sonderartikel: Grant `(item_id = specialItemId, user_id = new.user_id, active)` nachschlagen —
     **kein aktiver Grant → `raise exception 'Kein Zugang zu Sonderartikel'`** (Bestellung scheitert).
     Sonst Zeilenpreis über die Staffeln. `qty` als Ganzzahl ≥ 1 erzwingen.
   - „Leere Bestellung" weiterhin, wenn gar keine Zeilen. Gutschein-/Slot-Logik unverändert
     (Rabatt gilt auf den neuen `subtotal`).

## Anzeige-Berührungspunkte (Phase 1)

Alle Stellen, die Bestell-Positionen rendern oder Pizzas zählen/bepreisen, müssen Sonderartikel
unterscheiden (Pizza vs `kind:"special"`):
- **Checkout** (`checkout-page.tsx`): Positionsliste (Mengen-Stepper + Zeilenpreis für Sonderartikel),
  Preisübersicht, „N Pizzen"-Header/Button, Gesamt.
- **Bestätigung** (`confirmation-page.tsx`): Positionsliste, kein pauschales „10 €" mehr für
  Sonderartikel (deren `lineTotal`).
- **Öffentliche Status-Seite** (`order-status-page.tsx`) + **RPC `get_order_status`**: Sonderartikel als
  eigene Zeile (Name/Emoji/Menge; Preis aus `lineTotal`). `describeItem` bleibt für Pizzas.
- **my-orders-Modal** (`order-qr-modal.tsx`) + Bestell-Karten: Sonderartikel korrekt darstellen (kein
  `PizzaSVG` für Sonderartikel → Emoji stattdessen).
- **Admin-Bestellansicht** (`admin/orders-page`): Sonderartikel-Zeilen.

> Vorschlag zur DRY-Reduktion: einen kleinen Helfer/Komponente „Bestellpositionen rendern" einführen,
> der Pizza vs Sonderartikel einheitlich darstellt und an mehreren Stellen wiederverwendet wird.
> (Detailentscheidung im Phase-1-Plan.)

## Admin-Verwaltung (Phase 2)

Neue Admin-Seite „Sonderartikel" (`admin/special-items-page`, neuer Tab + Route):
- **Items:** anlegen/bearbeiten/aktiv-toggle/löschen (Code, Name, Emoji).
- **Freischaltungen je Item:** Nutzer wählen (aus bestehender Nutzerliste/`getProfiles`), **Staffeln**
  pflegen (Zeilen `min_qty` + `unit_price`, hinzufügen/entfernen), aktiv-toggle, entfernen.
- Schreibt in `special_items` / `special_item_grants` (RLS admin-only). Reine Admin-CRUD analog zu den
  bestehenden Admin-Seiten (Zutaten/Gutscheine).

## Dashboard & Digest (Phase 3)

- **Dashboard** (`computeDashboard`): Sonderartikel aus der Pizza-/Zutaten-Aggregation herausfiltern
  (`kind === "special"` überspringen); Umsatz nutzt weiter `order.total` (bleibt korrekt).
- **WhatsApp-Digest** (`digest.ts` `formatDigest`/`formatPrepList`): Sonderartikel **nicht** als Pizza/
  Teig/Zutat zählen; optional als eigene Zeile „Sonderartikel: N× Name" im Tages-Digest listen, damit
  der Pizzabäcker sie sieht.

## Sicherheit

- Preis **und** Zugang serverseitig autoritativ (Trigger + RPC); Client-`lineTotal` ist nur Anzeige.
- Grants/Preise anderer Nutzer nicht auslesbar (RLS admin-only; RPC liefert nur eigene Freischaltung).
- Einlöse-RPC verrät nicht, ob ein Code existiert (einheitliches Leerergebnis).
- Der Trigger nutzt `new.user_id` (= `auth.uid()`, via `orders_insert_own`-Policy erzwungen) für den
  Grant-Lookup → ein Nutzer kann keinen fremden Preis erschleichen.

## Tests

- `priceForQty` (rein, bun:test): Stufenwahl, Grenzen (`min_qty` exakt), unsortierte/lückenhafte Tiers,
  qty unter Basisstufe, leere Tiers (Fallback definieren: 0 bzw. Ablehnung — im Plan festlegen).
- Warenkorb-Logik (`addSpecial`/`setSpecialQty`) ggf. als reine Reducer testbar.
- SQL (Trigger, RPC, RLS): in dieser Umgebung nicht ausführbar → sorgfältiges Review; Betreiber spielt
  die Migration via `bunx supabase db push` ein.

## Phasen (je eigener Plan + Umsetzung)

- **Phase 1 — Fundament & Bestellung:** Migration (Tabellen, RLS, `unlock_special_item`-RPC, neuer
  `validate_order`), Preis-Logik, Warenkorb-Modell, Checkout-Einlösung, alle Anzeige-Stellen.
  Freischaltungen anfangs per SQL/Seed. **Ergebnis:** ein (per SQL) freigeschalteter Nutzer kann per
  Code korrekt bepreist bestellen.
- **Phase 2 — Admin-Verwaltung:** Sonderartikel-Admin-Seite (Items + Freischaltungen + Staffeln).
- **Phase 3 — Feinschliff:** Dashboard/Digest sauber, Admin-Bestellansicht.

## Bewusst NICHT im Scope (YAGNI)

- Keine Selbst-Registrierung/Einlösung für nicht freigeschaltete Nutzer (Zugang nur per Admin-Grant).
- Kein Gutschein **und** Sonderartikel-Rabatt-Mischmodell über das Bestehende hinaus (normaler Gutschein
  gilt weiter auf den Gesamt-`subtotal`).
- Keine Marginal-/Bracket-Mischpreise (Staffel gilt flach je Stufe, s. o.).
- Keine Item-Varianten/Optionen (nur Menge).

## Offene Detailpunkte (im jeweiligen Phasen-Plan zu fixieren)

- Verhalten bei leeren/ungültigen `tiers` (Ablehnung vs Preis 0) — Vorschlag: Ablehnung im Trigger.
- Max-Menge pro Sonderartikel (Schutz vor Vertippern) — Vorschlag: sinnvolle Obergrenze, z. B. 99.
- Ob mehrere unterschiedliche Sonderartikel gleichzeitig im Warenkorb erlaubt sind (Modell unterstützt
  es; UI-Entscheidung).
