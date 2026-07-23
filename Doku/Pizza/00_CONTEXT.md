# 00_CONTEXT — Pizza-Projekt

> Zentraler Einstiegspunkt und **Nabe des Vaults**. Von hier führen Links in alle Bereiche;
> jede Bereichsseite verlinkt wieder hierher zurück (so entsteht der Graph).

## Was ist das?

Bestell-PWA für eine Pizzeria: Kunden stellen ihre Pizza im Konfigurator zusammen oder wählen von
der Speisekarte, legen sie in den Warenkorb und bestellen mit Abholzeit; der Betreiber verwaltet
Menü, Öffnungstage, Gutscheine und Bestellungen im Admin-Bereich und wird per WhatsApp-Digest über
die Bestellungen des Tages informiert.

## Warum existiert es?

Eine kleine Pizzeria soll Online-Bestellungen annehmen können, ohne Fremdplattform und deren
Gebühren — mit direktem Draht zum Betreiber (WhatsApp) und der Option, die App später als native
iOS-/Android-App auszuliefern (siehe [[ADR-0001-mobile-capacitor|ADR-0001 Capacitor]]).

## Technischer Überblick

- **Frontend:** `../../Frontend/` (Vite + React + TypeScript, Tailwind + shadcn) — siehe [[Frontend/README|Frontend-Doku]]
- **Backend:** `../../Backend/` (Supabase: Postgres + RLS, Auth, Edge Functions) — siehe [[Backend/README|Backend-Doku]] · [[Datenbank/README|Datenbank-Doku]] · [[API/README|API-Doku]]
- **Vorlage:** `../../Frontend vorlage/` (Figma-Make-Export)
- **Defaults & Konventionen:** [[SETUP|SETUP — Projekt-Defaults]]

## Dokumentations-Navigation

- [[SETUP]] — **Projekt-Defaults**: Stack, Werkzeuge, Konventionen (Single Source of Truth)
- [[SETUP-Supabase]] — Betreiber-Anleitung für das echte Supabase-Backend
- [[Changelog]] — chronologische Änderungen (neueste zuerst)
- [[TODO]] — offene Aufgaben (P0–P3)
- [[Entscheidungen/README|Architekturentscheidungen (ADRs)]] — warum die Dinge so sind
- [[Architektur/README|Architektur]] · [[Testing/README|Testing]]
- Session-Kosten: [[Session-Log]] · Vorlagen: [[Templates/_feature|Templates]]

## Features

- [[Sonderartikel-VIP|Sonderartikel/VIP]] — versteckte Menü-Items pro Kunde per Code
- [[Status-Angenommen-Storno|Status „angenommen" + Kunden-Storno]]
- [[qr-bestell-status|Scanbarer QR → öffentliche Bestell-Status-Seite]]

## Abhängigkeiten

- **Supabase** (Postgres, Auth, RLS, Edge Functions, `pg_cron`/`pg_net`) — Kern des Backends
- **CallMeBot** (WhatsApp-Digest an den Betreiber) — siehe [[ADR-0003-whatsapp-callmebot|ADR-0003]]
- **Vercel** (Frontend-Hosting, Auto-Deploy auf `main`)

## Offene Punkte

Die aktuellen offenen Aufgaben stehen in [[TODO]] (u. a. Kunden-Desktop-Layout, Telefon-Validierung
im Checkout, Teil-C Capacitor).
