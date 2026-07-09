# SETUP — Projekt-Defaults (Single Source of Truth)

> Zentrale Referenz für Stack, Werkzeuge und Konventionen. **Claude hält sich an diese Defaults** und schlägt keine abweichenden Technologien vor, ohne zu fragen.
> Status je Zeile: ✅ `entschieden` · 🕓 `noch offen`

## Tech-Stack

| Bereich | Wert | Status |
|---------|------|--------|
| Frontend – Sprache | TypeScript | ✅ |
| Frontend – Framework | React | ✅ |
| Frontend – Build/Dev | Vite | ✅ |
| Frontend – Styling | Tailwind CSS + shadcn/ui (Radix UI) | ✅ |
| Package-Manager | **Bun** | ✅ |
| Task-Runner | **Bun** (`bun run <script>`) | ✅ |
| Backend / DB | Supabase (Postgres, Auth, Storage, Auto-API) | ✅ |
| Supabase-Clients | `@supabase/supabase-js`, `@supabase/ssr` | ✅ |
| Auth | Supabase Auth | ✅ |
| Test-Runner (Unit/Component) | Vitest | ✅ |
| Test-Runner (E2E) | Playwright | ✅ |
| Deployment-Ziel | — | 🕓 |
| CI/CD | — | 🕓 |

> **Bun-Hinweise:** Nur ein Package-Manager konsequent nutzen — **kein** zwischenzeitliches `npm install` (sonst driften Lockfiles). Tests laufen über **Vitest** (`bun run test`), **nicht** über `bun test`. Die `pnpm-workspace.yaml` aus der Frontend-Vorlage ist damit obsolet.

## Konventionen

- **Ordnerstruktur:**
  - `Frontend/` — App-Code (Vite/React)
  - `Backend/` — Supabase-Artefakte (Migrations, Edge Functions)
  - `Doku/` — Projektdokumentation
  - `Frontend vorlage/` — Ausgangsvorlage (Figma-Make-Export)
- **Namensregeln:** Komponenten `PascalCase`, Dateien & Ordner `kebab-case`
- **Code-Style:** Prettier (Formatierung) + ESLint (Linting)
- **Umgebungsvariablen:** in `.env`; Frontend-Variablen mit `VITE_`-Präfix; Supabase-`URL` + `anon key` dort ablegen (nie committen)
- **Ports:** Vite Dev-Server `5173`

## Wichtige Befehle

| Zweck | Befehl |
|-------|--------|
| Abhängigkeiten installieren | `bun install` |
| Dev-Server | `bun run dev` |
| Build | `bun run build` |
| Unit/Component-Tests | `bun run test` (Vitest) |
| E2E-Tests | `bun run test:e2e` (Playwright) |

## Offene Punkte

- Deployment-Ziel festlegen (Vercel / Netlify / eigener Server)
- CI/CD-Pipeline definieren

> Neue Entscheidungen hier eintragen und Status auf ✅ setzen. Größere Wahl → zusätzlich als [ADR](Entscheidungen/README.md) dokumentieren.
