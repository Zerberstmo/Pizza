# Changelog

> Jede Änderung wird dokumentiert. Neueste zuerst. Vorlage: [Templates/_changelog-entry.md](Templates/_changelog-entry.md)

<!-- Neue Einträge oben einfügen -->

## 2026-07-09

- **Teil-A gestartet:** Frontend-Fundament — sauberer Neuaufbau in `Frontend/` (Vite + React 18 + TS + Tailwind v4 + shadcn), Bun als PM/Runner. Scaffold + Tooling (Task 1) umgesetzt.
- **Test-Runner-Wechsel** Vitest → Bun-nativ (`bun test` + happy-dom): Vitest läuft nicht unter Bun-on-Windows. Siehe [ADR-0004](Entscheidungen/ADR-0004-bun-test-statt-vitest.md). SETUP aktualisiert.
