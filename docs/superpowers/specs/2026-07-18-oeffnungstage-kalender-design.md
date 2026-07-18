# Öffnungstage per Kalender (statt Wochentags-Muster) — Design

**Datum:** 2026-07-18
**Status:** Entwurf, vom Nutzer freigegeben

## Ziel

Der Betrieb ist **unregelmäßig** — nicht „jeden Freitag", sondern einzelne, geplante Tage. Das heutige
Modell (Wochentags-Muster `app_config.days`: Montag–Sonntag je an/aus) passt dazu nicht. Künftig plant der
Admin **konkrete Kalendertage** und pflegt rollend die nächsten Wochen. Ein Tag ist buchbar, weil der Admin
ihn angelegt hat — sonst nicht.

## Entscheidungen (mit Begründung)

| Frage | Entscheidung | Warum |
|---|---|---|
| Planungsmodell | **Nur konkrete Tage**, kein Wochentags-Muster | Unregelmäßiger Betrieb; kein „jeden Fr außer diesem"-Kopfrechnen |
| Uhrzeiten | **global** (eine Spanne für alle offenen Tage, wie heute) | Zeiten variieren nicht je Tag; kleinstes Modell |
| Reichweite | **kein künstliches Limit** — Kunden sehen alle geplanten Tage | Der Admin steuert die Reichweite allein über das, was er anlegt |
| Speicherung | **eigene Tabelle `open_days`** | Passt zum Projektmuster (Zutaten/Soßen/Sonderartikel sind Tabellen); saubere Queries/RLS; leicht erweiterbar |
| Umstellung | `open_days` startet **leer** | Admin plant nach dem Deploy zuerst seine Tage; kein Vorbefüllen (YAGNI) |

**Unverändert:** Vorlaufzeit (`app_config.lead_time_days`), Uhrzeit-Fenster (`app_config.hours`),
Service-Modus (`app_config.service`). Reine Sonderartikel-Bestellungen umgehen den Slot-Block weiterhin
(Sofort-Bestellung aus `0013` bleibt heil).

## Datenmodell

Neue Tabelle:
```sql
create table if not exists public.open_days (
  date       date primary key,
  created_at timestamptz not null default now()
);
```

RLS — **abweichend** von Sonderartikeln, weil Kunden lesen müssen (sie sehen die buchbaren Tage):
- `select`: für alle (`anon`, `authenticated`) erlaubt.
- `insert`/`delete`: nur `public.is_admin()`.

Der Wochentags-Block `app_config.days` wird aus dem Ablauf genommen. Die Spalte bleibt vorerst liegen
(ungenutzt) — kein Zwang, sie zu droppen, kein Risiko.

## Server (Migration `0017`)

1. `open_days` anlegen (Tabelle, RLS, Grants — Muster wie `0012`).
2. `validate_order` per `create or replace` ersetzen. Einzige Änderung gegenüber der Fassung aus `0016`:
   Im Slot-Block (der nur bei `pizza_qty > 0` läuft) entfällt die Wochentags-Prüfung
   (`dayname` / `cfg.days ->> dayname`) und wird ersetzt durch:
   ```sql
   if not exists (select 1 from public.open_days od where od.date = new.pickup_date::date) then
     raise exception 'Tag nicht geöffnet';
   end if;
   ```
   **Alles andere bleibt Zeichen für Zeichen gleich:** Preis/Grant/Voucher, Vorlaufzeit-Prüfung,
   Uhrzeit-Fenster, Service-Modus-Whitelist + -Verfügbarkeit, der `pizza_qty = 0`-Bypass.
   Der `cfg`-`select` aus `app_config` bleibt (Vorlaufzeit/Uhrzeit/Service kommen weiter von dort);
   nur `cfg.days` wird nicht mehr gelesen.

## Frontend

- **`lib/slots.ts` — `getSelectableDates`:** neue Signatur, liest offene Tage statt Wochentage.
  `getSelectableDates(openDates: string[], leadTimeDays: number, today: Date): string[]` — behält nur
  Tage `≥ today + leadTimeDays`, sortiert aufsteigend, dedupliziert. `JS_DAY_MAP`/`DAYS_OF_WEEK` werden
  hier nicht mehr gebraucht (bleiben für andere Nutzer der Datei erhalten, falls vorhanden — sonst
  entfernen). `isSlotAllowed` wird analog auf die offenen Tage umgestellt.
