# Teil-A — Frontend-Fundament (Design-Spec)

- **Datum:** 2026-07-09
- **Status:** Entwurf → zur Freigabe
- **Teil-Projekt:** A von 3 (A Frontend-Fundament · B Supabase-Backend · C Capacitor-Mobile)

---

## 1. Kontext & Roadmap

Das Pizza-Projekt basiert auf einer Figma-Make-Vorlage (`Frontend vorlage/`): eine reine
Web-App (Vite + React 18 + Tailwind v4 + shadcn/ui), deren **gesamte Logik in einer ~90 KB
großen `App.tsx`** liegt. Ziel ist eine wartbare App für **Web + iOS + Android** mit echtem
Backend.

Das Vorhaben wurde in drei unabhängige Teil-Projekte zerlegt (je eigene Spec → Plan → Umsetzung):

| # | Teil-Projekt | Kernentscheidungen |
|---|---|---|
| **A** | **Frontend-Fundament** (diese Spec) | Sauberer Neuaufbau in `Frontend/`, Vorlage als Referenz. Mock-Datenschicht. Bun statt pnpm. MUI raus. |
| **B** | Supabase-Backend | Postgres-Schema, echte Admin-Auth, **Bestell-Status-Workflow + Realtime-Live-Liste**, **WhatsApp-Benachrichtigung via CallMeBot** (Edge Function), serverseitige Validierung. |
| **C** | Capacitor-Mobile | iOS/Android-Wrapper, QR/Push, Icons/Splash, Store-Konfiguration. |

Reihenfolge **A → B → C**: A liefert das Fundament, B ersetzt die Mock-Daten durch echte
Queries, C verpackt das Ergebnis nativ.

## 2. Ziel von Teil-A

`Frontend/` läuft eigenständig mit `bun run dev` und bildet **alle Funktionen der Vorlage in
Feature-Parität** ab — auf Basis einer sauberen, testbaren Struktur und einer **Mock-Datenschicht**,
die in Teil-B nahtlos gegen Supabase getauscht werden kann.

### Nicht-Ziele (kommen in B/C)
- Kein echtes Supabase — nur die Mock-Datenschicht (die Naht steht).
- Keine echte Admin-Auth — Login prüft weiter clientseitig gegen Mock (Passwort-Konstante bleibt
  vorerst, **klar als Teil-B-TODO markiert**).
- Kein Bestell-Status-Workflow / Realtime, keine WhatsApp-Nachricht (Teil-B).
- Kein Capacitor/native Build, kein Deployment/CI (Teil-C bzw. offen).

## 3. Ordnerstruktur (`Frontend/`)

```
Frontend/
├── index.html                 # sauberer Titel/Meta (PWA-Meta erst in Teil-C)
├── package.json               # Bun-Scripts, MUI raus
├── vite.config.ts             # @tailwindcss/vite; figma-asset-resolver raus; @-Alias behalten
├── tsconfig.json
├── vitest.config.ts           # Unit/Component
├── playwright.config.ts       # E2E
└── src/
    ├── main.tsx
    ├── app.tsx                # Root: Provider (Cart) + Router
    ├── pages/                 # 1 Ordner pro Route
    │   ├── menu/              # Speisekarte
    │   ├── configurator/      # Eigene Pizza
    │   ├── checkout/          # Warenkorb/Bestellung
    │   ├── confirmation/      # Bestätigung + QR
    │   └── admin/             # login, dashboard, days, hours, ingredients, vouchers, lead-time
    ├── components/
    │   ├── ui/                # shadcn-Primitives (aus Vorlage übernommen)
    │   ├── pizza/             # PizzaSVG + Topping-Renderer, PizzaCard
    │   ├── layout/            # BottomNav, AdminShell
    │   └── common/            # SelectInput, QrCode, Charts (Bar/Donut)
    ├── hooks/                 # use-cart, use-menu, use-vouchers, use-opening-hours …
    ├── lib/
    │   ├── utils.ts           # cn()
    │   ├── data/              # ← Datenschicht-Naht (Mock-Impl.)
    │   └── slots.ts           # reine Slot-/Vorlaufzeit-Logik (Vitest-testbar)
    ├── types/                 # Domänentypen (pizza, order, voucher, ingredient, hours, config)
    └── styles/                # fonts/theme/tailwind (1:1 aus Vorlage)
```

