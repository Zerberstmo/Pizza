# Changelog

> Jede Änderung wird dokumentiert. Neueste zuerst. Vorlage: [Templates/_changelog-entry.md](Templates/_changelog-entry.md)

<!-- Neue Einträge oben einfügen -->

## 2026-07-19

- **Rest-Härtung (Teil 1):** (1) Admin-Nutzerverwaltung — Toggle/Löschen/Passwort-Reset warfen bei Fehler
  bisher unbemerkt (`void`/unhandled); jetzt `try/catch` mit sichtbarem Fehler-Banner, optimistische Updates
  nur bei Erfolg. (2) Passwort-Reset-Seite — `busy`-State schützt vor Doppelklick/Doppel-Enter (Button
  disabled während des Submits, bleibt nach Erfolg gesperrt bis zum Redirect), und Enter in den Feldern löst
  „Speichern" aus. Kein Betreiber-Deploy (nur Frontend). Offen aus dem Sammelposten: `auth.role()`→
  `request.jwt.claims` (RLS-Migration), Edge-Function-CORS/Input-Validierung.
- **Sonderartikel: Basisstufe `min_qty:1` im Admin-UI erzwungen:** Im `GrantsEditor` werden Tier-Änderungen
  und -Löschungen, die die Basisstufe (`min_qty 1`) entfernen würden, jetzt verworfen; der Löschen-Button der
  einzigen Basisstufe ist deaktiviert, und bei Altdaten ohne Basisstufe erscheint ein Warnhinweis. Neue Stufen
  starten bei `max(min_qty)+1` statt erneut bei 1. Verhindert, dass Kundenbestellungen serverseitig an
  „keine passende Preisstaffel" (Migration `0012`) scheitern, ohne dass der Admin es merkt. Kein Betreiber-Deploy
  (nur Frontend).
- **`daily-digest`-Fehlermeldungen gehärtet (Security, defensiv):** Die beiden `fetch`-`catch`-Blöcke
  interpolierten `${e}` in den Response-Body — bei einem Fetch-Fehler hätte theoretisch die
  apikey-behaftete CallMeBot-URL im Body landen können (nur an den privilegierten Cron-Aufrufer, daher
  P3). Jetzt: generische Meldung an den Aufrufer (`callmebot fetch failed` / `prep fetch failed`), Detail
  via `console.error` serverseitig geloggt. `notify-special-order` hat das Muster nicht. Betreiber:
  `bunx supabase functions deploy daily-digest`.
- **Mobile-Responsivität (horizontaler Überlauf):** Am Handy musste man die Seite erst herauszoomen, um
  den rechten Rand zu sehen — Symptom eines horizontalen Überlaufs. Fix in zwei Ebenen: (1) globales
  Sicherheitsnetz in `theme.css` (`html, body { overflow-x: hidden; max-width: 100% }`), das horizontalen
  Überlauf grundsätzlich unterbindet; (2) 360-px-Audit aller Routen — der einzige echte Nowrap-Überläufer
  war die (lange) E-Mail im Admin-Header (Button mit `whitespace-nowrap`), jetzt `truncate` + `max-w-[45vw]`.
  Kein Desktop-Umbau (bewusst separater Schritt). Hinweis: Der Audit lief statisch + auf öffentlichen
  Routen; ein voller Live-360-px-Durchlauf der Auth-Routen braucht einen Test-Login. Kein Betreiber-Deploy
  nötig (nur Frontend, Vercel deployt bei Push automatisch).

## 2026-07-18

- **Dashboard-Reset (weicher Reset-Punkt):** Neue Admin-Seite `/admin/einstellungen` — der Admin setzt
  per zweistufigem Confirm einen Reset-Zeitpunkt (`app_config.dashboard_reset_at`, Migration `0018`), ab
  dem das Dashboard zählt; „Auf all-time zurückstellen" setzt ihn wieder auf `null`. Nicht destruktiv:
  Bestellungen, Historie und WhatsApp-Digest bleiben unberührt (`getDashboardStats` filtert
  `created_at >= reset`, `computeDashboard` unverändert). Dashboard zeigt den Stichtag „Statistik seit …".
  Betreiber: `bunx supabase db push` (0018).
- **Öffnungstage per Kalender:** Der Admin plant unter `/admin/tage` konkrete Kalendertage
  (Kalender-Raster, 4 Wochen rollend) statt fester Wochentage — für unregelmäßigen Betrieb. Neue
  Tabelle `open_days` (Admin schreibt, Kunden lesen, RLS); `validate_order` (Migration `0017`) prüft
  `date ∈ open_days` statt Wochentag. Globale Uhrzeit + Vorlaufzeit unverändert; Sonderartikel-Sofort­
  bestellung (`pizza_qty = 0`-Bypass) unberührt. Reine Helfer `getSelectableDates`/`calendarGrid` mit
  `bun:test`. Umbau zog zwei weitere `getSelectableDates`-Aufrufer nach (Checkout + Vorlaufzeit-Seite).
  Betreiber: `bunx supabase db push` (0017), danach Tage im Admin planen (`open_days` startet leer).
