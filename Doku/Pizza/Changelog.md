# Changelog

> Jede Änderung wird dokumentiert. Neueste zuerst. Vorlage: [Templates/_changelog-entry.md](Templates/_changelog-entry.md)

<!-- Neue Einträge oben einfügen -->

## 2026-07-10

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
