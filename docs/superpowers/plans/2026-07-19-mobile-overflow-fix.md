# Mobile-Overflow-Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keine Route erzeugt bei 360 px Viewport-Breite noch horizontalen Überlauf — das „Herauszoomen-Müssen" am Handy verschwindet.

**Architecture:** Zwei Ebenen. (1) Ein globales CSS-Sicherheitsnetz in `theme.css` verhindert horizontalen Überlauf grundsätzlich. (2) Ein empirischer Audit misst jede Route bei 360 px im Browser und behebt echte Überläufe an der Quelle (Umbruch/`min-w-0`/`truncate`/gekapseltes Scroll-Raster), damit kein Inhalt still abgeschnitten wird.

**Tech Stack:** React 19 + Vite, Tailwind v4 (CSS-basiert, `@layer base` in `theme.css`), Bun (`bun run dev`, `bunx tsc --noEmit`, `bun run build`), chrome-devtools-MCP zum Messen.

## Global Constraints

- Kein Desktop-/PC-Layout, keine Navigations- oder Strukturänderung, keine funktionalen/inhaltlichen Änderungen — nur Überlauf-Behebung.
- Kein pauschales `overflow-x: hidden` auf Einzelkomponenten als Ersatz für einen echten Quell-Fix; das globale Netz ist Absicherung, nicht der alleinige Fix.
- Messkriterium überall: `document.documentElement.scrollWidth <= document.documentElement.clientWidth` bei 360 px Breite.
- Abschluss-Gates: `bunx tsc --noEmit` grün, `bun run build` grün, bestehende Unit-Tests grün, keine sichtbare Inhaltsabschneidung.
- Arbeit auf einem Feature-Branch, nicht direkt auf `main`.

---

### Task 1: Branch + globales Overflow-Sicherheitsnetz

**Files:**
- Branch: `feat/mobile-overflow-fix` (von `main`)
- Modify: `Frontend/src/styles/theme.css` (`@layer base`, ab Zeile 124)

**Interfaces:**
- Consumes: nichts.
- Produces: globale CSS-Regel, die horizontalen Überlauf auf `html`/`body` unterbindet. Keine JS-/TS-API.

- [ ] **Step 1: Branch anlegen**

```bash
cd "C:/Users/Anwender/Desktop/Website/Pizza"
git checkout main
git checkout -b feat/mobile-overflow-fix
```

- [ ] **Step 2: Baseline messen (Beweis, dass etwas überläuft — oder nicht)**

```bash
cd "C:/Users/Anwender/Desktop/Website/Pizza/Frontend"
bun run dev
```

Dann im Browser über chrome-devtools-MCP: Seite `/login` bei 360×740 laden und messen:

```js
({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
   overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth })
```

Erwartung dokumentieren (overflow true/false). Dieser Wert ist der Vorher-Beleg für Task 2.

- [ ] **Step 3: Globales Sicherheitsnetz einfügen**

In `Frontend/src/styles/theme.css`, innerhalb `@layer base`, direkt nach dem `html { font-size: var(--font-size); }`-Block, ergänzen:

```css
  html, body {
    overflow-x: hidden;
    max-width: 100%;
  }
```

(Der bestehende `html { font-size: … }`-Block bleibt unverändert; diese Regel kommt zusätzlich.)

- [ ] **Step 4: Prüfen, dass `/login` bei 360 px keinen Überlauf mehr hat**

Browser neu laden (Vite HMR), erneut messen mit dem Snippet aus Step 2.
Erwartung: `overflow: false`. Sichtprüfung: Login-Karte vollständig sichtbar, nichts abgeschnitten.

- [ ] **Step 5: Build-Gate**

```bash
cd "C:/Users/Anwender/Desktop/Website/Pizza/Frontend"
bunx tsc --noEmit
bun run build
```

Erwartung: beide ohne Fehler.

- [ ] **Step 6: Commit**

```bash
cd "C:/Users/Anwender/Desktop/Website/Pizza"
git add Frontend/src/styles/theme.css
git commit -m "fix(css): globales horizontal-overflow-Sicherheitsnetz (html/body)"
```

---

### Task 2: Empirischer Audit aller Routen + Quell-Fixes

**Files:**
- Modify: 0–n Dateien unter `Frontend/src/pages/**` bzw. `Frontend/src/components/**` — ausschließlich die, bei denen die Messung tatsächlich Überlauf zeigt.

**Interfaces:**
- Consumes: das globale Netz aus Task 1 (verhindert sichtbaren Überlauf; der Audit deckt trotzdem echte Überläufe auf, weil gemessen wird, ob Inhalt *breiter als der Container* ist — s. Mess-Snippet).
- Produces: keine neue API; nur Layout-Härtung bestehender Markup-Stellen.

**Hinweis zur Messung trotz `overflow-x: hidden`:** Da das globale Netz Überlauf kaschieren kann, wird pro Route nicht `documentElement.scrollWidth` allein geprüft, sondern das **breiteste Element** relativ zum Viewport gesucht:

```js
[...document.querySelectorAll('body *')]
  .map(el => ({ w: el.getBoundingClientRect().right, tag: el.tagName, cls: el.className?.toString?.().slice(0,80) }))
  .filter(x => x.w > window.innerWidth + 1)
  .sort((a,b) => b.w - a.w).slice(0, 8)
```

Eine nicht-leere Liste = echter Überlauf an dieser Route; die obersten Einträge zeigen das/die schuldigen Elemente.

- [ ] **Step 1: Routen-Checkliste anlegen**

