# Frontend-Doku

> Dokumentiert den Code in `../../../Frontend/`. Betriebsanleitung & Befehle: `Frontend/README.md`.

## Seiten (Kundenfluss)

- **Speisekarte** `/` — `pages/menu/menu-page.tsx`: async Menü, `PizzaCard`, „In den Warenkorb", Favoriten-Leiste, Service-Modus-Hinweis im Header.
- **Konfigurator** `/konfigurator` — eigene Pizza, Live-`PizzaSVG` (inkl. Soßen-Färbung), Soßen-Auswahl (`SaucePicker`), Empfehlungen (`getRecs`), als Favorit speichern.
- **Warenkorb/Checkout** `/warenkorb` — Kundendaten, **Vorlaufzeit-Slots**, Service-Modus (Vor Ort/Abholen), Gutschein, Bestellung.
- **Bestätigung** `/bestaetigung` — Bestellnummer + QR, gewählter Service-Modus + Soße, Order via Router-State.

## Admin (`/admin/*`, Guard via `useAdminAuth`)

Dashboard · Bestelltage · Öffnungszeiten · **Vorlaufzeit** · Zutaten · Gutscheine · **Soßen** (`/admin/sossen`) · **Service** (`/admin/service`).
Config-Seiten teilen sich `useConfigEditor` (laden → bearbeiten → speichern).

## Architektur

- **Datenschicht:** `lib/data/store.ts` (async, localStorage-Naht → Teil-B Supabase). Seiten importieren keine Seed-Konstanten.
- **Reine Logik (getestet):** `lib/pricing.ts` (Preis/Gutschein), `lib/slots.ts` (Slots/Vorlaufzeit/`availableServiceModes`), `lib/sauces.ts` (`resolveSauce`), `lib/recommendations.ts`.
- **Hooks:** `useAsync`, `useCart` (localStorage), `useFavorites` (localStorage, max. 5), `useConfigEditor`, `useAdminAuth` (Mock/sessionStorage).
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

`bun test src` (bun:test + happy-dom): Preis-, Slot-/Service-, Soßen-, Store-, useCart- und
useFavorites-Logik. E2E: `tests/e2e/order.spec.ts` (Playwright).

## Entscheidungen

[ADR-0001 Capacitor](../Entscheidungen/ADR-0001-mobile-capacitor.md) ·
[ADR-0002 Supabase](../Entscheidungen/ADR-0002-backend-supabase.md) ·
[ADR-0003 CallMeBot](../Entscheidungen/ADR-0003-whatsapp-callmebot.md) ·
[ADR-0004 bun:test](../Entscheidungen/ADR-0004-bun-test-statt-vitest.md)
