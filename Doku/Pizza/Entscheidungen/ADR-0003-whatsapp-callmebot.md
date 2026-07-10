# ADR-0003 — WhatsApp-Benachrichtigung via CallMeBot

- **Status:** akzeptiert
- **Datum:** 2026-07-09

## Problem

Bei neuer Bestellung soll die Pizzeria zeitnah per WhatsApp benachrichtigt werden — ohne
kostenpflichtige WhatsApp-Business-API oder komplexe Meta-Registrierung.

## Mögliche Lösungen

1. CallMeBot (einfache HTTP-API → WhatsApp)
2. WhatsApp Business Cloud API (Meta)
3. SMS-Gateway (Twilio o. ä.)

## Entscheidung

CallMeBot (Teil-B), aufgerufen aus einer Supabase Edge Function beim Bestell-Insert.

## Begründung

Minimaler Integrationsaufwand: ein HTTP-GET mit Telefonnummer + API-Key genügt. Für ein kleines
Pizzeria-Szenario ausreichend; keine Meta-Verifizierung, keine laufenden API-Kosten.

## Vor- und Nachteile

- ➕ Sehr einfache Integration (ein HTTP-Call)
- ➕ Keine Meta-Business-Verifizierung nötig
- ➖ Abhängigkeit von Drittanbieter-Zuverlässigkeit; nicht für hohes Volumen ausgelegt

## Auswirkungen

Teil-B: Edge Function beim Bestell-Insert ruft CallMeBot; API-Key als Secret. Kein Frontend-Impact.

## Alternativen

WhatsApp Cloud API verworfen (Registrierungs-/Wartungsaufwand). SMS/Twilio verworfen (Kosten, kein WhatsApp).
