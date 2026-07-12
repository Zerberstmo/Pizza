# TODO

> Prioritäten: **P0** kritisch · **P1** hoch · **P2** mittel · **P3** niedrig
> Status: `offen` · `in Arbeit` · `erledigt`

| Prio | Beschreibung | Status | Abhängigkeiten |
|------|--------------|--------|----------------|
| P1 | Teil-A Frontend-Fundament umsetzen (Plan `docs/superpowers/plans/2026-07-09-teil-a-frontend-fundament.md`) | erledigt | — |
| P1 | Teil-A-Erweiterung (Soßen/Favoriten/Service) | erledigt | Teil-A |
| P1 | Nutzer-Accounts (Teil-A-Mock) | erledigt | Teil-A |
| P1 | Teil-B1 (Supabase-Fundament + Auth): Client/Schema/RLS, Edge Function `admin-users`, Domänendaten + Bestellungen aus Supabase, E-Mail-Auth (Login/Profil/Admin-Nutzerverwaltung/Passwort-Reset) — Mock entfernt | erledigt | Teil-A |
| P0 | Supabase-Setup durch Betreiber ausführen + Klick-Test (siehe [SETUP-Supabase.md](SETUP-Supabase.md)): Migrationen `0001`–`0008`; Realtime für `orders` aktivieren (B2); Extensions `pg_cron`+`pg_net`; Edge Functions `admin-users` + `daily-digest` deployen; `cron.schedule` für den Digest anlegen; CallMeBot-Empfänger in `/admin/benachrichtigungen` eintragen; Start-Admin „Mo", Self-Signup deaktivieren, `.env.local` füllen | offen | Teil-B1..B4 |
| P1 | Teil-B2: Bestell-Status + Realtime (Migration 0004, `my-orders`/Admin-Status, `use-orders-realtime`) | erledigt | Teil-B1 |
| P1 | Teil-B4: serverseitige Preis-/Vorlauf-Validierung (Trigger `validate_order`, Migration 0005) | erledigt | Teil-B1 |
| P1 | Teil-B3: täglicher WhatsApp-Digest ~18:00 (Cron→Edge Function `daily-digest`→CallMeBot, Migration 0006, `/admin/benachrichtigungen`) — kein Ping pro Bestellung; ADR-0003 angepasst | erledigt | Teil-B1, Teil-B2 |
| P1 | Teil-B5: Vorbereitungs-/Einkaufs-Digest (derselbe 18-Uhr-Lauf sendet Liste für morgen: Zutaten/Soßen + Teiganzahl; Migration 0008 `last_prep_date`) | erledigt | Teil-B3, Teil-B4 |
| P3 | `daily-digest`: `catch (e)`-Fehlermeldungen interpolieren `${e}` — theoretisch könnte die apikey-behaftete Fetch-URL im Response-Body landen (nur an den privilegierten Cron-Aufrufer). Generische Meldung + serverseitig loggen. | offen | Teil-B3 |
| P2 | Rest-Härtung (Final-Reviews): `auth.role()` (deprecated) durch `request.jwt.claims`-Claim ersetzen; Admin-Nutzeraktionen (löschen/reset/toggle) Fehler anzeigen; Edge-Function CORS auf Frontend-Origin, Input-Validierung; Reset-Seite Enter-submit/Doppelklick-Schutz; optional `pickup_date`/`pickup_time`-Format-CHECK auf `orders` (Defense-in-Depth) | offen | Teil-B1..B4 |
| P2 | ~~`vouchers.uses` erhöhen + `maxUses` durchsetzen~~ | erledigt (Migration 0007, atomar; Client-Parität) | Teil-B4 |
| P3 | Telefon-Validierung im Checkout (ursprünglich für Teil-B angedacht, noch offen) | offen | Teil-B1 |
| P2 | E2E in Umgebung mit Browser ausführen (Playwright-Happy-Path grün bestätigen) | offen | Teil-A |
| P2 | Teil-C: Capacitor iOS/Android (QR/Push, Icons/Splash, Store) | offen | Teil-B |
