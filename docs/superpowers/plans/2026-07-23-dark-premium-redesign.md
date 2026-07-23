# Dunkel-Premium Visual-Refresh — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Das bestehende Dark-Theme zu einem warm-dunklen Premium-Look weiterentwickeln (Tokens + geteilte Bausteine + Kernseiten), ohne Logik-/Backend-Änderung.

**Architecture:** Design-System-Schicht. Alle Farb-/Form-Werte in `theme.css`-Tokens (wirken app-weit). Neue geteilte Bausteine (Elevated Card, Glow-Button-Variante, SectionHeader, Reveal-Motion) werden auf den Kernseiten adoptiert. Rest erbt über Tokens.

**Tech Stack:** React + TypeScript, Vite, Tailwind v4 (`@theme` in `theme.css`), shadcn/ui-Bausteine, `motion/react` (bereits vorhanden), `bun test` (bun:test + happy-dom + Testing Library).

## Global Constraints

- Rein Frontend unter `Frontend/`. Kein Backend, keine Migration, kein Deploy.
- Dark-only. `:root` und `.dark` in `theme.css` identisch halten.
- Keine neue Dependency. Motion über bestehendes `motion/react`.
- Marke: `--primary`/`--ring` bleiben `#F97316`.
- Rückwärtskompatibel: bestehende `Card`/`Button`-Aufrufe dürfen nicht brechen (neue Optik über Prop/Variante).
- Alle Animationen respektieren `prefers-reduced-motion`.
- Tests: `bun test src` bleibt grün; `bun run build` grün. Befehle laufen in `Frontend/`.
- Spec: `docs/superpowers/specs/2026-07-23-dark-premium-redesign-design.md`.

---

### Task 1: Design-Tokens & Typografie in `theme.css`

**Files:**
- Modify: `Frontend/src/styles/theme.css` (`:root` L3-42, `.dark` L44-81, `@theme inline` L83-127, `@layer base` L129-159)

**Interfaces:**
- Produces: neue CSS-Variablen `--primary-hover`, `--primary-glow`, `--elevated`, `--shadow-warm` und Tailwind-Farbe `--color-elevated`; geänderte Grundpalette. Spätere Tasks nutzen `bg-elevated`, `text-primary-hover`, `shadow-[var(--shadow-warm)]`, `var(--primary-glow)`.

- [ ] **Step 1: Werte in `:root` UND `.dark` ändern** (beide Blöcke identisch)

Ersetze in beiden Blöcken die Zeilen:
```css
--background: #0C0A09;
--foreground: #FAF7F2;
--card: #17130F;
--card-foreground: #FAF7F2;
--popover: #221B15;
--popover-foreground: #FAF7F2;
--primary: #F97316;
--primary-foreground: #FFFFFF;
--secondary: #2A211B;
--secondary-foreground: #FAF7F2;
--muted: #1C1714;
--muted-foreground: #A8A29E;
--accent: #FBBF24;
--accent-foreground: #1C1917;
--border: rgba(255, 241, 230, 0.08);
--ring: #F97316;
--radius: 0.75rem;
--sidebar: #0D0D10;
--sidebar-border: rgba(255, 241, 230, 0.06);
```
(Die übrigen `--sidebar-*`, `--chart-*`, `--destructive*`, `--switch-background`, `--input*`, `--font-*` bleiben unverändert. `--foreground`/`*-foreground`, die auf `#FAFAF9` standen, gehen auf `#FAF7F2`.)

- [ ] **Step 2: Neue Tokens am Ende beider Blöcke ergänzen**
```css
--primary-hover: #FB8C3C;
--primary-glow: rgba(249, 115, 22, 0.35);
--elevated: #221B15;
--shadow-warm: 0 8px 24px -8px rgba(0, 0, 0, 0.6);
```

- [ ] **Step 3: Im `@theme inline`-Block neue Farb-Tokens durchreichen** (nach `--color-popover-foreground`)
```css
--color-elevated: var(--elevated);
--color-primary-hover: var(--primary-hover);
```

- [ ] **Step 4: Typografie in `@layer base` schärfen** — ersetze die `h1`/`h2`-Zeilen (L148-149):
```css
h1 { font-size: var(--text-3xl); font-weight: 800; line-height: 1.15; letter-spacing: -0.02em; }
h2 { font-size: var(--text-xl); font-weight: 700; line-height: 1.25; letter-spacing: -0.01em; }
```

