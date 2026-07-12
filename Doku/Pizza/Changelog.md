# Changelog

> Jede Änderung wird dokumentiert. Neueste zuerst. Vorlage: [Templates/_changelog-entry.md](Templates/_changelog-entry.md)

<!-- Neue Einträge oben einfügen -->

## 2026-07-13

- **Teil-B5: Vorbereitungs-/Einkaufs-Digest:** der bestehende 18-Uhr-`daily-digest`-Lauf schickt
  **zusätzlich** eine WhatsApp mit dem, was für **morgen** einzukaufen/vorzubereiten ist —
  aggregiert über alle Bestellungen mit Abholung morgen: je Zutat und je Soße die Anzahl der Pizzen
  plus die Gesamt-Teiganzahl (`🧾 Einkauf/Vorbereitung für morgen …`). Nur wenn es Bestellungen für
  morgen gibt; idempotent über den neuen Merker `notify_config.last_prep_date` (Migration `0008`).
  Kein neuer Cron, keine `app_config`-Prüfung nötig (der `validate_order`-Trigger lässt Bestellungen
  nur an offenen Tagen zu → „morgen hat Bestellungen" ⇒ morgen offen). Reine Aggregations-/
  Formatier-Logik `formatPrepList` (`lib/digest.ts`) getestet; die Edge Function spiegelt sie. Der
  `daily-digest`-Handler wurde so umgebaut, dass Tages-Digest + Vorbereitungsliste unabhängig im
  selben Lauf laufen (Verhalten des Tages-Digests unverändert). Build + 55 Tests grün; Migration
  `0008` + Edge-Deploy führt der Betreiber aus.

## 2026-07-12

- **Härtung: Gutschein-Nutzungslimit serverseitig erzwungen:** der `validate_order`-Trigger
  (Migration `0007`, ersetzt die Gutschein-Prüfung aus `0005`) prüft und zählt Einlösungen jetzt
  **atomar** (`limit 1 for update`, race-sicher); ein aufgebrauchter Gutschein (`uses >= max_uses`)
  wird wie ein ungültiger behandelt → stiller Voll-Preis, keine Ablehnung (`max_uses <= 0` =
  unbegrenzt). `validateVoucher` prüft das Limit ebenfalls (Client-Parität, sonst zeigt der Checkout
  einen Rabatt, den der Server verwirft). Schließt die von den B3/B4-Reviews geflaggte Lücke der
  unbegrenzten Wiederverwendung. Build + 50 Tests grün; Migration führt der Betreiber aus.
- **Teil-B3: täglicher WhatsApp-Bestell-Digest:** statt eines Pings pro Bestellung schickt ein
  `pg_cron`-getriggerter (stündlicher) Edge-Function-Job `daily-digest` **einmal um 18 Uhr
  (Europe/Berlin, DST-sicher via Stunden-Gate)** eine WhatsApp mit allen **heute abzuholenden**
  Bestellungen an CallMeBot — Name, Telefon, Abholzeit, Pizzen, Summe, nach Uhrzeit sortiert.
  Idempotent über `notify_config.last_digest_date`; bei 0 Bestellungen kein Versand. Empfänger-Nummer,
  CallMeBot-API-Key und An/Aus sind in der Admin-Seite **/admin/benachrichtigungen** editierbar
  (Tabelle `notify_config`, **admin-only RLS** — der API-Key ist nicht öffentlich lesbar). Kundendaten
  (`customer_name`/`customer_phone`) werden jetzt in `orders` gespeichert (Migration `0006`). Reine
  Formatier-/Filter-Logik (`lib/digest.ts` `formatDigest`/`filterTodaysPickups`) getestet; die Edge
  Function spiegelt sie (Deno-Copy). ADR-0003 von „Push pro Bestellung" auf Digest umgeschrieben.
  Hier nur Build + Tests verifiziert (`bun test src` 48 grün); Migration `0006`, Edge Function und
  `cron.schedule` führt der Betreiber aus (siehe [SETUP-Supabase.md](SETUP-Supabase.md)).
- **Teil-B4: serverseitige Preis-/Vorlauf-Validierung:** Postgres-`BEFORE INSERT`-Trigger
  `validate_order` (Migration `0005`) berechnet Preis/Gutschein serverseitig neu und weist ungültige
  Abhol-Slots ab (Vorlaufzeit, Wochentag, Uhrzeit, Service-Modus). Manipulierte `total`/`discount`
  werden korrigiert; ungültiger Gutschein → stiller Voll-Preis ohne Ablehnung; leere Bestellung/
  unbekannter Service-Modus/fehlende Konfig → Ablehnung (fail-closed). Checkout fängt einen
  serverseitigen Reject sauber ab (Fehlermeldung statt Absturz). Schließt das in B1 dokumentierte
  Client-Manipulations-Restrisiko. Nur Build verifiziert; Betreiber führt `0005` aus.
- **Teil-B2: Bestell-Status + Realtime:** `orders.status` auf fünf Werte begrenzt (Migration `0004`:
  `eingegangen`/`in_arbeit`/`fertig`/`abgeholt`/`storniert`); Statuslogik in `lib/order-status.ts`.
  Kunde sieht seine Bestellungen unter **/bestellungen** (`my-orders-page`) mit Status-Badge, Admin
  ändert den Status unter **/admin/bestellungen**. Live-Aktualisierung via Supabase-Realtime
  (`hooks/use-orders-realtime.ts`, `postgres_changes`); `useAsync` lädt bei Realtime-Reload ohne
  Spinner-Flackern (nur beim ersten Laden). **Betreiber muss Realtime für die Tabelle `orders`
  aktivieren**, sonst bleibt die Live-Aktualisierung wirkungslos.

## 2026-07-11

- **Teil-B1: Supabase-Cutover (Tasks 1–8):** Umstieg von den Teil-A-Mocks auf ein echtes
  Supabase-Backend hinter der bestehenden Naht (`store.ts`/`use-auth.tsx`), siehe
  [ADR-0006](Entscheidungen/ADR-0006-supabase-cutover.md). Supabase-Client + `.env.local`-Keys;
  SQL-Migrationen `0001` (Schema + RLS, inkl. `protect_profile_columns`-Trigger und
  `handle_new_user`, das die Rolle serverseitig auf `customer` erzwingt), `0002` (Seed), `0003`
  (`profiles.email`); Edge Function `admin-users` (Anlegen/Löschen/Passwort-Reset via
  `service_role`); alle Domänendaten + Bestellungen laufen jetzt über Supabase-Postgres statt
  localStorage. **Auth-Umstellung auf E-Mail** (statt Benutzername) — Login-, Profil- und
  Admin-Nutzerverwaltungsseiten sowie `useAuth` sprechen jetzt Supabase Auth; neue
  Passwort-Reset-Seite. Der localStorage-Mock aus [ADR-0005](Entscheidungen/ADR-0005-mock-auth-naht.md)
  (inkl. Klartext-Passwörter) ist vollständig entfernt. Start-Admin „Mo" wird per Dashboard
  angelegt und per SQL zu `admin` befördert (siehe [SETUP-Supabase.md](SETUP-Supabase.md)).
  Hier nur Build/Typecheck + reine Logik-Tests verifiziert (`bun run build` grün, `bun test src`
  36/36 grün) — diese Umgebung hat keinen Netzwerkzugriff auf Supabase; die Ausführung gegen ein
  echtes Projekt (Migrationen, Edge Function, Klick-Test) obliegt dem Betreiber gemäß
  [SETUP-Supabase.md](SETUP-Supabase.md).

## 2026-07-10

- **Nutzer-Accounts (Tasks A1–A8):** rollenbasiertes Login-Gate (`/login`, ersetzt das alte
  Admin-Mock-Passwort vollständig — `useAdminAuth`/`ADMIN_PASSWORD` entfernt), Profil-Selbstbearbeitung
  (`/profil`: Name/Telefon/Passwort, Benutzername read-only), Admin-Nutzerverwaltung
  (`/admin/nutzer`: anlegen, Rolle, aktiv/inaktiv, löschen, Passwort zurücksetzen,
  Admin kann sich nicht selbst aussperren), Checkout-Vorausfüllung aus dem Profil.
  Start-Admin `Mo`/`pizza` (im Profil änderbar). Datenschicht `lib/auth.ts`
  (`getUsers`/`saveUsers`/`verifyLogin`) + `hooks/use-auth.tsx` als `localStorage`-Mock
  (Klartext-Passwörter — bewusste, dokumentierte Teil-A-Grenze, siehe
  [ADR-0005](Entscheidungen/ADR-0005-mock-auth-naht.md); Teil-B ersetzt durch Supabase-Auth).
  Build + 49 Unit-Tests grün, `sauber`-Check bestanden (keine Altlasten der alten Admin-Auth).
- **Auth (Task A3):** `useAuth`-Hook + `AuthProvider` (`Frontend/src/hooks/use-auth.tsx`) — Mock-Session über `sessionStorage` (Key `pizza-auth`, speichert `user.id`), aufgelöst gegen `getUsers()` beim Start (`loading`-Flag). `login`/`logout`/`updateOwnProfile` (patcht nur `firstName`/`lastName`/`phone`/`password`, `username`/`role`/`id` unantastbar). Als äußerster Provider in `app.tsx` eingehängt. TDD, 4 neue Tests grün, Build sauber. TEIL-B TODO: Supabase-Auth.
- **Teil-A-Erweiterung (Tasks 1–12):** Soßen (admin-verwaltbar unter `/admin/sossen`, färben die `PizzaSVG`-Vorschau, im pauschalen 10€-Preis enthalten), Favoriten (max. 5 eigene Pizzen, `useFavorites`/localStorage, nutzbar in Konfigurator + Speisekarte), Service-Modus (Vor Ort / Abholen, admin-schaltbar unter `/admin/service`, wirkt auf Checkout, Bestätigung und Speisekarten-Header). Build sauber, 35 Unit-Tests grün, keine Altlasten.

## 2026-07-09

- **Teil-A abgeschlossen (Tasks 12–18):** Admin-Login + Session-Guard (Mock-Auth, `useAdminAuth`), Admin-Dashboard (async Kennzahlen/Charts), Admin-Verwaltung für Tage/Öffnungszeiten/**Vorlaufzeit**/Zutaten/Gutscheine (alle persistent). Gemeinsames Load/Save/Flash-Muster in `useConfigEditor` extrahiert. E2E-Happy-Path (Playwright, System-Chrome) geschrieben — Ausführung in dieser Umgebung mangels Browser blockiert, dokumentiert. `Frontend/README.md`, ADR-0001 (Capacitor), ADR-0002 (Supabase), ADR-0003 (CallMeBot) angelegt. Build + 24 Unit-Tests grün, keine Altlasten (kein MUI/Emotion/figma:asset).
- **Bestätigung (Task 11):** `confirmation-page` — Order via Router-State, `QrCode`, Redirect zu `/` ohne State.
- **Checkout (Task 10):** `checkout-page` — Vorlaufzeit-Slots aus Config, Gutschein via `validateVoucher`, Bestellung via `createOrder` → Bestätigung.
- **Konfigurator (Task 9):** `configurator-page` portiert — Zutaten async, `selected`-State lokal, Live-`PizzaSVG`, Empfehlungen via ausgelagerter `lib/recommendations.ts` (`getRecs`), Kategorien aus den Daten abgeleitet (kein Seed-Import in der Seite). „+ Warenkorb" legt „Eigene Pizza" an und navigiert zu `/warenkorb`.
- **Speisekarte (Task 8):** `menu-page` portiert — Menü + Zutaten async über `useAsync`/`AsyncBoundary`, `PizzaCard`-Kacheln, „In den Warenkorb" via `useCart`, Warenkorb-Hinweisleiste mit Navigation zu `/warenkorb`.
- **Routing-Gerüst (Task 7):** react-router mit Kunden-Layout (`app-layout` + `BottomNav`) und Admin-Layout (`admin-shell`, Tab-Nav inkl. neuem „Vorlaufzeit"-Tab). Routen `/`, `/konfigurator`, `/warenkorb`, `/bestaetigung`, `/admin` + `/admin/{dashboard,tage,oeffnungszeiten,vorlaufzeit,zutaten,gutscheine}`. Alle Seiten als Stubs angelegt. Dev-Server + Build verifiziert.
- **Präsentations-Bausteine (Task 6):** 11 shadcn-Primitives portiert, `PizzaSVG` + `toppings`, `QrCode`, `SelectInput`, `SvgBarChart`/`SvgDonutChart`, `AsyncBoundary`. `PizzaCard` neu — nutzt selbst-enthaltene `PizzaSVG` statt Figma-Fotos. Radix `label`/`progress` ergänzt.
- **Hooks (Task 5):** `useAsync` (generischer Lade-/Fehler-Hook mit `reload`) und `useCart` (Context-Provider, localStorage-persistent) — getestet.
- **Datenschicht (Task 4):** async Store `lib/data/store.ts` als Naht für Teil-B (heute localStorage + Delay), inkl. Seed-Daten `lib/data/seed.ts` (Zutaten, Templates, Gutscheine, Dashboard-Mocks, `DEFAULT_CONFIG` mit `leadTimeDays: 3`). Getestet.
- **Slot-Logik-Fix:** `toISO` ohne UTC-Verschiebung (lokale Zeitzone), `formatDateLabel`-Test ergänzt.
- **Teil-A gestartet:** Frontend-Fundament — sauberer Neuaufbau in `Frontend/` (Vite + React 18 + TS + Tailwind v4 + shadcn), Bun als PM/Runner. Scaffold + Tooling (Task 1) umgesetzt.
- **Test-Runner-Wechsel** Vitest → Bun-nativ (`bun test` + happy-dom): Vitest läuft nicht unter Bun-on-Windows. Siehe [ADR-0004](Entscheidungen/ADR-0004-bun-test-statt-vitest.md). SETUP aktualisiert.
