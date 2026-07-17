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
   Enthält der Warenkorb **keine einzige Pizza**, entfällt die Abholtag-/Uhrzeit-Auswahl automatisch —
   der Checkout zeigt stattdessen „Abholung sofort" und setzt Datum/Zeit auf jetzt (Europe/Berlin).
   Vorlaufzeit, Bestelltage, Öffnungszeiten und Service-Verfügbarkeit werden dabei übersprungen; Preis-
   und Zugangsprüfung laufen unverändert serverautoritativ. Sobald eine Pizza im Warenkorb liegt, gilt
   wieder der normale Abhol-Weg. Zusätzlich löst jede Bestellung mit mindestens einem Sonderartikel
   binnen Sekunden eine WhatsApp an den Betreiber aus — unabhängig davon, ob auch Pizzen dabei sind.
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
    `specialsTotal`, `cartSubtotal`, Reducer `addSpecialTo`/`setSpecialQtyIn`, `redactPickedUpSpecials`,
    `isSpecialsOnly` (nicht-leerer Warenkorb ohne jede Pizza — TS-Gegenstück zu `pizza_qty = 0`).
  - `hooks/use-cart.tsx` — `addSpecial`/`setSpecialQty`; `count` zählt **nur Pizzas**.
  - `lib/berlin-time.ts` — `berlinDateTime(now)`: liefert Datum/Uhrzeit für „jetzt" in Europe/Berlin
    (DST-sicher über die IANA-Zone), unabhängig davon, in welcher Zeitzone der Browser des Kunden steht.
  - `lib/special-alert.ts` — reine Funktion `formatSpecialAlert`: baut den WhatsApp-Text für die
    Sofort-Benachrichtigung (Bestellnummer, Uhrzeit, Kunde, Artikel, Summe, Abholart, Notiz). Mit
    `bun:test` getestet; die Edge Function spiegelt sie als Deno-Copy — synchron halten.
  - `pages/checkout/checkout-page.tsx` — Code-Einlösung im Gutscheinfeld, Special-Zeile mit Stepper.
    Bei `isSpecialsOnly(cart)` blendet die Seite die Abholtag-/Uhrzeit-Auswahl aus („Abholung sofort")
    und schickt beim Absenden `berlinDateTime(new Date())` statt der gewählten Werte.
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
  - Migration `0013_special_instant_order.sql`:
    - Neue Spalte `orders.special_notified_at` (`timestamptz`, `null` = noch nicht zugestellt).
    - `validate_order` ersetzt: Zählt zusätzlich `pizza_qty`. Ist sie `0`, überspringt die Funktion den
      **kompletten** Abhol-Slot-Block (Vorlaufzeit-, Wochentag-, Öffnungszeiten- und
      Service-Verfügbarkeits-Prüfung). Preisberechnung, Grant-/Zugangsprüfung, Voucher-Logik und die
      Prüfung `service_mode ∈ ('dinein','takeaway')` laufen **immer**, unabhängig von `pizza_qty`.
    - Neue Funktion + Trigger `notify_special_order` (AFTER INSERT auf `orders`, zusätzlich zum
      bestehenden Trigger aus `0005`): Feuert nur, wenn `new.items` mindestens ein Element mit
      `kind = 'special'` enthält, und ruft dann per `pg_net` die Edge Function auf (Payload
      `{ order_id }`). URL und Service-Role-Key kommen aus `app.settings.notify_url` /
      `app.settings.notify_key` (vom Betreiber per SQL gesetzt, **nicht** im Git) — fehlen sie, wird
      still übersprungen. Der Trigger fängt eigene Fehler ab (`exception when others then return new;`); eine
      fehlgeschlagene Benachrichtigung darf die Bestellung nie scheitern lassen.
- **Edge Function** `supabase/functions/notify-special-order/index.ts`:
  - Zwei Aufrufwege: (1) der DB-Trigger mit `{ order_id }` für genau eine Bestellung, (2) `pg_cron`
    ohne Payload als Sicherheitsnetz — sucht dann alle Sonderartikel-Bestellungen der letzten 2 Stunden
    mit `special_notified_at IS NULL`.
  - Liest Empfänger/API-Key/Aktiv-Schalter aus der bestehenden `notify_config` (kein zweiter
    Einstellungssatz); `enabled = false` oder fehlende Werte → nichts senden, nichts markieren.
  - Sendet über CallMeBot, **danach erst** `special_notified_at = now()` setzen (nicht umgekehrt) —
    ein Claim vor dem Versand würde bei einem Sendefehler den Retry verhindern.
  - `formatSpecialAlert` ist als Deno-Copy von `lib/special-alert.ts` eingebettet — synchron halten.
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
| CallMeBot down / antwortet nicht mit 2xx | `special_notified_at` bleibt `null` → Cron holt innerhalb von 2 h nach. |
| `pg_net`-Aufruf im Trigger schlägt fehl | Trigger schluckt den Fehler, die Bestellung bleibt gültig → Cron holt nach. |
| `app.settings.notify_url`/`notify_key` nicht gesetzt | Trigger überspringt still → Cron holt nach, sobald gesetzt. |
| `notify_config.enabled = false` | Nichts senden, **nicht** markieren; die Bestellung altert irgendwann aus dem 2-h-Fenster des Crons heraus. |
| Bestellung storniert | Nicht senden. |
| Senden erfolgreich, aber `special_notified_at` lässt sich nicht setzen (DB-Fehler beim `update`) | Die Edge Function meldet das **nicht** als Erfolg: sie zählt Markier-Fehlschläge und antwortet mit HTTP 500 (`sent: X/Y, mark failed: N`), Vorbild ist `daily-digest`. Grund: Bliebe `special_notified_at` leer, hielte der 5-Minuten-Cron die Bestellung für unbenachrichtigt und würde dieselbe WhatsApp unbegrenzt alle 5 Minuten erneut verschicken, ohne dass es jemand bemerkt (Fund aus dem Code-Review, behoben in Commit `87fa55d`). |

## Tests

Reine Logik mit `bun:test`: `special-pricing` (7), `cart-items` (6), `cart-special-reducer` (3),
`order-discretion` (3), Dashboard- und Digest-Ausschluss der Specials. SQL ist in dieser Umgebung nicht
ausführbar → Migration per Review + Smoke-Test des Betreibers abgesichert.

## Betreiber-Schritte

1. `bunx supabase db push` — Migration `0012` ist **erledigt am 2026-07-17**; Migration `0013`
   (Sofort-Bestellung + Notify-Trigger) steht noch aus.
2. `bunx supabase functions deploy daily-digest --use-api --project-ref gvszyvgbbsmlulhqiakp` — offen
   (die deployte Version spiegelt die neuesten Sonderartikel-Änderungen noch nicht).
3. `bunx supabase functions deploy notify-special-order --use-api --project-ref gvszyvgbbsmlulhqiakp` —
   offen (die Function ist noch nie deployt).
4. Einstellungen setzen (SQL-Editor, echte Werte einsetzen, **nicht** ins Git):
   `app.settings.notify_url`, `app.settings.notify_key` — offen.
5. Cron-Sicherheitsnetz anlegen (`cron.schedule('special-alert-retry', '*/5 * * * *', …)`) — offen.
6. Frontend-Deploy (Vercel Auto-Deploy auf `main`) — offen, Branch noch nicht gemergt.
7. Smoke-Test: Sonderartikel + Freischaltung anlegen → Kunde löst Code ein → bestellt → Preis stimmt →
   nach `abgeholt` verschwindet der Artikel kundenseitig. Zusätzlich: Ein freigeschalteter Kunde legt
   **nur** einen Sonderartikel in den Warenkorb → Checkout zeigt „Abholung sofort" ohne Datum/Zeit →
   Bestellung geht durch → WhatsApp trifft binnen Sekunden ein → `special_notified_at` ist gesetzt.

## Offene Punkte

- **`min_qty: 1` wird im Admin-UI nicht erzwungen.** Löscht der Admin die Basisstufe oder hebt sie an,
  scheitert die Bestellung des Kunden serverseitig — für den Admin unsichtbar. Eigenes Thema.
- **Doppelzustellung ist bewusst nicht gesperrt.** Trigger und Cron könnten theoretisch dieselbe
  Bestellung greifen (kein „Claim vor dem Senden", siehe oben). Im seltenen Kollisionsfall kommt die
  WhatsApp doppelt statt gar nicht — für diesen Anwendungsfall der bessere Fehler.
- **Keine Ruhezeit.** Die Sofort-WhatsApp kann auch nachts eintreffen, wenn ein freigeschalteter Kunde
  dann bestellt. Bewusst nicht Teil dieses Entwurfs (YAGNI); der Aufbau steht einer späteren Ergänzung
  nicht im Weg.
- Die Diskretion greift **nur in der Anzeige**. In `orders.items` bleiben die Specials gespeichert —
  wer DB-Zugang hat, sieht sie.
