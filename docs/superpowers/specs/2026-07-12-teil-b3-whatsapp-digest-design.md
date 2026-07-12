# Design: Teil-B3 — Täglicher WhatsApp-Bestell-Digest

- **Datum:** 2026-07-12
- **Status:** genehmigt (User-Freigabe des Designs)
- **Kontext:** Sub-Projekt von Teil-B, baut auf B1/B2/B4 (Supabase `orders`). Statt einer Push-Nachricht pro Bestellung (ursprünglich ADR-0003) erhält der Betreiber **einmal täglich ~18 Uhr** eine WhatsApp mit allen Bestellungen, die **heute abgeholt** werden. Versand via CallMeBot (HTTP-GET → WhatsApp).

## Ziel

Der Betreiber bekommt 18 Uhr (Europe/Berlin) eine kompakte WhatsApp mit allen heutigen Abholungen (Name, Telefon, Abholzeit, Pizzen, Summe), sortiert nach Uhrzeit. Empfänger + CallMeBot-Key sind **in der Admin-Seite** editierbar; der Digest lässt sich dort an/aus schalten.

## Nicht-Ziele

- Keine Push-Nachricht pro Bestellung mehr (ADR-0003 wird umgeschrieben).
- Keine konfigurierbare Uhrzeit (18 Uhr fest) und keine Mehrfach-Empfänger — YAGNI.
- Keine Änderung an Bestell-Flow, Preis- oder Slot-Logik (B4).

## Umgebungs-Realität

**Umgebung erreicht Supabase/CallMeBot NICHT.** Verifiziert wird nur `bun run build` (Typecheck) + `bun test src` (reine Logik). Edge Function, Migration und `pg_cron`-Job werden geschrieben, **nicht ausgeführt** — der Betreiber spielt sie ein und testet real. CallMeBot-Registrierung (Nummer → API-Key) ist Betreiber-Aufgabe; danach trägt er Nummer + Key in der Admin-Maske ein (kein Env-Secret).

## Architektur

`pg_cron` triggert **stündlich** (`0 * * * *`, UTC) die Edge Function `daily-digest` (Deno/TS). pg_cron läuft in UTC; wegen Sommer-/Winterzeit entspricht „18 Uhr Berlin" mal 16:00, mal 17:00 UTC — deshalb kein fester UTC-Zeitpunkt, sondern ein **Stunden-Gate in der Function**:

1. `notify_config` (per `service_role`, RLS-frei) lesen. Wenn `enabled = false` oder `recipient_phone`/`callmebot_apikey` leer → beenden.
2. Berlin-Zeit bestimmen. Wenn Stunde ≠ 18 → beenden (no-op, ~23×/Tag).
3. Wenn `last_digest_date = heute` (Berlin) → beenden (Idempotenz gegen Doppelversand).
4. `orders` mit `pickup_date = heute` (Berlin) laden, nach `pickup_time` sortiert.
5. Wenn 0 Bestellungen → **nichts senden**, aber `last_digest_date` trotzdem setzen (kein erneuter Versuch).
6. Nachricht via reiner Funktion `formatDigest(orders, date)` bauen → CallMeBot-GET → bei Erfolg `last_digest_date = heute` setzen.

Die **reine Formatier-/Filter-Logik liegt in TS** (`Frontend/src/lib/digest.ts`) und ist hier mit bun:test testbar. Die Edge Function importiert dieselbe Logik bzw. spiegelt sie (Deno) — getestet wird die TS-Quelle.

## Datenmodell

### Migration `supabase/migrations/0006_digest.sql`

**1. Kundendaten in `orders`** (bisher nicht gespeichert):
```
alter table public.orders add column customer_name  text not null default '';
alter table public.orders add column customer_phone text not null default '';
```
> Default `''` hält bestehende Zeilen gültig; neue Bestellungen füllen die Felder (Checkout hat Name/Telefon bereits). Der B4-Trigger `validate_order` bleibt unberührt (fasst diese Spalten nicht an).

**2. `notify_config` (Admin-only, Single-Row):**
```
create table public.notify_config (
  id int primary key default 1 check (id = 1),
  recipient_phone   text not null default '',
  callmebot_apikey  text not null default '',
  enabled           boolean not null default false,
  last_digest_date  date
);
insert into public.notify_config (id) values (1) on conflict do nothing;
alter table public.notify_config enable row level security;
create policy notify_admin_all on public.notify_config
  for all using (public.is_admin()) with check (public.is_admin());
```
> **Kein** öffentliches Lesen — sonst läge der API-Key für jeden Client offen. Nur Admins (`is_admin()`, aus B1) lesen/schreiben; die Edge Function nutzt `service_role` und umgeht RLS.

