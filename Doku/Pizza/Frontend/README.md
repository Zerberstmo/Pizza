# Frontend-Doku

> Dokumentiert den Code in `../../../Frontend/`. Betriebsanleitung & Befehle: `Frontend/README.md`.

## Seiten (Kundenfluss)

- **Speisekarte** `/` — `pages/menu/menu-page.tsx`: async Menü, `PizzaCard`, „In den Warenkorb", Favoriten-Leiste, Service-Modus-Hinweis im Header.
- **Konfigurator** `/konfigurator` — eigene Pizza, Live-`PizzaSVG` (inkl. Soßen-Färbung), Soßen-Auswahl (`SaucePicker`), Empfehlungen (`getRecs`), als Favorit speichern.
- **Warenkorb/Checkout** `/warenkorb` — Kundendaten, **Vorlaufzeit-Slots**, Service-Modus (Vor Ort/Abholen), Gutschein, Bestellung.
- **Bestätigung** `/bestaetigung` — Bestellnummer + QR, gewählter Service-Modus + Soße, Order via Router-State.
- **Login** `/login` — `pages/login/login-page.tsx`: Benutzername/Passwort gegen `verifyLogin()`, leitet je nach Rolle weiter (`admin` → `/admin/dashboard`, `customer` → `/`).
- **Profil** `/profil` — `pages/profile/profile-page.tsx`: eigene Stammdaten bearbeiten (`updateOwnProfile`), erreichbar für jede eingeloggte Rolle.

## Auth & Rollen-Gate (rollenbasiert, Cutover Task A5)

Rollenbasierte Session (`User.role`: `admin` | `customer`) statt der alten Mock-Admin-Auth. `useAuth`/`AuthProvider`
(`hooks/use-auth.tsx`) hält die Session in `sessionStorage`. Guards in `components/layout/require-auth.tsx`:
`RequireAuth` (nur eingeloggt), `RequireCustomer` (Rolle `customer`, umschließt das Kunden-Layout),
`RequireAdmin` (Rolle `admin`, umschließt das Admin-Layout) — Weiterleitung via `redirectFor()` (`lib/auth.ts`).
Ohne Login führt jede Route zu `/login`; die alte Mock-Admin-Auth (`useAdminAuth`, `verifyAdminPassword`,
`ADMIN_PASSWORD`, `pages/admin/login-page.tsx`) wurde ersatzlos entfernt.

## Admin (`/admin/*`, Guard via `RequireAdmin`)

Dashboard · Bestelltage · Öffnungszeiten · **Vorlaufzeit** · Zutaten · Gutscheine · **Soßen** (`/admin/sossen`) · **Service** (`/admin/service`).
Config-Seiten teilen sich `useConfigEditor` (laden → bearbeiten → speichern). Header zeigt den eingeloggten
Benutzernamen (Link zu `/profil`) + Abmelden (→ `/login`). Tab-Nav enthält einen „Nutzer"-Eintrag
(`/admin/nutzer`) als Vorgriff auf Task A7 — die Route selbst folgt erst dort.

## Architektur

- **Datenschicht:** `lib/data/store.ts` (async, localStorage-Naht → Teil-B Supabase). Seiten importieren keine Seed-Konstanten.
- **Reine Logik (getestet):** `lib/pricing.ts` (Preis/Gutschein), `lib/slots.ts` (Slots/Vorlaufzeit/`availableServiceModes`), `lib/sauces.ts` (`resolveSauce`), `lib/auth.ts` (`redirectFor`).
- **Hooks:** `useAsync`, `useCart` (localStorage), `useFavorites` (localStorage, max. 5), `useConfigEditor`, `useAuth` (Session/sessionStorage, rollenbasiert).
- **Bausteine:** `components/ui` (shadcn), `pizza` (SVG/Card/`SaucePicker`/`favorites-bar`), `common` (QR, Select, Charts, AsyncBoundary), `layout` (BottomNav, AdminShell, `require-auth.tsx`).
- **Routing:** `react-router` (`router.tsx`), Kunden-Layout (`RequireCustomer`) + Admin-Layout (`RequireAdmin`), `/login` + `/profil` außerhalb der Layouts.

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

`bun test src` (bun:test + happy-dom): Preis-, Slot-/Service-, Soßen-, Store-, useCart- und
useFavorites-Logik. E2E: `tests/e2e/order.spec.ts` (Playwright).

## Entscheidungen

[ADR-0001 Capacitor](../Entscheidungen/ADR-0001-mobile-capacitor.md) ·
[ADR-0002 Supabase](../Entscheidungen/ADR-0002-backend-supabase.md) ·
[ADR-0003 CallMeBot](../Entscheidungen/ADR-0003-whatsapp-callmebot.md) ·
[ADR-0004 bun:test](../Entscheidungen/ADR-0004-bun-test-statt-vitest.md)