Konvention (SETUP-konform): Dateinamen `kebab-case`, Komponenten-Bezeichner `PascalCase`
(wie shadcn: `pizza-card.tsx` → `PizzaCard`).

## 4. Aufteilung des Monolithen (Feature-Parität)

Die `App.tsx` enthält intern bereits saubere Teil-Komponenten und viele reine, portable Teile.
Der Neuaufbau ist damit primär Extrahieren + Struktur + Datenschicht, nicht Neuerfindung.

| Aus `App.tsx` | Landet in |
|---|---|
| `type`/`interface` (Ingredient, Voucher, Cart, Order, Hours, …) | `src/types/` |
| Konstanten (`TEMPLATES`, `INGREDIENTS_DEFAULT`, `VOUCHERS_INIT`, `DAYS_OF_WEEK`, …) | `src/lib/data/` (Mock-Seed) |
| `PizzaSVG` + alle `*T`-Topping-Renderer | `components/pizza/` |
| `QRCode`, `SvgBarChart`, `SvgDonutChart`, `SelectInput` | `components/common/` |
| `BottomNav`, `AdminShell` | `components/layout/` |
| `HomePage` / `ConfiguratorPage` / `CheckoutPage` / `ConfirmationPage` | `pages/menu\|configurator\|checkout\|confirmation/` |
| `AdminLogin` / `Dashboard` / `Days` / `Hours` / `Ingredients` / `Vouchers` | `pages/admin/*` |

## 5. State & Datenfluss

- **Routing:** `react-router` (bereits Dependency) statt View-State. Kunde: `/`, `/konfigurator`,
  `/warenkorb`, `/bestaetigung`. Admin: `/admin`, `/admin/dashboard`, `/admin/tage`,
  `/admin/oeffnungszeiten`, `/admin/zutaten`, `/admin/gutscheine`, `/admin/vorlaufzeit`.
  `BottomNav` wird echte Navigation.
- **Warenkorb:** `useCart`-Hook (Context) — Positionen, Anzahl, Gutschein. Ersetzt den
  durchgereichten Prop-State. **Persistenz via `localStorage`** (überlebt Reload/App-Neustart).
- **Datenschicht-Naht (`lib/data/`):** Alle Daten laufen über **async Funktionen** —
  `getMenu()`, `getIngredients()`, `getVouchers()`, `getOpeningHours()`, `getLeadTimeDays()`,
  `createOrder()`, sowie Admin-Mutationen (`upsertIngredient()`, `setDays()`, …).
  In A liefern diese **Mock-Daten** (Vorlage-Konstanten als Seed; Admin-Änderungen in
  `localStorage`). In **Teil-B** wird nur die Implementierung gegen Supabase-Queries getauscht —
  **die UI bleibt unverändert**.

## 6. Bestell-Vorlaufzeit

Neue Regel zusätzlich zu erlaubten Wochentagen + Öffnungszeiten:

- **Frühestes wählbares Datum = erster erlaubter Wochentag ≥ heute + Vorlaufzeit.**
  Beispiel: heute Mi, Vorlaufzeit 3 → frühestens Sa; ist Sa erlaubt, ist das der früheste Slot,
  sonst der nächste erlaubte Tag.
- **Vorlaufzeit ist Admin-Einstellung** (`Vorlaufzeit in Tagen`, Default **3**), Seite
  `/admin/vorlaufzeit`. Kein Rebuild zum Ändern nötig.
