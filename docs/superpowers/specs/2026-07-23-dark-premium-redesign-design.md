# Design — Dunkel-Premium Visual-Refresh (voller Politur-Pass)

- **Datum:** 2026-07-23
- **Status:** freigegeben (Design)
- **Umfang:** Rein Frontend (`Frontend/`), kein Backend/Migration/Deploy. Logik unangetastet.
- **Richtung:** „Dunkel, aber edler" — Evolution des bestehenden Dark-Themes zu einem
  kohärenten, warm-dunklen Premium-Look. Ansatz **B**: Design-System-Schicht (Tokens +
  geteilte Bausteine), angewandt auf die Kernseiten; Rest erbt über Tokens.

## Ziel

Das aktuelle Theme ist funktional, aber kalt-schwarz und flach. Der Refresh macht die App
spürbar hochwertiger: wärmerer dunkler Grundton, klare Tiefenstaffelung, Orange als Marke mit
Glow-Akzent, Gold statt blassem Gelb, feinere Typo-Hierarchie und dezente Micro-Interaktionen —
ohne Funktionsänderung und ohne neue schwere Abhängigkeiten.

## Nicht-Ziele (YAGNI)

- Kein Light-Mode (App bleibt dark-only; der vorhandene identische `.dark`-Block bleibt).
- Keine neue Font-Dependency (DM Sans bleibt).
- Keine neue Animations-/UI-Bibliothek — `tw-animate-css` ist bereits Dependency und reicht.
- Keine Betriebs-/Küchen- oder Allergen-Features (bewusst verworfen).
- Keine Logik-/Datenfluss-Änderungen; keine Backend-Berührung.

## 1. Design-Tokens (`Frontend/src/styles/theme.css`)

Einzige Quelle der Farb-/Form-Wahrheit. Änderungen wirken app-weit. Neue/aktualisierte Werte
in **`:root`** und dem gespiegelten **`.dark`**-Block (beide identisch halten):

| Token | Alt | Neu |
|---|---|---|
| `--background` | `#09090B` | `#0C0A09` |
| `--card` | `#111113` | `#17130F` |
| `--popover` (Elevation 2) | `#18181B` | `#221B15` |
| `--muted` | `#1C1C1F` | `#1C1714` |
| `--muted-foreground` | `#71717A` | `#A8A29E` |
| `--foreground` / `*-foreground` (Text-Weiß) | `#FAFAF9` | `#FAF7F2` |
| `--secondary` | `#27272A` | `#2A211B` |
| `--accent` | `#FDE68A` | `#FBBF24` |
| `--accent-foreground` | `#1C1917` | `#1C1917` (unverändert) |
| `--border` | `rgba(255,255,255,0.07)` | `rgba(255,241,230,0.08)` |
| `--sidebar-border` | `rgba(255,255,255,0.05)` | `rgba(255,241,230,0.06)` |
| `--radius` | `0.625rem` | `0.75rem` |
| `--primary` / `--ring` | `#F97316` | `#F97316` (unverändert, Marke) |

**Neue Tokens:**
- `--primary-hover: #FB8C3C`
- `--primary-glow: rgba(249, 115, 22, 0.35)` (CTA-/Focus-Glow)
- `--elevated: #221B15` (semantischer Alias für Elevation 2; via `@theme inline` als `--color-elevated`)
- `--shadow-warm: 0 8px 24px -8px rgba(0,0,0,0.6)` (warm getönte, gestaffelte Karte)

`--chart-1..5` bleiben (Orange-Reihe passt weiterhin). Im `@theme inline`-Block die neuen
Farb-Tokens als `--color-*` durchreichen, damit Tailwind-Utilities (`bg-elevated`,
`text-primary-hover`) verfügbar werden.

**Kontrast:** `--muted-foreground` wird von `#71717A` auf `#A8A29E` angehoben → erfüllt
WCAG AA gegen die dunklen Flächen (Sekundärtext war vorher grenzwertig).

## 2. Geteilte Bausteine

Neue/erweiterte Bausteine unter `Frontend/src/components/ui/` bzw. `components/common/`.
Jeder hat genau einen Zweck, klare Props, unabhängig testbar:

