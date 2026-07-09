# ADR-0004 — Bun-nativer Test-Runner statt Vitest

- **Status:** akzeptiert
- **Datum:** 2026-07-09

## Problem

Das SETUP sah **Vitest** als Unit/Component-Test-Runner vor. Auf der Entwicklungsmaschine (Windows 11, **nur Bun installiert, kein Node/npm**) startet Vitest jedoch nicht: `bun run test` (→ Vitest) bricht bereits im Vitest-Bootstrap mit `TypeError: File URL path must be an absolute path` (`executeId("/@vite/env")`) ab — bevor eine Testdatei läuft. Ursache ist eine bekannte Inkompatibilität von Vitest/vite-node unter der **Bun-Runtime auf Windows** (Bun ist bei `pathToFileURL` strenger als Node bei laufwerkslosen absoluten Pfaden).

## Mögliche Lösungen

1. **Node.js installieren** und Vitest unter Node laufen lassen (Bun bleibt Package-Manager).
2. **Bun-nativer Test-Runner** (`bun test`, `bun:test`-API) mit happy-dom + Testing Library.
3. Auf Tests im Frontend vorerst verzichten (verworfen — widerspricht SETUP-Qualitätsanspruch).

## Entscheidung

Option 2: **Bun-nativer Test-Runner** (`bun test src`) mit `bun:test`-API, **happy-dom** (via `bunfig.toml`-Preload `test-setup.ts`) und `@testing-library/react`. E2E bleibt **Playwright**.

## Begründung

Die Maschine ist bewusst Bun-only; Option 2 kommt ohne zusätzliche System-Abhängigkeit (Node) aus, ist schnell und voll Bun-nativ. Der Migrationsaufwand ist gering (Test-Imports `vitest` → `bun:test`, jsdom → happy-dom).

## Vor- und Nachteile

- ➕ Kein Node/npm nötig — konsistent Bun-only.
- ➕ Schneller Start, native Integration.
- ➖ Abweichung vom ursprünglichen SETUP-Default (hier dokumentiert/aktualisiert).
- ➖ `bun test` sammelt standardmäßig auch `*.spec.ts` ein → Unit-Tests werden auf `src` begrenzt (`bun test src`), Playwright-E2E liegt unter `tests/e2e/`.

## Auswirkungen

- `Frontend/`: `bunfig.toml` (Preload), `test-setup.ts` (happy-dom + `cleanup`), Test-Dateien importieren aus `bun:test`. Keine `vitest.config.ts`/`jsdom`.
- `SETUP.md` Tech-Stack + „Wichtige Befehle" aktualisiert.
- Implementierungsplan Teil-A: Global Constraints + Tasks 1–6 angepasst.

## Alternativen

Node-Installation (Option 1) verworfen, um die Bun-only-Umgebung nicht mit einer zweiten Runtime zu belasten; jederzeit nachrüstbar, falls Vitest später gewünscht wird.
