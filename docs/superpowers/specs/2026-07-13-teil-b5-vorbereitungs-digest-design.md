# Design: Teil-B5 — Vorbereitungs-/Einkaufs-Digest

- **Datum:** 2026-07-13
- **Status:** genehmigt (User-Freigabe des Designs)
- **Kontext:** Erweiterung von Teil-B3 (täglicher WhatsApp-Digest via `daily-digest`-Edge-Function + CallMeBot). Kein Chatbot/keine KI — ein **zweiter Nachrichtentyp** für den Betreiber: eine Einkaufs-/Vorbereitungsliste für den nächsten Öffnungstag.

## Ziel

Der Betreiber bekommt am **Vorabend jedes Öffnungstags um 18 Uhr** (im selben Lauf wie der bestehende Tages-Digest) eine WhatsApp mit **allem, was für morgen einzukaufen/vorzubereiten ist**: je Zutat und je Soße die Anzahl der Pizzen, die sie brauchen, plus die Gesamt-Teiganzahl. So weiß er, was er kaufen und wie viele Teige er machen muss.

## Abgrenzung / Nicht-Ziele

- Der bestehende Tages-Digest (heutige Abholungen) **bleibt unverändert**; die Vorbereitungsliste kommt **zusätzlich**.
- Kein Chatbot, keine KI, kein Freitext-Dialog. Nur eine generierte Nachricht.
- Keine Gramm-/Mengeneinheiten — die App kennt nur *welche* Zutat pro Pizza, nicht wie viel. „12× Salami" heißt: 12 Pizzen enthalten Salami.
- Keine konfigurierbare Uhrzeit/Vorlauf (fest: Vorabend, 18 Uhr) — YAGNI.

## Umgebungs-Realität

Wie B1–B4: **Umgebung erreicht Supabase/CallMeBot NICHT.** Verifiziert wird nur `bun run build` + `bun test src` (reine Logik). Migration + Edge-Function-Änderung schreibt/testet der Betreiber real.

## Architektur

Wiederverwendung der B3-Mechanik: `pg_cron` triggert stündlich `daily-digest`; der 18-Uhr-Gate (Europe/Berlin, DST-sicher) steht schon. Im selben 18-Uhr-Lauf kommt **nach** dem Tages-Digest ein zweiter Block:

1. `tomorrowIso` = morgen (Berlin) berechnen.
2. Idempotenz: wenn `notify_config.last_prep_date = tomorrowIso` → Vorbereitungsblock überspringen.
3. `orders` mit `pickup_date = tomorrowIso` laden.
4. **0 Bestellungen → nichts senden** (nichts vorzubereiten); `last_prep_date` **nicht** setzen (spätere Bestellung bei Vorlauf 1 könnte noch kommen — siehe Randfälle).
5. `ingredients` (id→name) und `sauces` (id→name) laden.
6. Aggregieren + formatieren (reine Funktion `formatPrepList`) → zweite CallMeBot-Nachricht.
7. Bei Erfolg `last_prep_date = tomorrowIso` setzen; bei CallMeBot-/DB-Fehler nicht (Retry im nächsten stündlichen Lauf bis 18:59).

**Kein `app_config`-Zugriff nötig:** der `validate_order`-Trigger (B4) lässt Bestellungen nur an offenen Tagen zu. Gibt es Bestellungen für morgen, ist morgen offen. „Morgen hat Bestellungen" genügt als Auslöser.

## Reine Logik (`Frontend/src/lib/digest.ts`, getestet)

Neue, von `DigestOrder` unabhängige Typen + Funktion (die Prep-Aggregation braucht `ingredientIds`/`sauceId`, die im vollständigen `orders.items`-`CartItem[]` liegen):

```ts
export interface PrepItem { ingredientIds: string[]; sauceId?: string }
export interface PrepOrder { items: PrepItem[] }

export function formatPrepList(
  orders: PrepOrder[],
  ingredientNames: Record<string, string>,
  sauceNames: Record<string, string>,
  dateLabel: string,
): string
```

