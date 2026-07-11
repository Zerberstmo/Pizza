# ADR-0002 — Backend via Supabase

- **Status:** akzeptiert
- **Datum:** 2026-07-09

## Problem

Teil-A nutzt eine Mock-Datenschicht (`lib/data/store.ts`, localStorage). Für echten Betrieb
werden persistente Daten, Auth, serverseitige Validierung und Live-Bestellstatus benötigt.

## Mögliche Lösungen

1. Supabase (Postgres, Auth, Realtime, Edge Functions)
2. Eigenes Node/Express-Backend + DB
3. Firebase

## Entscheidung

Supabase (Teil-B).

## Begründung

Die Datenschicht ist bereits als async Naht entworfen: nur `store.ts` wird von localStorage auf
Supabase-Clients umgestellt, die UI bleibt unverändert. Supabase liefert Postgres, Auth, RLS und
Realtime out-of-the-box — passend für Bestellungen, Admin-Auth und Live-Status.

## Vor- und Nachteile

- ➕ Postgres + Auth + Realtime + RLS ohne eigenes Server-Setup
- ➕ Nahtloser Austausch dank vorbereiteter `store.ts`-Signaturen
- ➖ Anbieter-Bindung; RLS-Policies müssen sorgfältig entworfen werden

## Auswirkungen

Teil-B: Schema/Migrationen, echte Supabase-Auth (ersetzt den `localStorage`-Nutzer-Mock aus
[ADR-0005](ADR-0005-mock-auth-naht.md)), serverseitige Vorlauf-/Preis-Validierung, Bestellstatus + Realtime.

## Alternativen

Eigenes Backend verworfen (Betriebsaufwand). Firebase verworfen (kein SQL/Postgres, schwächere Query-Fähigkeiten).