- [ ] **Step 5: Glaskanten-Utility am Ende von `@layer base` ergänzen** (für Elevated Card in Task 3)
```css
.card-glass-edge { position: relative; }
.card-glass-edge::before {
  content: ""; position: absolute; inset: 0; border-radius: inherit; padding-top: 1px;
  background: linear-gradient(to bottom, rgba(255,255,255,0.08), transparent 40%);
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor; mask-composite: exclude; pointer-events: none;
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.001ms !important; transition-duration: 0.001ms !important; }
}
```

- [ ] **Step 6: Build verifizieren**

Run: `cd Frontend && bun run build`
Expected: PASS (kein CSS-/Tailwind-Fehler), Farben app-weit sichtbar geändert.

- [ ] **Step 7: Commit**
```bash
git add Frontend/src/styles/theme.css
git commit -m "feat(ui): warm-dark premium tokens + typography in theme.css"
```

---

### Task 2: Glow-Variante für Button

**Files:**
- Modify: `Frontend/src/components/ui/button.tsx:6-36`
- Test: `Frontend/src/components/ui/button.test.tsx` (Create)

**Interfaces:**
- Consumes: `--primary-glow` (Task 1).
- Produces: `<Button variant="glow">` — neue cva-Variante. Spätere Tasks nutzen sie für Haupt-CTAs.

- [ ] **Step 1: Failing test schreiben** (`button.test.tsx`)
```tsx
import { render, screen } from "@testing-library/react";
import { test, expect } from "bun:test";
import { Button } from "./button";

test("glow variant renders with glow class", () => {
  render(<Button variant="glow">Bestellen</Button>);
  const btn = screen.getByRole("button", { name: "Bestellen" });
  expect(btn.className).toContain("shadow-[0_0_0_var(--primary-glow)]");
});
```

- [ ] **Step 2: Test ausführen — muss fehlschlagen**

Run: `cd Frontend && bun test src/components/ui/button.test.tsx`
Expected: FAIL (Variante existiert nicht → keine glow-Klasse).

- [ ] **Step 3: `glow`-Variante in `buttonVariants` ergänzen** (nach `default:`-Eintrag, L12)
```ts
glow:
  "bg-primary text-primary-foreground shadow-[0_0_0_var(--primary-glow)] hover:bg-primary-hover hover:-translate-y-px hover:shadow-[0_6px_24px_-4px_var(--primary-glow)]",
```

- [ ] **Step 4: Test ausführen — muss bestehen**

Run: `cd Frontend && bun test src/components/ui/button.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add Frontend/src/components/ui/button.tsx Frontend/src/components/ui/button.test.tsx
git commit -m "feat(ui): add glow button variant"
```

---

### Task 3: Elevated-Variante für Card

**Files:**
- Modify: `Frontend/src/components/ui/card.tsx:4-13`
- Test: `Frontend/src/components/ui/card.test.tsx` (Create)

**Interfaces:**
- Consumes: `--shadow-warm`, `.card-glass-edge` (Task 1).
- Produces: `<Card elevated>` — optionales Prop. Default-Verhalten unverändert (rückwärtskompatibel).

- [ ] **Step 1: Failing test schreiben** (`card.test.tsx`)
```tsx
import { render, screen } from "@testing-library/react";
import { test, expect } from "bun:test";
import { Card } from "./card";

test("elevated card adds glass edge + warm shadow", () => {
  render(<Card elevated data-testid="c">x</Card>);
  const el = screen.getByTestId("c");
  expect(el.className).toContain("card-glass-edge");
  expect(el.className).toContain("bg-elevated");
});

test("default card stays unchanged (no glass edge)", () => {
  render(<Card data-testid="d">y</Card>);
  expect(screen.getByTestId("d").className).not.toContain("card-glass-edge");
});
```

- [ ] **Step 2: Test ausführen — muss fehlschlagen**

Run: `cd Frontend && bun test src/components/ui/card.test.tsx`
Expected: FAIL (`elevated`-Prop existiert nicht).

- [ ] **Step 3: `Card` um `elevated`-Prop erweitern** (ersetze L4-13)
```tsx
const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { elevated?: boolean }
>(({ className, elevated = false, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "bg-card text-card-foreground border border-border rounded-2xl",
      elevated && "bg-elevated card-glass-edge shadow-[var(--shadow-warm)]",
      className
    )}
    {...props}
  />
));
```

- [ ] **Step 4: Test ausführen — muss bestehen**

Run: `cd Frontend && bun test src/components/ui/card.test.tsx`
Expected: PASS (beide Tests).

- [ ] **Step 5: Commit**
```bash
git add Frontend/src/components/ui/card.tsx Frontend/src/components/ui/card.test.tsx
git commit -m "feat(ui): add elevated card variant"
```