- Leeres `orders` → `""` (Signal „nicht senden").
- `doughCount` = Summe aller `items.length` über alle Bestellungen (eine Pizza = ein Teig).
- Zutaten: über alle Items jede `ingredientId` zählen; Soßen: jede gesetzte `sauceId` zählen.
- Sortierung je Liste: **Anzahl absteigend, dann Name aufsteigend** (deterministisch).
- Namensauflösung über die Maps; unbekannte id → Fallback auf die id selbst.
- Zutaten- bzw. Soßen-Abschnitt nur ausgeben, wenn er Einträge hat.

Die Edge Function spiegelt `formatPrepList` als Deno-Copy (wie schon `formatDigest`); getestet wird die TS-Quelle.

## Nachrichtenformat

```
🧾 Einkauf/Vorbereitung für morgen, Fr 13.07.
15 Pizzen (= 15 Teige)

Zutaten:
  12× Salami
  8× Champignons
  5× Paprika

Soßen:
  10× Tomate
  5× BBQ
```

- Kopf: 🧾 + „für morgen, {dateLabel}"; Zeile mit Pizzen-/Teiganzahl (Einzahl „1 Pizza (= 1 Teig)").
- `Zutaten:` / `Soßen:` je als Abschnitt mit `  {Anzahl}× {Name}` (nur wenn nicht leer).

## Datenmodell

Migration `supabase/migrations/0008_prep_digest.sql`:
```sql
alter table public.notify_config add column if not exists last_prep_date date;
```
Ein zweiter, von `last_digest_date` unabhängiger Merker. Sonst keine Schema-Änderung (Zutaten/Soßen/Orders existieren).

## Randfälle

- **0 Bestellungen für morgen** → keine Nachricht; Merker bleibt ungesetzt.
- **Vorlaufzeit = 1 Tag:** morgen-Bestellungen können noch heute nach 18 Uhr eintreffen → die 18-Uhr-Liste kann späte Bestellungen verpassen. Bei Vorlauf ≥ 2 immer vollständig (Betreiber hat 2 Tage). Dokumentiert, kein Fix.
- **Pizza ohne Zutaten/ohne Soße** → zählt trotzdem als Teig; leere Abschnitte werden weggelassen.
- **Doppel-Trigger:** `last_prep_date`-Gate verhindert zweiten Versand.
- **CallMeBot-/DB-Fehler:** `last_prep_date` nicht setzen → Retry im nächsten Lauf.

## Tests & Verifikation

- **bun:test** (`Frontend/src/lib/__tests__/digest.test.ts`, ergänzt): `formatPrepList` — Aggregation/Zählung, Sortierung (Menge desc, Name asc), Namensauflösung + Fallback, Einzahl/Mehrzahl, leere Abschnitte, leeres Array → `""`.
- **`bun run build`** grün.
- **Edge Function + Migration:** hier nicht ausführbar → Betreiber testet real (Bestellung für morgen anlegen → 18-Uhr-Lauf → zweite WhatsApp).

## Betroffene Dateien

**Neu:** `supabase/migrations/0008_prep_digest.sql`.
**Geändert:** `Frontend/src/lib/digest.ts` (+`formatPrepList`/Typen), `Frontend/src/lib/__tests__/digest.test.ts` (+Tests), `supabase/functions/daily-digest/index.ts` (zweiter Block + Deno-Copy von `formatPrepList` + Namens-Queries), Doku (Changelog/README/SETUP/ADR-0003-Hinweis) — Doku am Ende gebündelt.

## Definition of Done

- `formatPrepList` + Tests grün; Migration 0008 vorhanden; Edge Function sendet im 18-Uhr-Lauf zusätzlich die Vorbereitungsliste für morgen (falls Bestellungen), idempotent über `last_prep_date`; `bun run build` + Tests grün.
- Nach Betreiber-Setup: am Vorabend eines Öffnungstags mit Bestellungen kommt eine zweite WhatsApp mit Zutaten-/Soßen-Anzahl + Teiganzahl.
- Doku aktualisiert.
