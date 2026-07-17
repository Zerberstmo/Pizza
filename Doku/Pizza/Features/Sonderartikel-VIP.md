# Feature — Sonderartikel/VIP

- **Status:** in Arbeit (Code fertig auf `feat/sonderartikel-vip`, noch nicht gemergt/deployt)
- **Zweck:** Versteckte Menü-Items, die nur einzelnen registrierten Kunden per Code zugänglich sind —
  mit **pro-Kunde-Preis** und **Mengen-Staffeln**. Für den Betreiber: etwas verkaufen, das nicht auf der
  Speisekarte steht, ohne dass Unbeteiligte davon erfahren.

## Ablauf

1. **Admin** legt unter `/admin/sonderartikel` einen Sonderartikel an (Emoji, Name, Code, aktiv/inaktiv).
2. **Admin** schaltet einzelne Kunden frei und hinterlegt je Kunde eine Preisstaffel
   (`min_qty → unit_price`, z. B. 1 Stück = 6 €, ab 3 Stück = 4 € je Stück).
3. **Kunde** tippt den Code im **Gutscheinfeld** des Checkouts ein. Ist er freigeschaltet, landet der
   Artikel im Warenkorb — mit Stepper für die Menge und dem Zeilenpreis aus *seiner* Staffel.
4. **Kunde** bestellt normal. Der Server prüft Zugang und Preis erneut und rechnet autoritativ.
5. Nach `status = "abgeholt"` verschwindet der Sonderartikel aus der **Kundenansicht** (Diskretion).
   Der Admin sieht ihn weiterhin.

Ein Code, der kein freigeschalteter Sonderartikel ist, durchläuft unverändert den normalen
Gutschein-Weg — der Kunde merkt keinen Unterschied.

## Technische Umsetzung

- **Frontend:**
  - `types/index.ts` — `CartItem` ist eine **diskriminierte Union** (`PizzaCartItem | SpecialCartItem`,
    Diskriminator `kind`; fehlend = Pizza, rückwärtskompatibel zu Alt-Warenkörben/-Bestellungen).
  - `lib/special-pricing.ts` — `priceForQty(tiers, qty)`: **flach je Stufe**, Stückpreis der Stufe mit
    größtem `min_qty ≤ qty`, Zeilenpreis = `qty × unit_price`.
  - `lib/cart-items.ts` — reine Helfer: `isSpecialItem`, `itemTitle`, `itemLineTotal`, `pizzaQuantity`,
    `specialsTotal`, `cartSubtotal`, Reducer `addSpecialTo`/`setSpecialQtyIn`, `redactPickedUpSpecials`.
  - `hooks/use-cart.tsx` — `addSpecial`/`setSpecialQty`; `count` zählt **nur Pizzas**.
  - `pages/checkout/checkout-page.tsx` — Code-Einlösung im Gutscheinfeld, Special-Zeile mit Stepper.
  - `pages/admin/special-items-page.tsx` + Route `/admin/sonderartikel` — Item-CRUD + Freischaltungen.
  - Angepasste Anzeige-Stellen: Bestätigung, Status-Seite, „Meine Bestellungen", `OrderQrModal`
    („Erneut bestellen" überspringt Specials), Admin-Bestellungen.
- **Backend:** Migration `0012_special_items.sql`
  - `public.special_line_price(jsonb, int)` — **spiegelt `priceForQty`** (synchron halten!).
  - `public.unlock_special_item(text)` — SECURITY DEFINER, liefert die **eigene** Freischaltung oder leer.
  - `public.validate_order()` — ersetzt die Fassung aus 0011: `subtotal = 10 € × Σ(Pizza-Menge) +
    Σ(Sonderartikel-Zeilenpreise)`, prüft je Special-Position einen aktiven Grant für `new.user_id`.
  - `public.get_order_status(uuid)` — filtert bei `abgeholt` die Special-Positionen; eine reine
    Special-Bestellung liefert danach gar keine Zeile mehr.
- **Daten:**
  - `special_items` — `id`, `code` (unique), `name`, `emoji`, `active`, `created_at`.
  - `special_item_grants` — `id`, `item_id`, `user_id`, `tiers` (jsonb), `active`, unique `(item_id, user_id)`.
  - Beide Tabellen: **RLS admin-only**. Kunden erreichen sie ausschließlich über den RPC.

## Abhängigkeiten

- Baut auf **Mengen im Warenkorb** (Migration `0011`, mengengewichteter Pizza-Subtotal) auf.
- Supabase (Postgres/RLS/RPC), bestehende `vouchers`/`app_config`-Logik im selben Trigger.
- `digest.ts` ↔ `supabase/functions/daily-digest/index.ts` (Deno-Copy) — **synchron halten**.

## Fehlerfälle

| Fall | Verhalten |
|---|---|
| Unbekannter Code | Identisch zu „Code existiert, aber nicht freigeschaltet" → leeres Ergebnis, dann normaler Gutschein-Weg. **Kein Leak**, ob der Code existiert. |
| Kunde nicht (mehr) freigeschaltet | `validate_order` wirft „Kein Zugang zu Sonderartikel" → Bestellung scheitert. |
| Manipulierter `lineTotal`/`total` im Client | Server überschreibt `subtotal`/`discount`/`total`. Client-Preise sind reine Anzeige. |
| Staffel ohne passende Stufe für die Menge | `special_line_price` wirft „Keine passende Preisstaffel für Menge %" → Bestellung scheitert (siehe Offene Punkte). |
| Netzwerk-/RPC-Fehler bei der Einlösung | Checkout fällt still auf den normalen Gutschein-Weg zurück. |

## Tests

Reine Logik mit `bun:test`: `special-pricing` (7), `cart-items` (6), `cart-special-reducer` (3),
`order-discretion` (3), Dashboard- und Digest-Ausschluss der Specials. SQL ist in dieser Umgebung nicht
ausführbar → Migration per Review + Smoke-Test des Betreibers abgesichert.

## Betreiber-Schritte

1. `bunx supabase db push` (Migration `0012`) — **erledigt am 2026-07-17**, vor dem Frontend-Deploy.
2. `bunx supabase functions deploy daily-digest --use-api --project-ref gvszyvgbbsmlulhqiakp` — offen.
3. Frontend-Deploy (Vercel Auto-Deploy auf `main`) — offen, Branch noch nicht gemergt.
4. Smoke-Test: Sonderartikel + Freischaltung anlegen → Kunde löst Code ein → bestellt → Preis stimmt →
   nach `abgeholt` verschwindet der Artikel kundenseitig.

## Offene Punkte

- **`min_qty: 1` wird im Admin-UI nicht erzwungen.** Löscht der Admin die Basisstufe oder hebt sie an,
  scheitert die Bestellung des Kunden serverseitig — für den Admin unsichtbar. Eigenes Thema.
- **Sofort-Bestellung + Sofort-WhatsApp** (reine Special-Bestellung ohne Abhol-Beschränkungen, sofortige
  Benachrichtigung) ist entworfen, aber nicht umgesetzt:
  `docs/superpowers/specs/2026-07-17-sonderartikel-sofortbestellung-design.md`.
- Die Diskretion greift **nur in der Anzeige**. In `orders.items` bleiben die Specials gespeichert —
  wer DB-Zugang hat, sieht sie.