### pg_cron (Betreiber, in SETUP dokumentiert)
```
select cron.schedule('daily-digest-hourly', '0 * * * *', $$
  select net.http_post(
    url := '<PROJECT>.functions.supabase.co/daily-digest',
    headers := jsonb_build_object('Authorization', 'Bearer <SERVICE_ROLE_KEY>')
  );
$$);
```
> Benötigt Extensions `pg_cron` + `pg_net`. Der Stunden-Gate in der Function macht das stündliche Feuern unschädlich.

## Client-Änderungen (`Frontend/`)

- **`lib/data/store.ts` `createOrder`:** Insert um `customer_name: input.customer.firstName + " " + input.customer.lastName`, `customer_phone: input.customer.phone` erweitern. `NewOrder`/`OrderData` tragen `customer` bereits.
- **`lib/digest.ts` (neu):** reine Funktionen
  - `filterTodaysPickups(orders, todayIso)` → nur `pickup_date === todayIso`, sortiert nach `pickup_time`.
  - `formatDigest(orders, dateLabel)` → deutscher Nachrichtentext (siehe Format). Leeres Array → `""` (Signal „nicht senden").
- **Admin-Seite (neu: Abschnitt „Benachrichtigungen"):** Formular mit Empfänger-Nummer, CallMeBot-API-Key, An/Aus-Schalter; Speichern über neue Store-Funktionen `getNotifyConfig()` / `saveNotifyConfig({recipientPhone, callmebotApikey, enabled})` (nur für Admins nutzbar; RLS erzwingt es serverseitig). Der API-Key wird im Feld angezeigt (Admins sind vertrauenswürdig) und beim Speichern überschrieben.

## Nachrichtenformat

```
🍕 Abholungen heute, So 12.07.
3 Bestellungen · gesamt 90 €

17:30 · Max Mustermann · +49 170 1234567
  2 Pizzen · 20 € · Abholen
  • Margherita
  • Salami

18:00 · Lisa Meyer · +49 151 2345678
  1 Pizza · 10 € · Vor Ort
  • Funghi
  Notiz: extra scharf
```
- Kopf: Wochentag + Datum, Anzahl Bestellungen, Summe der `total`.
- Pro Bestellung: `pickup_time` · Name · Telefon; Zeile mit Pizza-Anzahl · `total` · Service-Modus („Abholen"/„Vor Ort"); Pizzennamen als Liste; `Notiz:` nur wenn vorhanden.

## Fehler-/Randfälle

- **0 Bestellungen:** kein Versand; `last_digest_date` wird gesetzt.
- **Kein Empfänger / disabled:** kein Versand.
- **Doppel-Trigger:** `last_digest_date`-Gate verhindert zweiten Versand am selben Tag.
- **CallMeBot-Fehler (HTTP ≠ 200):** `last_digest_date` **nicht** setzen → nächster stündlicher Lauf versucht es erneut (bis der 18-Uhr-Gate endet). Fehler wird geloggt.
- **DST:** Stunden-Gate in Berlin-Zeit → korrekt über Sommer-/Winterzeit.

## Tests & Verifikation

- **bun:test** (`Frontend/src/lib/__tests__/digest.test.ts`): `filterTodaysPickups` (Datum-Filter + Sortierung), `formatDigest` (Kopf, Summe, Service-Label, Notiz-Anhang, Einzahl/Mehrzahl „Pizza/Pizzen", leeres Array → `""`).
- **`bun run build`** grün (Store-/Admin-Änderungen typcheck-clean).
- **Edge Function + Migration + pg_cron:** hier nicht ausführbar → **Betreiber testet real** (Testbestellung mit `pickup_date` heute → 18-Uhr-Lauf → WhatsApp kommt an).

## Betroffene Dateien

**Neu:** `supabase/migrations/0006_digest.sql`, `supabase/functions/daily-digest/index.ts`, `Frontend/src/lib/digest.ts`, `Frontend/src/lib/__tests__/digest.test.ts`, Admin-Benachrichtigungs-Abschnitt (Seite/Komponente).
**Geändert:** `Frontend/src/lib/data/store.ts` (Insert + notify-config-Funktionen + Typen), Admin-Bestell-/Einstellungsseite, `Doku/Pizza/SETUP-Supabase.md` (Migration 0006, Extensions, cron.schedule), `Doku/Pizza/Entscheidungen/ADR-0003-whatsapp-callmebot.md` (per-Bestellung → Digest), Changelog/README/TODO.

## Definition of Done

- Migration 0006 (orders-Spalten + `notify_config` + RLS) vorhanden; Edge Function `daily-digest` geschrieben; `formatDigest`/`filterTodaysPickups` getestet; Admin-Maske für Empfänger + Key + An/Aus; `bun run build` + Tests grün.
- Nach Betreiber-Setup (Extensions, cron.schedule, CallMeBot-Key in Admin-Maske): 18 Uhr Berlin kommt genau eine WhatsApp mit den heutigen Abholungen; kein Versand bei 0 Bestellungen; Empfänger in der Admin-Seite änderbar.
- ADR-0003 auf Digest umgeschrieben; Doku aktualisiert.