---

### Task 4: SectionHeader-Komponente

**Files:**
- Create: `Frontend/src/components/common/section-header.tsx`
- Test: `Frontend/src/components/common/section-header.test.tsx`

**Interfaces:**
- Produces: `SectionHeader({ eyebrow?: string; title: string; className?: string }): React.ReactElement`.

- [ ] **Step 1: Failing test schreiben**
```tsx
import { render, screen } from "@testing-library/react";
import { test, expect } from "bun:test";
import { SectionHeader } from "./section-header";

test("renders title always and eyebrow when given", () => {
  render(<SectionHeader eyebrow="Speisekarte" title="Unsere Pizzen" />);
  expect(screen.getByRole("heading", { name: "Unsere Pizzen" })).toBeDefined();
  expect(screen.getByText("Speisekarte")).toBeDefined();
});

test("omits eyebrow when not provided", () => {
  render(<SectionHeader title="Nur Titel" />);
  expect(screen.queryByTestId("eyebrow")).toBeNull();
});
```

- [ ] **Step 2: Test ausführen — muss fehlschlagen**

Run: `cd Frontend && bun test src/components/common/section-header.test.tsx`
Expected: FAIL (Modul fehlt).

- [ ] **Step 3: Komponente schreiben**
```tsx
import type React from "react";
import { cn } from "@/lib/utils";

export function SectionHeader({ eyebrow, title, className }: {
  eyebrow?: string;
  title: string;
  className?: string;
}): React.ReactElement {
  return (
    <div className={cn("mb-4", className)}>
      {eyebrow ? (
        <p data-testid="eyebrow" className="text-xs font-semibold uppercase tracking-widest text-accent mb-1">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="text-2xl font-extrabold tracking-tight">{title}</h2>
    </div>
  );
}
```

- [ ] **Step 4: Test ausführen — muss bestehen**

Run: `cd Frontend && bun test src/components/common/section-header.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add Frontend/src/components/common/section-header.tsx Frontend/src/components/common/section-header.test.tsx
git commit -m "feat(ui): add SectionHeader component"
```

---

### Task 5: Reveal-Motion-Utility

**Files:**
- Create: `Frontend/src/components/common/reveal.tsx`
- Test: `Frontend/src/components/common/reveal.test.tsx`

**Interfaces:**
- Consumes: `motion/react` (bereits Dependency).
- Produces: `Reveal({ children, delay?: number, className?: string }): React.ReactElement` — Fade-up beim Mount; bei `useReducedMotion()` ohne Animation.

- [ ] **Step 1: Failing test schreiben** (rendert Kinder; Motion-Details sind visuell)
```tsx
import { render, screen } from "@testing-library/react";
import { test, expect } from "bun:test";
import { Reveal } from "./reveal";

test("renders children", () => {
  render(<Reveal><span>Inhalt</span></Reveal>);
  expect(screen.getByText("Inhalt")).toBeDefined();
});
```

- [ ] **Step 2: Test ausführen — muss fehlschlagen**

Run: `cd Frontend && bun test src/components/common/reveal.test.tsx`
Expected: FAIL (Modul fehlt).

- [ ] **Step 3: Komponente schreiben**
```tsx
import type React from "react";
import { motion, useReducedMotion } from "motion/react";

export function Reveal({ children, delay = 0, className }: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}): React.ReactElement {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ delay, duration: 0.3 }}
    >
      {children}
    </motion.div>
  );
}
```

- [ ] **Step 4: Test ausführen — muss bestehen**

Run: `cd Frontend && bun test src/components/common/reveal.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add Frontend/src/components/common/reveal.tsx Frontend/src/components/common/reveal.test.tsx
git commit -m "feat(ui): add Reveal motion utility"
```

---

### Task 6: PizzaCard aufwerten (Glow + Hover-Lift)

**Files:**
- Modify: `Frontend/src/components/pizza/pizza-card.tsx:20-58`

**Interfaces:**
- Consumes: bestehende `motion/react`-Wrapper; Tokens aus Task 1.

- [ ] **Step 1: Karten-Container aufwerten** — ersetze das äußere `<div>` (L21-23) durch:
```tsx
<div className="rounded-2xl overflow-hidden border border-border bg-card
  group-hover:border-primary/50 group-hover:-translate-y-0.5 group-hover:shadow-[var(--shadow-warm)]
  group-active:scale-[0.98] transition-all duration-200 shadow-sm">
```