1. **Elevated Card** (`components/ui/card.tsx` erweitern oder `elevated-card.tsx`):
   dunkle Fläche + `--shadow-warm` + 1px **Glaskanten-Rand** oben (linear-gradient
   `rgba(255,255,255,0.08) → transparent` via Pseudo-Element/`before`), Hover: Rand hellt auf.
   Rückwärtskompatibel — bestehende `Card`-Nutzung darf nicht brechen (Variante `elevated`).
2. **Glow-CTA** (`components/ui/button.tsx`: neue Variante `glow`, oder `glow-button.tsx`):
   Primär-Button mit `box-shadow: 0 0 0 var(--primary-glow)` → Hover: Glow + `translateY(-1px)`.
   Für Haupt-Aktionen (In den Warenkorb, „Bestellen", Checkout-Submit).
3. **SectionHeader** (`components/common/section-header.tsx`): optionales Eyebrow-Label
   (klein, gesperrt, `--accent`) + Titel (groß, kräftig). Für konsistente Seiten-Hierarchie.
4. **Motion-Utilities** (`components/common/reveal.tsx` + Klassen): Fade-up-Entrance und
   Listen-Stagger über `tw-animate-css`-Utilities; `Reveal`-Wrapper (IntersectionObserver
   optional, sonst reine CSS-Animation beim Mount). Hover-Lift als Utility-Klasse.
   **Alle** Motion respektiert `@media (prefers-reduced-motion: reduce)` → Animationen aus.

## 3. Typografie (`theme.css` `@layer base`)

- Body bleibt DM Sans.
- Headings kräftiger + engeres Tracking: `h1` `font-weight: 800`, `letter-spacing: -0.02em`,
  größerer Sprung (`--text-3xl`/`4xl` auf Kernseiten-Hero); `h2` `700`. Line-heights bleiben.
- Größenkontrast erhöhen, damit Titel „premium" wirken — Detailwerte im Plan.

## 4. Anwendung auf Seiten

Tokens wirken sofort überall (auch Admin — bereits Desktop-poliert — erbt gratis). Zusätzlich
adoptieren die **Kernseiten** die neuen Bausteine:

- **Speisekarte** (`pages/menu/menu-page.tsx`): `SectionHeader`, `PizzaCard` mit Glow/Hover-Lift,
  Grid mit Fade-up-Stagger.
- **Konfigurator** (`pages/configurator/…`): Auswahlflächen als Elevated Card, Live-Vorschau betont.
- **Warenkorb/Checkout** (`pages/checkout/checkout-page.tsx`): Glow-CTA für „Bestellen",
  Bestell-Zusammenfassung als Elevated Card.
- **Bestätigung/Status** (`pages/confirmation`, `pages/status`): Premium-Bestätigungskarte.

## 5. Fehler-/Randfälle & Robustheit

- **Kein Layout-Bruch:** Nur Farb-/Tiefe-/Motion-Ebene; DOM-Struktur/Responsive-Verhalten
  (inkl. Mobile-Overflow-Netz und Breakpoints in `theme.css`) bleibt unverändert.
- **Rückwärtskompatibel:** Bestehende `Card`/`Button`-Aufrufe funktionieren weiter; neue Optik
  über Varianten, nicht durch Ersetzen der Defaults, wo das Regressionen brächte.
- **Reduced Motion:** vollständige Abschaltung aller Animationen.
- **Kontrast:** AA für Text (Sekundärtext angehoben).

## 6. Tests / Verifikation

- Bestehende `bun test src` bleiben grün (reine Logik unangetastet).
- Manuelle visuelle Prüfung der Kernseiten in Dev (`bun run dev`), Handy- und Desktop-Breite.
- Optional Playwright-Happy-Path als Rauchtest, dass nichts bricht.
- Build (`bun run build`) grün.

## Offene Punkte

- Exakte Heading-Größenwerte und PizzaCard-Hover-Details werden im Implementierungsplan
  festgezurrt (kleine Geschmacks-Iteration am lebenden Dev-Server erwartet).
