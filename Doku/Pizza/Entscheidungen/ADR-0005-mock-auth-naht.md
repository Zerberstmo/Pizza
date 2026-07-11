# ADR-0005 — Nutzer-Accounts als localStorage-Mock (Klartext-Passwörter) — Naht zu Teil-B

- **Status:** akzeptiert
- **Datum:** 2026-07-10

## Problem

Teil-A sollte ein rollenbasiertes Nutzer-Accounts-System bekommen: ein gemeinsames Login für
Kunden und Admin, das je nach Rolle unterschiedliche Bereiche freischaltet, Profil-Selbstbearbeitung
und Admin-Nutzerverwaltung (anlegen/Rolle/aktiv/löschen/Passwort zurücksetzen). Das bisherige
Admin-Login war ein reines Mock-Passwort (`useAdminAuth`/`ADMIN_PASSWORD`, kein Nutzerdatensatz).
Eine echte Auth mit Passwort-Hashing und serverseitiger Durchsetzung gehört laut SETUP/ADR-0002
in Teil-B (Supabase Auth + RLS). Frage: Wie wird das Feature in Teil-A umgesetzt, ohne der
Backend-Migration vorzugreifen oder das Feature auf „nur Vorausfüllen" zu beschränken?

## Mögliche Lösungen

1. **Mock jetzt:** Vollständiges Nutzer-Accounts-System als `localStorage`-Datenschicht
   (`getUsers`/`saveUsers`/`verifyLogin`), analog zur bestehenden Naht `lib/data/store.ts`.
   Passwörter liegen dabei im Klartext im Datensatz.
2. **Supabase vorziehen:** Echte Supabase-Auth (gehashte Passwörter, RLS) bereits in Teil-A
   einführen, obwohl der Rest der Datenschicht noch Mock ist.
3. **Nur Vorausfüllen:** Kein echtes Login/Rollen-System; Checkout-Formular merkt sich lediglich
   zuletzt genutzte Kundendaten (kein Konto, keine Rollen, keine Admin-Nutzerverwaltung).

## Entscheidung

Option 1: **Mock jetzt** — Nutzer-Accounts vollständig als `localStorage`-Mock (`lib/auth.ts`,
`hooks/use-auth.tsx`), inklusive Login-Gate, Profil-Selbstbearbeitung und Admin-Nutzerverwaltung.
Passwörter werden unverschlüsselt im `pizza-users`-Datensatz gespeichert.

## Begründung

Konsistent mit der bestehenden Teil-A-Strategie (`lib/data/store.ts` ist bereits eine bewusste
Mock-Naht für Teil-B/Supabase, siehe ADR-0002) — ein zweites, abweichendes Muster nur für Auth
wäre inkonsistent. Die gebaute UI (Login-Seite, Profil, Nutzerverwaltung, Guards/Redirects) ist
1:1 wiederverwendbar, wenn Teil-B `verifyLogin`/`getUsers`/`saveUsers` durch Supabase-Auth-Aufrufe
ersetzt. Option 2 wäre verfrüht (Supabase-Projekt/Schema existiert noch nicht) und würde die
Datenschicht inkonsistent machen; Option 3 hätte die geforderte Rollen-/Verwaltungsfunktionalität
nicht geliefert.

## Vor- und Nachteile

- ➕ Konsistent mit der restlichen Teil-A-Mock-Strategie (eine Naht-Philosophie für die ganze App).
- ➕ UI (Login, Profil, Nutzerverwaltung) bleibt beim Umstieg auf Teil-B unverändert wiederverwendbar.
- ➕ Kein Blocker durch fehlendes Supabase-Setup — Feature ist in Teil-A vollständig nutzbar.
- ➖ **Passwörter sind im Klartext in `localStorage` gespeichert — unsicher.** Nur akzeptabel,
  weil rein lokal (kein Server, kein Netzwerkzugriff) und ausschließlich bis zum Teil-B-Cutover.

## Auswirkungen

- `Frontend/src/lib/auth.ts`, `hooks/use-auth.tsx`, `pages/login`, `pages/profile`,
  `pages/admin/users-page.tsx` sind die Naht — Teil-B ersetzt hier die komplette Auth-Schicht
  (Supabase Auth, gehashte Passwörter, RLS-Policies) bei unveränderter UI.
  Start-Admin (`Mo`/`pizza`, änderbar im Profil) entfällt beim Cutover zugunsten echter
  Supabase-Nutzerverwaltung.
- Altes Mock-Admin-Login (`useAdminAuth`, `verifyAdminPassword`, `ADMIN_PASSWORD`,
  `admin/login-page.tsx`) wurde vollständig entfernt und durch das rollenbasierte System ersetzt.

## Alternativen

Option 2 (Supabase vorziehen) verworfen — keine vorzeitige Backend-Abhängigkeit in Teil-A,
Datenschicht bleibt einheitlich Mock bis zum geplanten Teil-B-Cutover. Option 3
(nur Vorausfüllen) verworfen — deckt die geforderte Rollen-/Verwaltungsfunktionalität nicht ab.
