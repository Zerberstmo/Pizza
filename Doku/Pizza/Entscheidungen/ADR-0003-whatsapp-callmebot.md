# ADR-0003 — WhatsApp-Benachrichtigung via CallMeBot (Tages-Digest)

- **Status:** akzeptiert
- **Datum:** 2026-07-09 · **überarbeitet:** 2026-07-12 (Teil-B3)

## Problem

Der Betreiber will per WhatsApp über Bestellungen informiert werden — ohne kostenpflichtige
WhatsApp-Business-API oder komplexe Meta-Registrierung.

## Entscheidung

**CallMeBot** (einfache HTTP-API → WhatsApp), aufgerufen aus einer Supabase Edge Function.

**Zustellform (überarbeitet in B3):** **ein Tages-Digest, nicht ein Ping pro Bestellung.** Ein
`pg_cron`-Job triggert stündlich die Edge Function `daily-digest`; diese sendet **einmal um 18 Uhr
(Europe/Berlin, DST-sicherer Stunden-Gate)** eine Sammelnachricht mit allen **heute abzuholenden**
Bestellungen (Name, Telefon, Abholzeit, Pizzen, Summe). Idempotent über
`notify_config.last_digest_date`; bei 0 Bestellungen kein Versand.

> **Ursprünglich** (07-09) war ein Aufruf **beim Bestell-Insert** vorgesehen. Der Betreiber wünschte
> stattdessen eine gebündelte 18-Uhr-Nachricht — geändert beim B3-Design (07-12).

## Begründung

Minimaler Integrationsaufwand: ein HTTP-GET mit Telefonnummer + API-Key genügt. Der Digest reduziert
die Nachrichtenzahl auf eine pro Tag und passt zum Arbeitsablauf der Pizzeria (Abend-Übersicht) statt
Dauer-Pings. Keine Meta-Verifizierung, keine laufenden API-Kosten.

## Umsetzung (B3)

- **Trigger:** `pg_cron` stündlich → Edge Function `daily-digest` (Deno), Stunden-Gate 18 Uhr Berlin.
- **Empfänger/Key/An-Aus:** in der Tabelle `notify_config` (Single-Row, **admin-only RLS** — der
  API-Key ist nicht öffentlich lesbar), editierbar unter `/admin/benachrichtigungen`. Die Edge
  Function liest sie per `service_role`.
- **Formatierung:** reine, getestete Logik `lib/digest.ts` (`formatDigest`/`filterTodaysPickups`);
  die Edge Function spiegelt sie als Deno-Copy (Deno kann den `@/`-Alias-Graphen nicht importieren).
- **Betreiber-Setup:** CallMeBot-Registrierung (Nummer → API-Key), Extensions `pg_cron`/`pg_net`,
  `cron.schedule` — siehe [SETUP-Supabase.md](../SETUP-Supabase.md).

## Vor- und Nachteile

- ➕ Sehr einfache Integration (ein HTTP-Call)
- ➕ Keine Meta-Business-Verifizierung nötig; eine Nachricht/Tag statt Ping-Flut
- ➕ Empfänger in der App wechselbar (kein Redeploy/Secret nötig)
- ➖ Abhängigkeit von Drittanbieter-Zuverlässigkeit; nicht für hohes Volumen ausgelegt
- ➖ CallMeBot signalisiert Fehler evtl. als HTTP 200 mit Fehlertext — der Betreiber sollte den
  Erst-Versand real prüfen

## Alternativen

WhatsApp Cloud API verworfen (Registrierungs-/Wartungsaufwand). SMS/Twilio verworfen (Kosten, kein
WhatsApp). Push pro Bestellung verworfen zugunsten des Tages-Digests (Betreiber-Wunsch).
