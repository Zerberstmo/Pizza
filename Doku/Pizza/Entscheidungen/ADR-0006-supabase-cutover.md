# ADR-0006 — Cutover Teil-A-Mocks → Supabase (Teil-B1)

- **Status:** akzeptiert
- **Datum:** 2026-07-12

## Problem

Teil-A lief vollständig auf Mock-Datenschichten: `lib/data/store.ts` (localStorage, async Naht,
siehe ADR-0002) für Domänendaten/Bestellungen und `lib/auth.ts`/`hooks/use-auth.tsx`
(localStorage, Klartext-Passwörter, siehe ADR-0005) für Nutzer-Accounts. Teil-B1 sollte diese
Mocks durch ein echtes Supabase-Backend ersetzen: Postgres-Schema mit RLS, echte Auth mit
gehashten Passwörtern, und eine sichere Admin-Nutzerverwaltung (Anlegen/Löschen/Reset benötigen
erhöhte Rechte, die nicht im Client liegen dürfen).

## Mögliche Lösungen

1. **supabase-js hinter der bestehenden Naht** — `store.ts` und die Auth-Schicht werden auf
   `@supabase/supabase-js` umgestellt (Postgres + Auth + RLS), erhöhte Admin-Rechte kapselt eine
   einzelne Edge Function (`admin-users`) mit `service_role`-Key.
2. **Eigenes Backend-API** — separates Node/Express-Backend, das eigene Endpunkte für
   Domänendaten, Auth und Admin-Aktionen bereitstellt; Frontend spricht nur mit diesem API.
3. **Weiter mocken** — Teil-A-Mocks (localStorage) vorerst beibehalten, Backend-Anbindung auf
   einen späteren Zeitpunkt verschieben.

## Entscheidung

Option 1: **supabase-js hinter der bestehenden Naht + RLS + eine Edge Function.** `store.ts`
liest/schreibt Domänendaten und Bestellungen direkt über Supabase-Postgres (RLS-abgesichert);
Auth läuft über Supabase Auth (E-Mail/Passwort, gehashte Passwörter, Sessions); Admin-Aktionen mit
erhöhten Rechten (Nutzer anlegen/löschen/Passwort zurücksetzen) laufen über die einzige Edge
Function `admin-users`, die serverseitig mit dem `service_role`-Key arbeitet.

## Begründung

Die Naht aus ADR-0002/ADR-0005 zahlt sich hier aus: `store.ts` war von Anfang an als austauschbare
async Schicht entworfen, die UI musste dafür nicht angefasst werden. Supabase liefert Postgres,
Auth und RLS ohne eigenes Server-Setup — minimaler Neucode ist nötig (Client + Env, drei
Migrationen, eine Edge Function, Auth-Cutover). Ein eigenes Backend (Option 2) hätte denselben
Funktionsumfang mit deutlich mehr Betriebsaufwand (Hosting, Deployment, eigene Auth-Implementierung)
erfordert, ohne einen erkennbaren Vorteil gegenüber Supabase + RLS zu bieten. Weiter mocken
(Option 3) hätte die in ADR-0002/ADR-0005 dokumentierte Klartext-Passwort-Grenze unnötig
verlängert.

## Vor- und Nachteile

- ➕ Naht (`store.ts`, Auth-Hook/-Seiten) blieb strukturell erhalten — UI unverändert wiederverwendet.
- ➕ Minimaler Neucode: Client + Env, drei SQL-Migrationen, eine Edge Function, Auth-Cutover.
- ➕ RLS + `handle_new_user` (erzwingt `role='customer'`) + `protect_profile_columns`-Trigger
  verhindern Selbst-Eskalation serverseitig, nicht nur im Client.
- ➖ **In dieser Entwicklungsumgebung nicht testbar** — kein Netzwerkzugriff auf Supabase; hier
  wurde ausschließlich Build/Typecheck/reine Logik-Tests verifiziert, siehe
  [SETUP-Supabase.md](../SETUP-Supabase.md).
- ➖ Preis-/Vorlaufzeit-Validierung ist weiterhin **client-seitig** — serverseitige Härtung folgt
  erst in Teil-B4.
- ➖ Auth wurde von Benutzername (Teil-A-Mock) auf **E-Mail** umgestellt (Supabase-Auth-Standard) —
  betrifft Login-, Profil- und Admin-Nutzerverwaltungsseiten sowie den Start-Admin „Mo".

## Auswirkungen

- `Frontend/src/lib/supabase.ts` (Client), `Frontend/.env.example`/`.env.local` (Keys).
- `supabase/migrations/0001_schema_rls.sql`, `0002_seed.sql`, `0003_profiles_email.sql`.
- `supabase/functions/admin-users` (Edge Function, service_role, create/delete/reset).
- `Frontend/src/lib/data/store.ts` liest Domänendaten + Bestellungen jetzt aus Supabase.
- `Frontend/src/hooks/use-auth.tsx`, `pages/login`, `pages/profile`, `pages/admin/users-page.tsx`,
  neue Passwort-Reset-Seite — auf Supabase Auth (E-Mail-basiert) umgestellt; der localStorage-Mock
  aus ADR-0005 (inkl. Klartext-Passwörter) wurde vollständig entfernt.
- Teil-B2–B4 (Bestell-Status/Realtime, WhatsApp via CallMeBot, serverseitige Vorlauf-/
  Preis-Validierung) folgen auf dieser Grundlage, siehe [TODO.md](../TODO.md).

## Alternativen

Option 2 (eigenes Backend) verworfen — höherer Betriebsaufwand ohne Vorteil gegenüber
Supabase + RLS. Option 3 (weiter mocken) verworfen — hätte die dokumentierte
Klartext-Passwort-Grenze aus ADR-0005 unnötig verlängert und keinen echten Fortschritt Richtung
Produktivbetrieb gebracht.
