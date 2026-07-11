# Frontend-Doku

> Dokumentiert den Code in `../../../Frontend/`. Betriebsanleitung & Befehle: `Frontend/README.md`.

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
siehe [ADR-0005](../Entscheidungen/ADR-0005-mock-auth-naht.md).
**Teil-B ersetzt die gesamte Auth-Schicht durch Supabase-Auth** (gehashte Passwörter, RLS).

## Admin (`/admin/*`, Guard via `RequireAdmin`)

Dashboard · Bestelltage · Öffnungszeiten · **Vorlaufzeit** · Zutaten · Gutscheine · **Soßen** (`/admin/sossen`) · **Service** (`/admin/service`) · **Nutzer** (`/admin/nutzer`).
Config-Seiten teilen sich `useConfigEditor` (laden → bearbeiten → speichern).
Zugang erfolgt über das gemeinsame Login (`/login`) mit einem Account der Rolle `admin` —
kein separates Admin-Passwort mehr.

## Admin-Nutzerverwaltung

`pages/admin/users-page.tsx` (`/admin/nutzer`): Nutzer anlegen (eindeutiger Benutzername),
Rolle setzen, aktiv/inaktiv schalten, löschen, Passwort zurücksetzen. Ein Admin kann sich nicht
selbst deaktivieren/löschen bzw. den letzten aktiven Admin entfernen (Selbstschutz).

## Architektur

- **Datenschicht:** `lib/data/store.ts` (async, localStorage-Naht → Teil-B Supabase). Seiten importieren keine Seed-Konstanten.
- **Reine Logik (getestet):** `lib/pricing.ts` (Preis/Gutschein), `lib/slots.ts` (Slots/Vorlaufzeit/`availableServiceModes`), `lib/sauces.ts` (`resolveSauce`), `lib/auth.ts` (`getUsers`/`saveUsers`/`verifyLogin`), `lib/recommendations.ts`.
- **Hooks:** `useAsync`, `useCart` (localStorage), `useFavorites` (localStorage, max. 5), `useConfigEditor`, `useAuth` (Mock/sessionStorage, `AuthProvider`).
- **Bausteine:** `components/ui` (shadcn), `pizza` (SVG/Card/`SaucePicker`/`favorites-bar`), `common` (QR, Select, Charts, AsyncBoundary), `layout` (BottomNav, AdminShell).
- **Routing:** `react-router` (`router.tsx`), Kunden-Layout + Admin-Layout.

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

[ADR-0001 Capacitor](../Entscheidungen/ADR-0001-mobile-capacitor.md) ·
[ADR-0002 Supabase](../Entscheidungen/ADR-0002-backend-supabase.md) ·
[ADR-0003 CallMeBot](../Entscheidungen/ADR-0003-whatsapp-callmebot.md) ·
[ADR-0004 bun:test](../Entscheidungen/ADR-0004-bun-test-statt-vitest.md) ·
[ADR-0005 Mock-Auth-Naht](../Entscheidungen/ADR-0005-mock-auth-naht.md)
