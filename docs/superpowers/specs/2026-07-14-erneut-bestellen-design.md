# Design: Erneut bestellen (1-Tap Reorder)

**Datum:** 2026-07-14
**Status:** freigegeben (Brainstorming)
**Kontext:** Pizza-Vorbestell-App (React/Vite/Supabase). Das Bestell-Detail-Modal `OrderQrModal`
(„Meine Bestellungen") ist bereits live. Frontend auf Vercel.

## Ziel

Ein Kunde kann eine frühere Bestellung mit wenigen Taps erneut in den Warenkorb legen und direkt zum
Checkout gehen — ohne jede Pizza neu zu konfigurieren.

## Rahmenbedingungen (kein Backend)

- Bestell-Positionen liegen als `OrderRow.items` (`CartItem[]`: `pizzaName`, `ingredientIds`, `sauceId?`)
  vor. `useCart` hat `addToCart(pizzaName, ingredientIds, sauceId?)` — die Positionen lassen sich direkt
  zurücklegen. **Keine Migration, kein Server.**

## Betroffene Dateien

- **Modify:** `Frontend/src/components/orders/order-qr-modal.tsx` (Button + Logik)
- **Docs:** Changelog, TODO

## Verhalten

- Im `OrderQrModal` (öffnet sich beim Antippen einer Bestellung) unten ein Button **„Erneut bestellen"**
  (Icon `RotateCcw`).
- Klick →
  1. für jede Pizza-Position der Bestellung `addToCart(item.pizzaName, item.ingredientIds, item.sauceId)`;
  2. `onClose()` (Modal schließen);
  3. `navigate("/warenkorb")` (Checkout) — so sieht der Kunde den Warenkorb, wählt Abholdatum/-zeit neu.
- **Anhängen** an den bestehenden Warenkorb (nicht ersetzen).
- **Kein Bestätigungsdialog** (nicht destruktiv; im Warenkorb einzeln entfernbar).

## Randfälle

- **Nicht-mehr-verfügbare Zutaten:** Positionen werden **wie bestellt** übernommen (das „Gleiche
  nochmal"). Der Server prüft Verfügbarkeit ohnehin nicht (Preis nur nach Anzahl). Eine Warnung „Zutat
  aktuell nicht verfügbar" ist bewusst **nicht** im MVP (später möglich).
- **Gelöschte Zutat-ID:** rendert als ID statt Name (kosmetisch), Bestellung bleibt möglich.
- **Sonderartikel (geplantes VIP-System, noch nicht gebaut):** Reorder übernimmt **nur Pizza-
  Positionen**. Sonderartikel werden **nicht** mit-zurückgelegt (sie brauchen Code/Grant, und eine
  ausgeblendete reine Sonderartikel-Bestellung ist ohnehin nicht sichtbar). Siehe Spec „Sonderartikel".
  → Bei Umsetzung des Reorders defensiv nur Positionen ohne `kind === "special"` übernehmen.

## Tests

- Trivialer Anteil (Positionen → `addToCart`-Aufrufe). Optional ein reiner Helfer, der `OrderRow.items`
  auf die reorderbaren (Pizza-)Positionen abbildet — nur einführen, wenn's die Sonderartikel-Filterung
  sauberer macht. Sonst Build + manueller Test.

## Doku

- **Changelog**-Eintrag (2026-07-14).
- **TODO:** neuer erledigt-Eintrag „Erneut bestellen (1-Tap)".
- **Kein ADR**, **keine Migration**.

## Bewusst NICHT im Scope (YAGNI)

- Kein Positions-Auswahl-Dialog (immer die ganze Bestellung; einzeln entfernen geht im Warenkorb).
- Keine Verfügbarkeits-/Preis-Warnung beim Reorder (MVP).
- Kein Reorder direkt von der Karte (nur im Modal — bewusst entschieden).