- Umgesetzt als reine Funktion in `lib/slots.ts`, z. B.
  `getSelectableDates(config, today)` und `isSlotAllowed(date, time, config)` —
  **Vitest-testbar** und in Teil-B 1:1 serverseitig wiederverwendbar (Client-Werte nie blind
  vertrauen).

## 7. Async-Zustände

Da alle Daten über die async Datenschicht-Naht laufen, bekommt **jede datenabhängige Seite**
schon in Teil-A **Lade-, Fehler- und Leer-Zustände** (mit künstlichem Mock-Delay testbar), statt
sie in B nachzurüsten.

## 8. Tooling & Bereinigung

- **Bun statt pnpm:** `pnpm-workspace.yaml` entfällt; `package.json`-Scripts auf Bun.
  Install `bun install`, Dev `bun run dev`, Build `bun run build`.
  **Tests über Vitest** (`bun run test`), **nicht** `bun test`. E2E `bun run test:e2e`.
- **MUI entfernen:** `@mui/material`, `@mui/icons-material`, `@emotion/*` raus (zweites,
  ungenutztes UI-System neben shadcn). Ebenfalls prüfen und nur bei echtem Bedarf behalten:
  `react-slick`, `react-dnd`, `react-responsive-masonry`, `@popperjs/*`, `canvas-confetti`.
- **Styles 1:1:** `fonts.css`, `theme.css` (oranges Dark-Theme, `--primary: #F97316`),
  `tailwind.css` unverändert nach `src/styles/`. Tailwind v4 via `@tailwindcss/vite`.
- **`vite.config.ts` säubern:** `figmaAssetResolver` raus; `@`-Alias behalten;
  GitHub-Pages-`base` bewusst offen (Deployment 🕓, für Capacitor evtl. irrelevant).
- **`index.html`:** echter Titel/Meta statt „Markdown Page".

## 9. Tests

- **Vitest (Kernlogik):** Preis-/Gutscheinberechnung (Prozent, fester Betrag, Sonderzutat) und
  Slot-/Vorlaufzeit-Logik (`lib/slots.ts`).
- **Playwright (Happy-Path-E2E):** Pizza wählen → Warenkorb → Slot & Name → bestellen →
  Bestätigung mit QR. Sichert Feature-Parität nach dem Refactor ab.

## 10. Definition of Done (Teil-A)

- `Frontend/` startet mit `bun run dev`; alle Seiten der Vorlage funktionieren mit Mock-Daten in
  Feature-Parität.
- Vorlaufzeit (Default 3, Admin-konfigurierbar) greift in der Datumsauswahl.
- Warenkorb persistent; datenabhängige Seiten haben Lade-/Fehler-/Leer-Zustände.
- MUI- und Figma-Make-Altlasten entfernt; nur Bun als Package-Manager.
- `bun run test` (Vitest) und der Playwright-Happy-Path grün.

## 11. Vorgemerkt für Teil-B/C (damit nichts verloren geht)

- **B:** Supabase-Schema (orders inkl. **Status** `neu → angenommen → fertig → abgeholt`,
  ingredients, vouchers, opening_hours, config/lead_time); echte Admin-Auth (Passwort-Konstante
  ablösen); **Realtime-Live-Liste** offener Bestellungen im Admin; **WhatsApp via CallMeBot** in
  Edge Function bei neuer Bestellung; serverseitige Vorlauf-/Preis-Validierung;
  Telefonnummer-Validierung. Nice-to-have: WhatsApp-Bestätigung auch an den Kunden.
- **C:** Capacitor iOS/Android; QR-Anzeige nativ, ggf. Push; App-Icons/Splash; Safe-Area/Notch;
  PWA-/App-Meta; Store-Konfiguration.
- **Projekt-Doku (CLAUDE.md-System):** bei Umsetzung ADRs anlegen (Capacitor als Mobile-Weg,
  Supabase als Backend, WhatsApp via CallMeBot), `Changelog.md`/`TODO.md` pflegen.
