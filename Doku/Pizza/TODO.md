# TODO

> Prioritäten: **P0** kritisch · **P1** hoch · **P2** mittel · **P3** niedrig
> Status: `offen` · `in Arbeit` · `erledigt`

| Prio | Beschreibung | Status | Abhängigkeiten |
|------|--------------|--------|----------------|
| P1 | Teil-A Frontend-Fundament umsetzen (Plan `docs/superpowers/plans/2026-07-09-teil-a-frontend-fundament.md`) | erledigt | — |
| P1 | Teil-A-Erweiterung (Soßen/Favoriten/Service) | erledigt | Teil-A |
| P1 | Nutzer-Accounts (Teil-A-Mock) | erledigt | Teil-A |
| P1 | Teil-B1 (Supabase-Fundament + Auth): Client/Schema/RLS, Edge Function `admin-users`, Domänendaten + Bestellungen aus Supabase, E-Mail-Auth (Login/Profil/Admin-Nutzerverwaltung/Passwort-Reset) — Mock entfernt | erledigt | Teil-A |
| P0 | Supabase-Setup durch Betreiber ausführen + Klick-Test (siehe [SETUP-Supabase.md](SETUP-Supabase.md)) | offen | Teil-B1 |
| P1 | Teil-B2–B4: Bestell-Status + Realtime, WhatsApp via CallMeBot, serverseitige Vorlauf-/Preis-Validierung, Telefon-Validierung | offen | Teil-B1 |
| P2 | B1-Härtung (Final-Review): `vouchers.uses` bei Bestellung erhöhen + `maxUses` durchsetzen (B4); `auth.role()` (deprecated) durch `request.jwt.claims`-Claim ersetzen; Admin-Nutzeraktionen (löschen/reset/toggle) Fehler anzeigen; Edge-Function CORS auf Frontend-Origin, Input-Validierung; Reset-Seite Enter-submit/Doppelklick-Schutz | offen | Teil-B1 |
| P2 | E2E in Umgebung mit Browser ausführen (Playwright-Happy-Path grün bestätigen) | offen | Teil-A |
| P2 | Teil-C: Capacitor iOS/Android (QR/Push, Icons/Splash, Store) | offen | Teil-B |
