# ADR-0007 — Öffentlicher Bestell-Status über nicht-ratbaren Token

- **Status:** akzeptiert
- **Datum:** 2026-07-13

## Problem

Der QR-Code soll eine ohne Login erreichbare Status-Seite öffnen. `orders.id` ist `text` und
ratbar; RLS lässt Bestellungen nur Eigentümer/Admin lesen. Ein öffentlicher Zugriff darf weder
über die ID adressierbar sein noch personenbezogene Felder (Name/Telefon) preisgeben.

## Mögliche Lösungen

1. Postgres-RPC (SECURITY DEFINER) mit `public_token uuid`, feld-begrenzte Rückgabe.
2. Edge Function als öffentlicher Endpunkt (service_role) mit eigener Filter-/CORS-Logik.

## Entscheidung

Option 1: `public_token uuid` (128 bit, nicht ratbar) + RPC `get_order_status`, für `anon`
ausführbar, gibt nur Whitelist-Felder + eine `labels`-Map zurück.

## Begründung

Passt zum bestehenden Muster (`is_admin`, `validate_order`), minimaler Code, kein zweiter
Deploy-Pfad. Der UUID-Token ist nicht bruteforcebar → Rate-Limiting unnötig.

## Vor- und Nachteile

- ➕ Schlank, RLS bleibt unangetastet, keine Menü-Öffnung für `anon` (Namen via RPC-`labels`).
- ➕ Nur Whitelist-Felder verlassen die DB (kein Name/Telefon/notes/voucher/user_id).
- ➖ Rate-Limiting nur über Supabase-Defaults (bei UUID-Token praktisch irrelevant).

## Auswirkungen

Migration `0010_public_token.sql` (Spalte + RPC + Grants); Betreiber führt sie via
`bunx supabase db push` aus. Frontend: neue öffentliche Route `/bestellung/:token`.

## Alternativen

Edge Function verworfen: Mehraufwand (zweiter Deploy, eigene CORS/Fehlerbehandlung) ohne
Sicherheitsgewinn bei unratbarem Token.