- [ ] **Step 2: CTA-Zeile aufwerten** — ersetze das „In den Warenkorb"-`<div>` (L52-56) durch:
```tsx
<div className="mt-3 w-full bg-primary/10 border border-primary/20 rounded-lg py-2
  text-xs font-bold text-primary text-center
  group-hover:bg-primary group-hover:text-primary-foreground group-hover:shadow-[0_4px_16px_-4px_var(--primary-glow)]
  transition-all duration-200">
  + In den Warenkorb
</div>
```

- [ ] **Step 3: Bestehende Tests + Build grün**

Run: `cd Frontend && bun test src && bun run build`
Expected: PASS (reine Klassen-Änderung, keine Logik).

- [ ] **Step 4: Commit**
```bash
git add Frontend/src/components/pizza/pizza-card.tsx
git commit -m "feat(ui): premium hover glow/lift on PizzaCard"
```

---

### Task 7: Speisekarte-Header

**Files:**
- Modify: `Frontend/src/pages/menu/menu-page.tsx`

**Interfaces:**
- Consumes: `SectionHeader` (Task 4).

- [ ] **Step 1: Graphify orientieren, dann Datei lesen**

Run: `graphify explain "menu-page" ; graphify query "Wie ist der Header/Titel der Speisekarte menu-page aufgebaut?"` (im Repo-Root).
Dann `menu-page.tsx` lesen, um die vorhandene Titel-/Header-Zeile zu finden.

- [ ] **Step 2: `SectionHeader` importieren und die bestehende Seiten-Überschrift ersetzen**

Import ergänzen:
```tsx
import { SectionHeader } from "@/components/common/section-header";
```
Die vorhandene Titel-Zeile der Speisekarte durch
```tsx
<SectionHeader eyebrow="Speisekarte" title="Unsere Pizzen" />
```
ersetzen (Text an den bestehenden Titel anpassen, falls abweichend). Nur die Überschrift ersetzen — Menü-Grid/Logik unverändert.

- [ ] **Step 3: Tests + Build grün**

Run: `cd Frontend && bun test src && bun run build`
Expected: PASS.

- [ ] **Step 4: Commit**
```bash
git add Frontend/src/pages/menu/menu-page.tsx
git commit -m "feat(ui): SectionHeader on Speisekarte"
```

---

### Task 8: Checkout — Glow-CTA + Elevated Zusammenfassung

**Files:**
- Modify: `Frontend/src/pages/checkout/checkout-page.tsx`

**Interfaces:**
- Consumes: `Button variant="glow"` (Task 2), `Card elevated` (Task 3).

- [ ] **Step 1: Graphify orientieren, dann Datei lesen**

Run: `graphify explain "CheckoutPage" ; graphify query "Wo ist der Bestellen-Button und die Bestell-Zusammenfassung im checkout-page?"` (im Repo-Root).
Dann `checkout-page.tsx` lesen, um den Submit-Button und die Summen-/Zusammenfassungs-Card zu finden.

- [ ] **Step 2: Haupt-CTA auf Glow-Variante setzen**

Am „Bestellen"-Button `variant="glow"` und `size="lg"` setzen (bestehende `onClick`/`disabled`-Logik unverändert lassen).

- [ ] **Step 3: Zusammenfassungs-Card auf `elevated`**

Falls die Bestell-Zusammenfassung eine `<Card>` nutzt: `elevated` ergänzen. Falls sie ein rohes `<div className="bg-card …">` ist: Klassen `bg-elevated card-glass-edge shadow-[var(--shadow-warm)]` ergänzen.

- [ ] **Step 4: Tests + Build grün**