- **Sonderartikel-Feature ausgerollt & live verifiziert:** Branch `feat/sonderartikel-vip` nach `main`
  gemergt (Vercel-Deploy), Migrationen `0013`/`0014` eingespielt, `notify-special-order` + `daily-digest`
  deployt. Sofort-Bestellung + Sofort-WhatsApp end-to-end getestet: reiner Sonderartikel-Warenkorb →
  „Abholung sofort" → Bestellung → WhatsApp binnen Sekunden.
- **Notify-Trigger liest Secrets aus Supabase Vault (`0014`):** gehostetes Supabase verweigert
  `alter database … set app.settings.*`, daher liest `notify_special_order` URL + Service-Role-Key aus
  `vault.decrypted_secrets` (`notify_url`/`notify_key`) statt aus `app.settings`.
- **Code-Einlösung auch bei leerem Warenkorb** (`checkout-page.tsx`): Das Gutschein-/Code-Feld lag bisher
  nur im Checkout mit nicht-leerem Warenkorb — ein VIP ohne Pizza kam nie an die Einlösung, die reine
  Sonderartikel-Bestellung war praktisch unerreichbar. Der Leerer-Warenkorb-Zustand zeigt jetzt das
  Code-Feld; ein gültiger Code fügt den Artikel hinzu → normaler Checkout mit „Abholung sofort".
- **Sonderartikel-Code case-insensitiv (`0015`):** Der Checkout wandelt die Eingabe in Großbuchstaben,
  `unlock_special_item` verglich aber exakt — ein mit Kleinbuchstaben angelegter Code war nie einlösbar.
  Der Vergleich ist jetzt `lower(code) = lower(eingabe)`.
- **Betreiber-Hinweis (Lehre aus dem Deploy):** Nach einer JWT-Secret-Rotation muss der **neue**
  `service_role`-Key (`eyJ…`) an allen drei Stellen stehen — Vault `notify_key`, `daily-digest`-Cron,
  `special-alert-retry`-Cron. Beim Einfügen **keine** spitzen Klammern (`<…>`) mitkopieren, sonst wirft
  das Function-Gateway `401 UNAUTHORIZED_INVALID_JWT_FORMAT`. Diagnose über `net._http_response`.

## 2026-07-17

- **Sonderartikel/VIP:** versteckte Menü-Items, die nur einzelnen registrierten Kunden per Code
  zugänglich sind — mit **pro-Kunde-Preis** und **Mengen-Staffeln** (flach je Stufe: Stückpreis der
  Stufe mit größtem `min_qty ≤ Menge`). Der Kunde tippt den Code ins **Gutscheinfeld** des Checkouts;
  ist er freigeschaltet, landet der Artikel mit Stepper im Warenkorb, sonst läuft unverändert der
  normale Gutschein-Weg. Admin verwaltet Items und Freischaltungen unter **/admin/sonderartikel**.
  Migration `0012`: Tabellen `special_items`/`special_item_grants` (**RLS admin-only**), Einlöse-RPC
  `unlock_special_item` (SECURITY DEFINER; unbekannter Code und fehlende Freischaltung liefern dasselbe
  leere Ergebnis — **kein Leak**), neuer `validate_order` (rechnet `10 € × Σ(Pizza-Menge) +
  Σ(Sonderartikel-Zeilenpreise)` und prüft je Special-Position einen aktiven Grant für `new.user_id` →
  serverautoritativ, Client-Preise sind reine Anzeige), `get_order_status` blendet nach `abgeholt` die
  Sonderartikel aus (reine Special-Bestellung → gar keine Zeile mehr). `CartItem` ist jetzt eine
  diskriminierte Union (`kind`; fehlend = Pizza, rückwärtskompatibel); Zähler/Dashboard/Digest zählen
  Sonderartikel **nicht** als Pizza — der Digest listet sie als eigene `★`-Zeile, die Vorbereitungsliste
  plant für sie weder Teig noch Zutaten. Diskretion nach Abholung gilt **nur kundenseitig**; Admin sieht
  immer alles. `special_line_price` (SQL) spiegelt `priceForQty` (TS) — synchron halten. Reine Logik mit
  bun:test verifiziert (107 Tests grün, Typecheck + Build grün). Migration `0012` ist am 2026-07-17
  eingespielt; offen: `bunx supabase functions deploy daily-digest` + Frontend-Deploy (Merge nach `main`).
  Details: [Features/Sonderartikel-VIP.md](Features/Sonderartikel-VIP.md).
