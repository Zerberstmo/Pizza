# TODO

> Prioritäten: **P0** kritisch · **P1** hoch · **P2** mittel · **P3** niedrig
> Status: `offen` · `in Arbeit` · `erledigt`

| Prio | Beschreibung | Status | Abhängigkeiten |
|------|--------------|--------|----------------|
| P1 | ~~Öffnungstage per Kalender statt Wochentags-Muster~~ | erledigt (2026-07-18) — Tabelle `open_days` + `validate_order` prüft `date ∈ open_days` (Migration `0017`), Admin `/admin/tage` als Kalender-Raster (4 Wochen), Checkout + Vorlaufzeit-Seite umgestellt. Betreiber: `bunx supabase db push` (0017), dann Tage im Admin planen (startet leer). | Teil-B4 |
| P1 | Teil-A Frontend-Fundament umsetzen (Plan `docs/superpowers/plans/2026-07-09-teil-a-frontend-fundament.md`) | erledigt | — |
| P1 | Teil-A-Erweiterung (Soßen/Favoriten/Service) | erledigt | Teil-A |
| P1 | Nutzer-Accounts (Teil-A-Mock) | erledigt | Teil-A |
| P1 | Teil-B1 (Supabase-Fundament + Auth): Client/Schema/RLS, Edge Function `admin-users`, Domänendaten + Bestellungen aus Supabase, E-Mail-Auth (Login/Profil/Admin-Nutzerverwaltung/Passwort-Reset) — Mock entfernt | erledigt | Teil-A |
| P0 | ~~Supabase-Setup durch Betreiber ausführen + Klick-Test~~ | erledigt (2026-07-13) — Migrationen `0001`–`0009`, Realtime `orders`, `pg_cron`+`pg_net`, Edge Functions `admin-users`+`daily-digest` deployed, Cron `daily-digest-hourly`, Admin „Mo", Self-Signup aus, `.env.local` + Vercel-Env gefüllt, **CallMeBot-Empfänger eingetragen (Digests kommen an)** | Teil-B1..B4 |
| P1 | Teil-B2: Bestell-Status + Realtime (Migration 0004, `my-orders`/Admin-Status, `use-orders-realtime`) | erledigt | Teil-B1 |
| P1 | Teil-B4: serverseitige Preis-/Vorlauf-Validierung (Trigger `validate_order`, Migration 0005) | erledigt | Teil-B1 |
| P1 | Teil-B3: täglicher WhatsApp-Digest ~18:00 (Cron→Edge Function `daily-digest`→CallMeBot, Migration 0006, `/admin/benachrichtigungen`) — kein Ping pro Bestellung; ADR-0003 angepasst | erledigt | Teil-B1, Teil-B2 |
| P1 | Teil-B5: Vorbereitungs-/Einkaufs-Digest (derselbe 18-Uhr-Lauf sendet Liste für morgen: Zutaten/Soßen + Teiganzahl; Migration 0008 `last_prep_date`) | erledigt | Teil-B3, Teil-B4 |
| P3 | `daily-digest`: `catch (e)`-Fehlermeldungen interpolieren `${e}` — theoretisch könnte die apikey-behaftete Fetch-URL im Response-Body landen (nur an den privilegierten Cron-Aufrufer). Generische Meldung + serverseitig loggen. | offen | Teil-B3 |
| P2 | Rest-Härtung (Final-Reviews): `auth.role()` (deprecated) durch `request.jwt.claims`-Claim ersetzen; Admin-Nutzeraktionen (löschen/reset/toggle) Fehler anzeigen; Edge-Function CORS auf Frontend-Origin, Input-Validierung; Reset-Seite Enter-submit/Doppelklick-Schutz; optional `pickup_date`/`pickup_time`-Format-CHECK auf `orders` (Defense-in-Depth) | offen | Teil-B1..B4 |
| P2 | ~~`vouchers.uses` erhöhen + `maxUses` durchsetzen~~ | erledigt (Migration 0007, atomar; Client-Parität) | Teil-B4 |
| P3 | Telefon-Validierung im Checkout (ursprünglich für Teil-B angedacht, noch offen) | offen | Teil-B1 |
| P2 | ~~Echter, scanbarer QR → öffentliche Bestell-Status-Seite~~ | erledigt (Migration 0010 `public_token`+RPC, `qrcode.react`, Route `/bestellung/:token`, Auto-Refresh 20s; ADR-0007). Betreiber: `bunx supabase db push` für 0010 | Frontend-Deployment |
| P3 | ~~Pizza-Favicon~~ | erledigt (`Frontend/public/favicon.svg`, Markenorange, in `index.html` verlinkt + `theme-color`) | Frontend-Deployment |
| P3 | ~~Erneut bestellen (1-Tap)~~ | erledigt (2026-07-15) — Button im `OrderQrModal` legt Positionen zurück in den Warenkorb → Checkout | Frontend-Deployment |
| P3 | ~~QR/Status aus „Meine Bestellungen" erneut öffnen~~ | erledigt (2026-07-14) — `OrderQrModal` (Overlay, X/Backdrop/Escape), `publicToken` in `OrderRow`, `buildLabels` | Frontend-Deployment |
| P3 | **Kunden-Erinnerung ~15 Uhr am Abholtag** — GEPARKT (2026-07-14): Auslöser trivial (15-Uhr-Cron + Bestellungen mit Abholung=heute). Blocker = Kanal (CallMeBot geht nicht für Kunden). Optionen analysiert: E-Mail (gratis, leichtester Start) / SMS-Twilio (~7–10 ct) / WhatsApp-Business-API (viel Setup). Bei Wiederaufnahme erst Kanal wählen. | geparkt | Teil-B3 |
| P3 | ~~Zutaten bearbeiten~~ | erledigt (2026-07-14) — Stift-Icon/gemeinsames Formular, `id`+`available` bleiben | — |
| P3 | **Idee: Dashboard-Reset-Button** unter neuem Tab „Einstellungen" (gegen Fehlklick isoliert, Bestätigungsdialog). ❓ Klären: setzt „Reset" **alle Bestellungen** zurück (Daten leeren) oder nur Statistik/Zähler? | offen (Ideenstatus) | — |
| P3 | ~~Zutaten-Kategorie „Sonstiges"~~ | erledigt (2026-07-14) — `BASE_CATEGORIES` inkl. Sonstiges + „Neue Kategorie…"-Freitext; datengetrieben in Admin+Konfigurator | — |
| — | ~~„Angemeldet bleiben" beim Login~~ | **gestrichen** (2026-07-14) — nicht nötig: supabase-js hält die Session per Default dauerhaft (`localStorage`); Nutzer bleibt eh eingeloggt. Checkbox bräuchte man nur als Opt-out für geteilte Geräte. | — |
| P2 | ~~versteckter Gutschein → verstecktes Warenkorb-Item mit Menge~~ | erledigt (2026-07-17) — als **Sonderartikel/VIP** gebaut: Migration `0012` (`special_items`/`special_item_grants`, RLS admin-only, RPC `unlock_special_item`, serverautoritativer `validate_order`, Diskretion in `get_order_status`), Admin-Seite `/admin/sonderartikel`, Einlösung im Gutscheinfeld, pro-Kunde-Staffelpreise. Geklärt: Preis = pro Kunde + Mengenstaffel; Admin sieht Sonderartikel immer, Kunde nur bis `abgeholt`. Betreiber: `db push` (0012) **erledigt**, offen `bunx supabase functions deploy daily-digest` + Merge/Frontend-Deploy. Siehe [Features/Sonderartikel-VIP.md](Features/Sonderartikel-VIP.md) | Mengen im Warenkorb |
| P2 | ~~Sonderartikel: Sofort-Bestellung + Sofort-WhatsApp~~ | erledigt (2026-07-17) — reine Special-Bestellung ohne Abhol-Beschränkungen (Datum/Zeit = jetzt, Europe/Berlin), Migration `0013` (`validate_order` überspringt Slot-Block bei `pizza_qty = 0`, Trigger `notify_special_order`); sofortige WhatsApp via `pg_net` + neue Edge Function `notify-special-order` + 5-Min-Cron als Sicherheitsnetz. Betreiber offen: `db push` (0013), `functions deploy notify-special-order`, `app.settings.*` setzen, Cron anlegen, Frontend-Deploy (Merge nach `main`) | Sonderartikel/VIP |
| P3 | **Sonderartikel: `min_qty:1` im Admin-UI erzwingen** — löscht/erhöht der Admin die Basisstufe einer Staffel, scheitert die Kundenbestellung serverseitig („Keine passende Preisstaffel"), ohne dass der Admin es merkt. | offen | Sonderartikel/VIP |
| P3 | ~~Mengen im Warenkorb~~ | erledigt (2026-07-16) — Warenkorb-Zeilen mit Stepper (`quantity`, [1,20]), Verschmelzen identischer Pizzen, Preis/Dashboard/Digest gewichten mit Menge, Server-Trigger `validate_order` (Migration `0011`) rechnet mit abgesicherter Mengensumme. Betreiber: `bunx supabase db push` (0011) + `bunx supabase functions deploy daily-digest` | Teil-B4 |
| P2 | ~~Frontend öffentlich hosten (Vercel/Netlify/Supabase)~~ | erledigt — live auf **`https://pizza-self-pi.vercel.app`** (Vercel, Root=`Frontend`, Vite/Bun, Env-Vars gesetzt, Login live); Supabase Auth Site-URL + Redirect-URLs (`…/**` + `https://*-zerberstmos.vercel.app/**`) gesetzt | Teil-B |
| P2 | E2E in Umgebung mit Browser ausführen (Playwright-Happy-Path grün bestätigen) | offen | Teil-A |
| P2 | Teil-C: Capacitor iOS/Android (QR/Push, Icons/Splash, Store) | offen | Teil-B |
