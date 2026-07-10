# Frontend-Doku

> Dokumentiert den Code in `../../../Frontend/`. Betriebsanleitung & Befehle: `Frontend/README.md`.

## Seiten (Kundenfluss)

- **Speisekarte** `/` — `pages/menu/menu-page.tsx`: async Menü, `PizzaCard`, „In den Warenkorb".
- **Konfigurator** `/konfigurator` — eigene Pizza, Live-`PizzaSVG`, Empfehlungen (`getRecs`).
- **Warenkorb/Checkout** `/warenkorb` — Kundendaten, **Vorlaufzeit-Slots**, Gutschein, Bestellung.
- **Bestätigung** `/bestaetigung` — Bestellnummer + QR, Order via Router-State.

## Admin (`/admin/*`, Guard via `useAdminAuth`)

Dashboard · Bestelltage · Öffnungszeiten · **Vorlaufzeit** · Zutaten · Gutscheine.
Config-Seiten teilen sich `useConfigEditor` (laden → bearbeiten → speichern).

## Architektur

- **Datenschicht:** `lib/data/store.ts` (async, localStorage-Naht → Teil-B Supabase). Seiten importieren keine Seed-Konstanten.
- **Reine Logik (getestet):** `lib/pricing.ts` (Preis/Gutschein), `lib/slots.ts` (Slots/Vorlaufzeit), `lib/recommendations.ts`.
- **Hooks:** `useAsync`, `useCart` (localStorage), `useConfigEditor`, `useAdminAuth` (Mock/sessionStorage).
- **Bausteine:** `components/ui` (shadcn), `pizza` (SVG/Card), `common` (QR, Select, Charts, AsyncBoundary), `layout` (BottomNav, AdminShell).
- **Routing:** `react-router` (`router.tsx`), Kunden-Layout + Admin-Layout.

## Tests

`bun test src` (bun:test + happy-dom): Preis-, Slot-, Store- und useCart-Logik. E2E: `tests/e2e/order.spec.ts` (Playwright).

## Entscheidungen

[ADR-0001 Capacitor](../Entscheidungen/ADR-0001-mobile-capacitor.md) ·
[ADR-0002 Supabase](../Entscheidungen/ADR-0002-backend-supabase.md) ·
[ADR-0003 CallMeBot](../Entscheidungen/ADR-0003-whatsapp-callmebot.md) ·
[ADR-0004 bun:test](../Entscheidungen/ADR-0004-bun-test-statt-vitest.md)