- **Sonderartikel: Sofort-Bestellung + Sofort-WhatsApp** — eine Bestellung aus ausschließlich
  Sonderartikeln braucht kein Abholdatum und keine Uhrzeit mehr (Datum/Zeit = jetzt, Europe/Berlin) und
  umgeht Vorlaufzeit/Bestelltage/Öffnungszeiten/Service-Verfügbarkeit; Preis- und Zugangsprüfung bleiben
  unverändert serverautoritativ (Migration `0013`, Slot-Block nur noch bei `pizza_qty > 0`). Jede
  Bestellung mit mindestens einem Sonderartikel löst binnen Sekunden eine WhatsApp an den Betreiber aus:
  AFTER-INSERT-Trigger → `pg_net` → neue Edge Function `notify-special-order` → CallMeBot, plus
  5-Minuten-Cron als Sicherheitsnetz (Fenster 2 h, Merker `orders.special_notified_at`). Der Trigger
  schluckt eigene Fehler — eine fehlgeschlagene Benachrichtigung kippt nie die Bestellung. Reine Helfer
  `berlinDateTime`/`formatSpecialAlert` mit bun:test getestet; die Edge Function spiegelt
  `formatSpecialAlert` als Deno-Copy. Ein Code-Review deckte auf, dass ein fehlgeschlagenes „Markieren"
  (`special_notified_at`) nach erfolgreichem Versand als Erfolg durchgereicht worden wäre — der
  5-Minuten-Cron hätte dieselbe WhatsApp dann unbegrenzt alle 5 Minuten erneut verschickt; behoben, indem
  die Function Markier-Fehlschläge zählt und mit HTTP 500 antwortet (`sent: X/Y, mark failed: N`,
  Vorbild `daily-digest`). Betreiber: `db push` (0013), `functions deploy notify-special-order`,
  `app.settings.*` setzen, Cron anlegen.

## 2026-07-16

- **Mengen im Warenkorb:** Warenkorb-Positionen haben jetzt eine Menge; identische Pizzen (gleicher
  Name + gleiche Zutaten + gleiche Soße) verschmelzen zu einer Zeile mit Stepper (`−`/`+`, geklemmt
  auf 1–20). Preis, Header-/Button-Zähler, Bestätigung, Status-Seite, „Meine Bestellungen"-Modal und
  Admin-Bestellungen zeigen/rechnen die Menge; „Erneut bestellen" reicht die Menge durch.
  Dashboard-Aggregation und der WhatsApp-Digest (Tages- + Vorbereitungsliste, inkl. Deno-Edge-Copy)
  gewichten mit der Menge; Alt-Bestellungen ohne Menge zählen als 1. Serverseitige Härtung: Trigger
  `validate_order` (Migration `0011`) rechnet den Preis aus der Summe der abgesicherten
  Positions-Mengen (fehlend→1, geklemmt [1,20]) statt aus der Positionsanzahl — schützt vor
  Preis-Manipulation via JSON. Reine Logik mit bun:test verifiziert (83 Tests grün, Build grün).
  Betreiber führt aus: `bunx supabase db push` (Migration `0011`) + `bunx supabase functions deploy
  daily-digest`.

## 2026-07-15

- **Erneut bestellen (1-Tap):** Im Bestell-Detail-Fenster („Meine Bestellungen" → Bestellung antippen)
  legt der Button „Erneut bestellen" alle Positionen der Bestellung zurück in den Warenkorb und führt
  zum Checkout (`OrderQrModal` → `addToCart` → `/warenkorb`). Anhängen an den bestehenden Warenkorb,
  kein Bestätigungsdialog. Reines Frontend.

## 2026-07-14

- **QR/Status aus „Meine Bestellungen" erneut öffnen:** Klick auf eine Bestellung öffnet ein
  Overlay-Fenster (`OrderQrModal`) mit QR-Code, „Status verfolgen"-Link, Status, Abholzeit, Pizza-Liste
  und Betrag — bisher war der QR nur direkt nach dem Bestellen sichtbar. `OrderRow` mappt jetzt
  `publicToken`; die Seite lädt `ingredients`+`sauces` und löst Zutatennamen via `buildLabels`
  (`lib/order-labels.ts`, getestet) + `describeItem` auf. Modal schließt per X/Backdrop/Escape.
  Reines Frontend, keine Migration.
- **Zutaten bearbeiten + Kategorie „Sonstiges":** Admin kann bestehende Zutaten jetzt bearbeiten
  (Stift-Icon je Karte → gemeinsames Add-/Edit-Formular; `id` und Verfügbar-Status bleiben erhalten).
  Das Kategorie-Dropdown enthält ein festes Grundset inkl. **„Sonstiges"** (`BASE_CATEGORIES`) plus die
  datengetriebenen Kategorien und eine „＋ Neue Kategorie…"-Option (Freitext; leer → Speichern
  deaktiviert). Neue Kategorien erscheinen automatisch als Admin-Tab und im Kunden-Konfigurator (beide
  datengetrieben). Reiner Helfer `mergeCategories` (`lib/ingredient-categories.ts`) getestet (bun:test).
  Reines Frontend, keine Migration.