Öffentliche/Kunden-Routen (ohne Login messbar bzw. mit Test-Login): `/login`, `/passwort-reset`, `/`, `/konfigurator`, `/warenkorb` (leer und mit ≥1 Position), `/bestaetigung`, `/meine-bestellungen`, `/profil`, `/bestellung/<token>`.
Admin-Routen (Test-Login nötig): `/admin/bestellungen`, `/admin/dashboard`, `/admin/tage`, `/admin/oeffnungszeiten`, `/admin/vorlaufzeit`, `/admin/service`, `/admin/zutaten`, `/admin/sossen`, `/admin/gutscheine`, `/admin/sonderartikel`, `/admin/nutzer`, `/admin/benachrichtigungen`, `/admin/einstellungen`.

- [ ] **Step 2: Jede erreichbare Route bei 360 px messen**

Für jede Route: bei 360×740 laden, das Breiteste-Element-Snippet aus dem Hinweis oben ausführen, Ergebnis notieren (Route → leere Liste = ok, sonst schuldige Elemente).
Falls **kein Test-Login** verfügbar: nur die öffentlich erreichbaren Routen live messen; die übrigen per statischer Code-Prüfung (Suche nach festen Pixelbreiten, `grid-cols-≥5`, nicht umbrechenden langen Texten, Flex-Kindern ohne `min-w-0`) bewerten. Diese Einschränkung im Abschlussbericht transparent vermerken.

- [ ] **Step 3: Für jede schuldige Stelle den Quell-Fix anwenden**

Pro identifiziertem Element den passenden Fix (kein pauschales Kaschieren):
- Langer, nicht umbrechender Text in Flex-Zeile → am Flex-Kind `min-w-0` ergänzen und am Textknoten `truncate` (einzeilig) bzw. `break-words` (mehrzeilig).
- Raster, das bei 360 px sprengt (z. B. `grid-cols-7`-Kalender in `days-page.tsx`) → `gap` verkleinern oder das Raster in `<div className="overflow-x-auto">` kapseln, sodass nur das Raster scrollt, nicht die Seite.
- Feste Pixelbreite über Viewport → `max-w-full` bzw. relative Einheit.

Beispiel-Diff-Muster (nur anwenden, wenn die Messung dieses Element als schuldig zeigt):

```tsx
// vorher
<div className="flex items-center gap-3">
  <p className="font-semibold text-sm">{longName}</p>
// nachher
<div className="flex items-center gap-3 min-w-0">
  <p className="font-semibold text-sm truncate">{longName}</p>
```

- [ ] **Step 4: Re-Messung der gefixten Routen**

Jede in Step 3 geänderte Route erneut bei 360 px messen: Breiteste-Element-Liste muss leer sein. Sichtprüfung: Inhalt vollständig lesbar, nichts abgeschnitten.

- [ ] **Step 5: 320-px-Stichprobe**

`/login`, `/`, `/warenkorb` (mit Position) und `/admin/tage` (falls erreichbar) bei 320×740 gegenmessen. Erwartung: keine schuldigen Elemente.

- [ ] **Step 6: Commit (nur falls Step 3 Dateien geändert hat)**

```bash
cd "C:/Users/Anwender/Desktop/Website/Pizza"
git add Frontend/src/pages Frontend/src/components
git commit -m "fix(ui): horizontalen Überlauf an der Quelle beheben (360px-Audit)"
```

Falls Step 3 nichts geändert hat (keine echten Überläufe außer dem in Task 1 gelösten): diesen Commit auslassen und im Bericht festhalten, dass der Audit außer der global gelösten Stelle keine weiteren Überläufe fand.

---

### Task 3: Abschluss-Verifikation + Doku

**Files:**
- Modify: `Doku/Pizza/Changelog.md`
- Modify: `Doku/Pizza/TODO.md`

**Interfaces:**
- Consumes: Endzustand aus Task 1 + 2.
- Produces: Doku-Einträge.

- [ ] **Step 1: Volle Gates**

```bash
cd "C:/Users/Anwender/Desktop/Website/Pizza/Frontend"
bunx tsc --noEmit
bun run build
bun test
```

Erwartung: `tsc` und `build` fehlerfrei; Unit-Tests grün (die vorbestehende Playwright-Datei `tests/e2e/order.spec.ts` unter `bun test` ist bekannte Infrastruktur-Noise und kein Blocker).

- [ ] **Step 2: Changelog-Eintrag ergänzen**

In `Doku/Pizza/Changelog.md` einen Eintrag mit heutigem Datum ergänzen: „Mobile-Responsivität: globales horizontal-overflow-Sicherheitsnetz in `theme.css` + 360-px-Audit aller Routen; echte Überläufe an der Quelle behoben. Kein Desktop-Umbau." Konkret behobene Stellen aus Task 2 auflisten (oder „Audit fand außer der global gelösten Stelle keine weiteren Überläufe").

- [ ] **Step 3: TODO pflegen**

In `Doku/Pizza/TODO.md` eine Zeile ergänzen: Mobile-Overflow-Fix `erledigt (2026-07-19)`, Verweis auf Spec/Plan. Falls Desktop-Layout gewünscht bleibt: separate offene Zeile „PC-/Desktop-Layout (Kunden + Admin)" als `offen` notieren.

- [ ] **Step 4: Commit**

```bash
cd "C:/Users/Anwender/Desktop/Website/Pizza"
git add Doku/Pizza/Changelog.md Doku/Pizza/TODO.md
git commit -m "docs: Mobile-Overflow-Fix in Changelog + TODO"
```

---

## Abschluss

Nach Task 3: `superpowers:finishing-a-development-branch` (Tests verifizieren → 4 Optionen → Merge nach `main`). Nach Merge + Push deployt Vercel automatisch; keine DB-/Edge-Function-Änderung, also kein Betreiber-Deploy nötig.