Run: `cd Frontend && bun test src && bun run build`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add Frontend/src/pages/checkout/checkout-page.tsx
git commit -m "feat(ui): glow CTA + elevated summary on Checkout"
```

---

### Task 9: Bestätigung & Status — Premium-Karte

**Files:**
- Modify: `Frontend/src/pages/confirmation/` (Bestätigungsseite), `Frontend/src/pages/status/order-status-page.tsx`

**Interfaces:**
- Consumes: `Card elevated` (Task 3), optional `Reveal` (Task 5).

- [ ] **Step 1: Graphify orientieren, dann Dateien lesen**

Run: `graphify query "Wo ist die Bestätigungsseite (confirmation) und die öffentliche Bestell-Status-Seite und welche Karte zeigt Bestellnummer/QR/Status?"` (im Repo-Root).
Dann die beiden Seiten lesen, um die Haupt-Karte zu finden.

- [ ] **Step 2: Haupt-Karte auf `elevated` heben**

Die zentrale Bestätigungs-/Status-Karte auf `<Card elevated>` (oder Klassen `bg-elevated card-glass-edge shadow-[var(--shadow-warm)]`) umstellen. Inhalt/QR/Polling-Logik unverändert.

- [ ] **Step 3: Tests + Build grün**

Run: `cd Frontend && bun test src && bun run build`
Expected: PASS.

- [ ] **Step 4: Commit**
```bash
git add Frontend/src/pages/confirmation Frontend/src/pages/status/order-status-page.tsx
git commit -m "feat(ui): premium elevated card on Bestätigung/Status"
```

---

### Task 10: Konfigurator — Auswahlflächen aufwerten

**Files:**
- Modify: `Frontend/src/pages/configurator/` (Konfigurator-Seite)

**Interfaces:**
- Consumes: `Card elevated` (Task 3), Tokens.

- [ ] **Step 1: Graphify orientieren, dann Datei lesen**

Run: `graphify query "Wo ist die Konfigurator-Seite und wie sind Zutaten-Auswahl und Live-Vorschau aufgebaut?"` (im Repo-Root).
Dann die Konfigurator-Seite lesen.

- [ ] **Step 2: Vorschau-/Auswahlcontainer aufwerten**

Den Live-Vorschau-Container und die Zutaten-Auswahlfläche auf `bg-elevated card-glass-edge shadow-[var(--shadow-warm)]` (bzw. `<Card elevated>`) heben. Auswahllogik unverändert.

- [ ] **Step 3: Tests + Build grün**

Run: `cd Frontend && bun test src && bun run build`
Expected: PASS.

- [ ] **Step 4: Commit**
```bash
git add Frontend/src/pages/configurator
git commit -m "feat(ui): elevated surfaces on Konfigurator"
```

---

### Task 11: Verifikation & Doku

**Files:**
- Modify: `Doku/Pizza/Changelog.md`, `Doku/Pizza/TODO.md`, `Doku/Pizza/Frontend/README.md`

**Interfaces:** —

- [ ] **Step 1: Volle Suite grün**

Run: `cd Frontend && bun test src && bun run build`
Expected: PASS (alle bestehenden Tests + neue Komponententests).

- [ ] **Step 2: Manueller Sichttest**

Run: `cd Frontend && bun run dev`
Prüfen (Handy- und Desktop-Breite): Speisekarte (Hover-Glow/Lift, SectionHeader), Checkout (Glow-CTA, elevated Summary), Bestätigung/Status (Premium-Karte), Konfigurator. Optional: OS „reduce motion" aktiv → keine Animationen.

- [ ] **Step 3: Doku ergänzen** (Wikilinks gemäß CLAUDE.md-Konvention)

- `Changelog.md`: neuer `## 2026-07-23`-Eintrag „Dunkel-Premium Visual-Refresh".
- `TODO.md`: den Redesign-Punkt als erledigt markieren bzw. ergänzen.
- `Frontend/README.md`: neue Bausteine (Elevated Card, Glow-Button, `SectionHeader`, `Reveal`) kurz notieren; verweist auf [[Sonderartikel-VIP]] etc. nach bestehendem Muster.

- [ ] **Step 4: Commit**
```bash
git add Doku/Pizza/Changelog.md Doku/Pizza/TODO.md Doku/Pizza/Frontend/README.md
git commit -m "docs: dark-premium visual refresh"
```

---

## Self-Review

- **Spec-Abdeckung:** Tokens (Task 1) ✓ · Bausteine Elevated Card/Glow/SectionHeader/Motion (Tasks 2-5) ✓ · Typografie (Task 1 Step 4) ✓ · Kernseiten Speisekarte/Checkout/Bestätigung-Status/Konfigurator (Tasks 6-10) ✓ · Robustheit/Reduced-Motion (Task 1 Step 5, Task 5) ✓ · Tests/Build (jede Task + Task 11) ✓.
- **Platzhalter:** keine — konkrete Werte/Code in jedem Schritt; die Seiten-Tasks (7-10) enthalten einen expliziten Graphify-Orientierungs- + Lese-Schritt, weil exakte Zeilen dort erst zur Laufzeit feststehen (bewusst, kein „TODO").
- **Typ-Konsistenz:** `Button variant="glow"`, `Card elevated`, `SectionHeader({eyebrow?,title})`, `Reveal({children,delay?})` durchgängig gleich benannt.
- **Motion-Korrektur ggü. Spec:** Spec nannte `tw-animate-css`; da `motion/react` bereits genutzt wird (PizzaCard), baut Task 5 idiomatisch darauf — kein Widerspruch, dieselbe Wirkung ohne neue Lib.