## 2026-07-13

- **Scanbarer QR → öffentliche Bestell-Status-Seite:** echter QR (`qrcode.react`) auf der
  Bestätigung verlinkt auf `/bestellung/:token` (öffentlich, ohne Login). Neue Spalte
  `orders.public_token uuid` + SECURITY-DEFINER-RPC `get_order_status` (Migration `0010`), die nur
  Whitelist-Felder (Nr, Status, Abholzeit, Pizzen, Betrag) + eine `labels`-Namensmap liefert — kein
  Name/Telefon/Bemerkung. Status-Seite mit Auto-Refresh alle 20 s (stoppt bei abgeholt/storniert).
  Reine Helfer `describeItem`/`rowToPublicStatus` getestet (bun:test). ADR-0007. Betreiber führt
  Migration `0010` via `bunx supabase db push` aus.
- **Pizza-Favicon:** eigenes SVG-Tab-Icon (`Frontend/public/favicon.svg`) im Marken-Orange
  (`#F97316`, Pizza-Stück mit Kruste/Salami/Basilikum), in `index.html` via
  `<link rel="icon" type="image/svg+xml">` verlinkt, dazu `theme-color`-Meta. Ersetzt das bisherige
  Browser-Standard-Icon.
- **Frontend öffentlich deployed (Vercel):** die App läuft jetzt live auf einer `*.vercel.app`-URL
  (Git-Integration `Zerberstmo/Pizza`, Auto-Deploy auf `main`). Vercel-Konfiguration: **Root
  Directory `Frontend`**, Framework Vite (Bun via `bun.lock` → `bun install` + `bun run build`),
  Output `dist`; SPA-Routing über `Frontend/vercel.json` (Rewrites auf `index.html`). Env-Vars
  `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` in den Vercel-Project-Settings (Production).
  Stolpersteine beim Setup dokumentiert: (1) Root Directory muss `Frontend` sein (sonst 404); (2)
  Output Directory ist `dist`, nicht `build` (Framework-Preset Vite); (3) **Vite backt `VITE_`-Vars
  beim Build ein** — nach dem Nachtragen einer Env-Var muss neu gebaut werden, sonst greift der
  `localhost:54321`/`placeholder-anon-key`-Fallback aus `lib/supabase.ts` (Symptom:
  `UNAUTHORIZED_INVALID_API_KEY` trotz korrekter URL). Login live verifiziert.
- **Admin-Dashboard auf Live-Daten:** echte Aggregation aus `orders` statt Mock — reine, getestete
  Funktion `computeDashboard` (`lib/dashboard.ts`) liefert Gesamt-Kennzahlen (Bestellungen, Umsatz,
  Ø-Bestellwert, Top-Zutat) + Diagramme „Beliebteste Pizzen" (nach `pizzaName`, Eigenkreationen als
  „Eigene Pizza" zusammengefasst) und „Beliebteste Zutaten" (Top 5, Namen via `ingredients`).
  `storniert` überall ausgeschlossen; Leerzustand („Noch keine Daten") ergänzt. `getDashboardStats`
  lädt jetzt echte `orders`+`ingredients`; der Mock (`delay`/`WEEK_DATA`/`PIE_DATA`) ist entfernt.
  Client-seitig aggregiert, mit bun:test verifiziert (60 Tests grün).
- **Betreiber-Setup live gegangen + Setup-Härtung:** Supabase-Projekt real aufgesetzt (Migrationen,
  Edge Functions `admin-users`/`daily-digest` deployed, `pg_cron`+`pg_net`, Realtime für `orders`,
  Cron-Job, Admin „Mo"). Dabei zwei Stolpersteine gefunden und behoben: (1) ein `db reset` entfernt
  die Supabase-Standard-Grants am `public`-Schema → Login schlug mit „Konto deaktiviert" fehl →
  neue Migration **`0009_grants.sql`** stellt die Grants wieder her (läuft bei `db push`/`reset`
  automatisch mit); (2) der `protect_profile_columns`-Trigger setzt einen Admin-Promote im SQL-Editor
  zurück → in `SETUP-Supabase.md` dokumentiert (Trigger kurz umgehen). CLI wird über `bunx supabase`
  genutzt (kein globaler Install/PATH). `SETUP-Supabase.md` entsprechend überarbeitet.
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
