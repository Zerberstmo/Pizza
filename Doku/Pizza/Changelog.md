# Changelog

> Jede Änderung wird dokumentiert. Neueste zuerst. Vorlage: [Templates/_changelog-entry.md](Templates/_changelog-entry.md)

<!-- Neue Einträge oben einfügen -->

## 2026-07-09

- **Routing-Gerüst (Task 7):** react-router mit Kunden-Layout (`app-layout` + `BottomNav`) und Admin-Layout (`admin-shell`, Tab-Nav inkl. neuem „Vorlaufzeit"-Tab). Routen `/`, `/konfigurator`, `/warenkorb`, `/bestaetigung`, `/admin` + `/admin/{dashboard,tage,oeffnungszeiten,vorlaufzeit,zutaten,gutscheine}`. Alle Seiten als Stubs angelegt. Dev-Server + Build verifiziert.
- **Präsentations-Bausteine (Task 6):** 11 shadcn-Primitives portiert, `PizzaSVG` + `toppings`, `QrCode`, `SelectInput`, `SvgBarChart`/`SvgDonutChart`, `AsyncBoundary`. `PizzaCard` neu — nutzt selbst-enthaltene `PizzaSVG` statt Figma-Fotos. Radix `label`/`progress` ergänzt.
- **Hooks (Task 5):** `useAsync` (generischer Lade-/Fehler-Hook mit `reload`) und `useCart` (Context-Provider, localStorage-persistent) — getestet.
- **Datenschicht (Task 4):** async Store `lib/data/store.ts` als Naht für Teil-B (heute localStorage + Delay), inkl. Seed-Daten `lib/data/seed.ts` (Zutaten, Templates, Gutscheine, Dashboard-Mocks, `DEFAULT_CONFIG` mit `leadTimeDays: 3`). Getestet.
- **Slot-Logik-Fix:** `toISO` ohne UTC-Verschiebung (lokale Zeitzone), `formatDateLabel`-Test ergänzt.
- **Teil-A gestartet:** Frontend-Fundament — sauberer Neuaufbau in `Frontend/` (Vite + React 18 + TS + Tailwind v4 + shadcn), Bun als PM/Runner. Scaffold + Tooling (Task 1) umgesetzt.
- **Test-Runner-Wechsel** Vitest → Bun-nativ (`bun test` + happy-dom): Vitest läuft nicht unter Bun-on-Windows. Siehe [ADR-0004](Entscheidungen/ADR-0004-bun-test-statt-vitest.md). SETUP aktualisiert.