- **Store (`lib/data/store.ts`):**
  - `getOpenDays(): Promise<string[]>` — alle `open_days.date` als ISO-Strings, aufsteigend.
  - `addOpenDay(date: string): Promise<void>` — `upsert` (idempotent).
  - `removeOpenDay(date: string): Promise<void>` — `delete` per PK.
- **Admin `/admin/tage` (Bestelltage):** Die 7 Wochentags-Häkchen weichen einem **Kalender-Raster**.
  - Rollend ab dem Montag der aktuellen Woche, Standard **4 Wochen** sichtbar (28 Tage-Buttons in
    Wochenzeilen; optional „weitere Wochen"-Button). Vergangene Tage ausgegraut/deaktiviert.
  - Jeder Tag ein Button; offen = markiert (Marken-Akzent), zu = neutral. Klick toggelt via
    `addOpenDay`/`removeOpenDay` und lädt neu (bestehendes `useAsync`-Reload-Muster).
  - Reiner Helfer `calendarGrid(today: Date, weeks: number): string[][]` (Wochenzeilen aus ISO-Tagen)
    — testbar, kein Datepicker-Paket nötig, reines Tailwind-Grid.
- **Checkout (`checkout-page.tsx`):** Aufbau unverändert. Statt `getSelectableDates(config, now)` jetzt
  `getSelectableDates(await getOpenDays(), config.leadTimeDays, now)`. Die Datums-Auswahl, der Leerzustand
  „keine Bestelltage verfügbar" und alles andere bleiben.
- **Typen:** `AppConfig.days` wird im Frontend nicht mehr gelesen; das Feld darf bleiben (rückwärts­
  kompatibel) oder aus dem Typ entfernt werden, sobald keine Referenz mehr existiert.

## Datenfluss

```
Admin klickt Tag im Kalender ──▶ addOpenDay / removeOpenDay ──▶ open_days
Kunde im Checkout ──▶ getOpenDays() + config ──▶ getSelectableDates ──▶ Datums-Dropdown
Bestellung INSERT ──▶ validate_order prüft date ∈ open_days (serverautoritativ)
```

## Fehlerfälle

| Fall | Verhalten |
|---|---|
| Keine Tage geplant | `getSelectableDates` leer → bestehender Leerzustand „keine Bestelltage verfügbar" |
| Manipuliertes/geschlossenes Datum im INSERT | `validate_order` wirft „Tag nicht geöffnet" → Checkout zeigt saubere Meldung |
| Vergangener Tag im Kalender | im Admin-Raster deaktiviert; serverseitig zusätzlich durch die Vorlaufzeit-Prüfung abgefangen |
| Tag offen, aber < Vorlaufzeit | Admin darf ihn planen; Kunde sieht ihn erst, wenn er die Vorlaufzeit erfüllt (Filter in `getSelectableDates` + Server-Prüfung) |

## Tests

- **`getSelectableDates`** (`bun:test`): filtert Tage vor `today + leadTimeDays`, behält/sortiert die
  übrigen, leere Eingabe → leer.
- **`calendarGrid`** (`bun:test`): erzeugt die richtigen Wochenzeilen ab Wochenanfang für N Wochen.
- **`validate_order`-Änderung:** SQL hier nicht ausführbar → sorgfältiges Review + Smoke-Test des
  Betreibers.

## Betreiber-Schritte (nach Merge)

1. `bunx supabase db push` — spielt `0017` ein (`open_days`, neuer `validate_order`).
2. Frontend-Deploy (Vercel Auto-Deploy auf `main`).
3. Admin öffnet `/admin/tage` und plant die ersten Tage — vorher ist nichts buchbar.
4. Smoke-Test: einen Tag anlegen → als Kunde erscheint er (sofern ≥ Vorlaufzeit) im Checkout; einen
   nicht angelegten Tag kann man nicht bestellen (Server lehnt ab).

## Nicht Teil dieses Entwurfs (YAGNI)

- Pro-Tag abweichende Uhrzeiten oder Kapazitäten (globale Uhrzeit bleibt).
- Vorbefüllen von `open_days` aus dem alten Wochentags-Muster.
- Serienplanung („die nächsten 4 Freitage auf einmal") — kann später als Komfort ergänzt werden.
