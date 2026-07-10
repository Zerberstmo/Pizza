# Pizza-Frontend

Mobile-first Bestell-App (Vorbestellung + Abholung) — Vite + React 18 + TypeScript + Tailwind v4 + shadcn/ui.
**Paketmanager & Test-Runner: Bun.**

## Befehle

```bash
bun install         # Abhängigkeiten
bun run dev         # Dev-Server → http://localhost:5173
bun run build       # tsc -b && vite build → dist/
bun test src        # Unit-/Component-Tests (bun:test + happy-dom)
bun run test:e2e    # E2E (Playwright) — Browser nötig, siehe Hinweis unten
```

## Ordnerstruktur

```
src/
├── app.tsx · main.tsx · router.tsx      App-Root, Routing
├── types/                               Domänentypen
├── lib/
│   ├── pricing.ts · slots.ts            reine, getestete Logik (Preis/Gutschein, Slots/Vorlaufzeit)
│   ├── recommendations.ts               Zutaten-Empfehlungen
│   └── data/{seed,store}.ts             async Datenschicht (localStorage-Naht)
├── hooks/                               useAsync, useCart, useConfigEditor, useAdminAuth
├── components/{ui,pizza,common,layout}  Primitives, Pizza-SVG, Charts, Layouts
└── pages/{menu,configurator,checkout,confirmation,admin}
tests/e2e/                               Playwright Happy-Path
```

## Daten (wichtig)

Alle Daten laufen **ausschließlich** über `lib/data/store.ts` (async).
Aktuell Mock/`localStorage` mit künstlichem Delay — **das ist die Naht für Teil-B (Supabase).**
Die UI bleibt dabei unverändert; nur `store.ts` wird ersetzt.

## Admin

- Zugang: unten „Admin" → Passwort `pizza` (Mock, `seed.ts` — **Teil-B: echte Supabase-Auth**).
- Konfigurierbar: Bestelltage, Öffnungszeiten, **Vorlaufzeit** (Default 3 Tage), Zutaten, Gutscheine.
- **Vorlaufzeit:** Frühester Abholtag = heute + Vorlaufzeit. Wirkt direkt auf die Datumsauswahl im Checkout.

## E2E-Hinweis

`bun run test:e2e` nutzt System-Chrome (`channel: "chrome"`). In manchen Umgebungen ist
kein Browser lauffähig; dann lokal ausführen mit `bunx playwright install chromium` und
`playwright.config.ts` ggf. auf das gebündelte Chromium zurückstellen.
