# Frontend-Doku

> Dokumentiert den Code in `../../../Frontend/`. Betriebsanleitung & Befehle: `Frontend/README.md`.
> Nabe: [[00_CONTEXT]] · Architektur: [[Architektur/README|Architektur]] · Backend: [[Backend/README|Backend-Doku]]
>
> **Features:** [[Sonderartikel-VIP|Sonderartikel/VIP]] · [[Status-Angenommen-Storno|Status „angenommen"+Storno]] · [[qr-bestell-status|Öffentlicher QR-Bestell-Status]]

## Seiten (Kundenfluss)

- **Speisekarte** `/` — `pages/menu/menu-page.tsx`: async Menü, `PizzaCard`, „In den Warenkorb", Favoriten-Leiste, Service-Modus-Hinweis im Header.
- **Konfigurator** `/konfigurator` — eigene Pizza, Live-`PizzaSVG` (inkl. Soßen-Färbung), Soßen-Auswahl (`SaucePicker`), Empfehlungen (`getRecs`), als Favorit speichern.
- **Warenkorb/Checkout** `/warenkorb` — Kundendaten (vorausgefüllt aus Profil, falls eingeloggt), **Vorlaufzeit-Slots**, Service-Modus (Vor Ort/Abholen), Gutschein, Bestellung.
- **Bestätigung** `/bestaetigung` — Bestellnummer + QR, gewählter Service-Modus + Soße, Order via Router-State.
- **Login** `/login` — ein Login für alle Rollen, Redirect nach Rolle (Kunde → `/`, Admin → `/admin/dashboard`).
- **Profil** `/profil` (Guard via `RequireAuth`) — eigenen Namen/Telefon/Passwort bearbeiten, Benutzername read-only.

## Accounts & Login

Ein gemeinsames Login-Gate (`/login`) für Kunden und Admin — die **Rolle** (`customer`/`admin`)
im Nutzerdatensatz entscheidet über den Zugang, nicht separate Logins. Start-Admin:
Benutzername `Mo`, Passwort `pizza` (im Profil änderbar). Datenschicht: `lib/auth.ts`
(`getUsers`/`saveUsers`/`verifyLogin`), Session-State über `hooks/use-auth.tsx`
(`sessionStorage`, Key `pizza-auth`). Guards: `RequireAuth`/`RequireCustomer`/`RequireAdmin`
(`components/layout/require-auth.tsx`), Rollen-Redirect via `redirectFor()`.

**Sicherheitshinweis:** Passwörter liegen **im Klartext** im `localStorage`-Datensatz
(Key `pizza-users`) — bewusste, dokumentierte Mock-Grenze nur für die lokale Entwicklung,
siehe [[ADR-0005-mock-auth-naht|ADR-0005 Mock-Auth-Naht]].
**Teil-B ersetzt die gesamte Auth-Schicht durch Supabase-Auth** (gehashte Passwörter, RLS) —
siehe [[ADR-0006-supabase-cutover|ADR-0006 Supabase-Cutover]].

## Admin (`/admin/*`, Guard via `RequireAdmin`)

Dashboard · Bestelltage · Öffnungszeiten · **Vorlaufzeit** · Zutaten · Gutscheine · **Soßen** (`/admin/sossen`) · **Service** (`/admin/service`) · **Nutzer** (`/admin/nutzer`).
Config-Seiten teilen sich `useConfigEditor` (laden → bearbeiten → speichern).
Zugang erfolgt über das gemeinsame Login (`/login`) mit einem Account der Rolle `admin` —
kein separates Admin-Passwort mehr.

## Admin-Nutzerverwaltung

`pages/admin/users-page.tsx` (`/admin/nutzer`): Nutzer anlegen (eindeutiger Benutzername),
Rolle setzen, aktiv/inaktiv schalten, löschen, Passwort zurücksetzen. Ein Admin kann sich nicht
selbst deaktivieren oder löschen (Selbstschutz).

## Architektur

- **Datenschicht:** `lib/data/store.ts` (async, localStorage-Naht → Teil-B Supabase). Seiten importieren keine Seed-Konstanten.
- **Reine Logik (getestet):** `lib/pricing.ts` (Preis/Gutschein), `lib/slots.ts` (Slots/Vorlaufzeit/`availableServiceModes`), `lib/sauces.ts` (`resolveSauce`), `lib/auth.ts` (`getUsers`/`saveUsers`/`verifyLogin`), `lib/recommendations.ts`.
- **Hooks:** `useAsync`, `useCart` (localStorage), `useFavorites` (localStorage, max. 5), `useConfigEditor`, `useAuth` (Mock/sessionStorage, `AuthProvider`).
- **Bausteine:** `components/ui` (shadcn), `pizza` (SVG/Card/`SaucePicker`/`favorites-bar`), `common` (QR, Select, Charts, AsyncBoundary, `section-header`, `reveal`), `layout` (BottomNav, AdminShell).
- **Routing:** `react-router` (`router.tsx`), Kunden-Layout + Admin-Layout.
- **Design-System (dunkel-premium, 2026-07-23):** Farb-/Form-Tokens in `styles/theme.css` (warm-dunkler Grundton, Orange-Glow `--primary-glow`, Gold-Akzent, `--elevated`/`--shadow-warm`, Glaskanten-Utility `.card-glass-edge`, `prefers-reduced-motion`-Abschaltung). Geteilte Bausteine: `ui/button` Variante `glow`, `ui/card` Prop `elevated`, `common/section-header` (Eyebrow+Titel), `common/reveal` (Fade-up über `motion/react`). Angewandt auf Speisekarte, Konfigurator, Checkout, Bestätigung/Status.

## Soßen

Admin-verwaltbar (`pages/admin/sauces-page.tsx`), pro Soße Farbe + Verfügbarkeit. `resolveSauce()`
löst die im Warenkorb-Item hinterlegte `sauceId` gegen die aktuellen Soßen auf (Fallback: erste
verfügbare Soße) und färbt die `PizzaSVG`-Vorschau. Preis bleibt der pauschale 10€-Pizzapreis.

## Favoriten

`useFavorites`/`FavoritesProvider` halten bis zu 5 eigene Pizzen (`FavoritePizza`: Name, Zutaten-ids,
Soßen-id) persistent in `localStorage` (Key `pizza-favorites`). Speichern im Konfigurator,
Anzeige/Hinzufügen zum Warenkorb über `favorites-bar.tsx` auf der Speisekarte.

## Service-Modus

`AppConfig.service` legt fest, ob Vor-Ort-Verzehr und/oder Abholung aktiv sind; `availableServiceModes()`
liefert die aktiven Modi. Admin-Toggle unter `pages/admin/service-page.tsx`. Der Checkout zeigt bei
zwei aktiven Modi eine Auswahl, sonst automatisch den einzigen verfügbaren Modus; Bestätigungsseite
und Speisekarten-Header spiegeln den gewählten bzw. verfügbaren Modus.

## Tests

`bun test src` (bun:test + happy-dom, 49 Tests): Preis-, Slot-/Service-, Soßen-, Store-, useCart-,
useFavorites- und Auth-Logik (`verifyLogin`, `useAuth`, `usernameTaken`, `redirectFor`).
E2E: `tests/e2e/order.spec.ts` (Playwright).

## Entscheidungen

[[ADR-0001-mobile-capacitor|ADR-0001 Capacitor]] ·
[[ADR-0002-backend-supabase|ADR-0002 Supabase]] ·
[[ADR-0003-whatsapp-callmebot|ADR-0003 CallMeBot]] ·
[[ADR-0004-bun-test-statt-vitest|ADR-0004 bun:test]] ·
[[ADR-0005-mock-auth-naht|ADR-0005 Mock-Auth-Naht]] ·
[[ADR-0006-supabase-cutover|ADR-0006 Supabase-Cutover]] ·
[[ADR-0007-oeffentlicher-bestell-status-token|ADR-0007 Öffentl. Token]]

Alle Entscheidungen im Index: [[Entscheidungen/README|ADR-Übersicht]].
