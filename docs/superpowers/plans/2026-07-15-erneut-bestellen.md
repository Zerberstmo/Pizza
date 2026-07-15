# Erneut bestellen (1-Tap) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein „Erneut bestellen"-Button im Bestell-Detail-Modal legt die Positionen einer früheren Bestellung zurück in den Warenkorb und führt zum Checkout.

**Architecture:** Reine Frontend-Ergänzung am bestehenden `OrderQrModal`: `useCart().addToCart` + `useNavigate`. Kein Backend, keine Migration.

**Tech Stack:** TypeScript/React 18, Vite, react-router 7, Tailwind, lucide-react, Bun (`bun run`/`bun test`).

## Global Constraints

- Package-Manager **Bun**; Tests via `bun:test`.
- Reine Frontend-Änderung, **kein** ADR/Migration/Edge-Deploy — deployt über `main`-Push.
- Wiederverwenden: bestehende `Button`-Komponente, `useCart().addToCart(pizzaName, ingredientIds, sauceId?)`, `useNavigate`.
- Checkout-Route ist `/warenkorb`.
- An bestehenden Warenkorb **anhängen** (nicht ersetzen), **kein** Bestätigungsdialog.
- Sonderartikel existieren noch nicht (`CartItem` hat kein `kind`-Feld) → aktuell alle Positionen reordern; Kommentar setzen, dass Sonderartikel auszuschließen sind, sobald `kind` existiert.

---

### Task 1: „Erneut bestellen"-Button im `OrderQrModal`

**Files:**
- Modify: `Frontend/src/components/orders/order-qr-modal.tsx`

**Interfaces:**
- Consumes: `useCart().addToCart(pizzaName: string, ingredientIds: string[], sauceId?: string)`, `useNavigate()` (react-router), `Button`.

- [ ] **Step 1: Imports ergänzen**

In `Frontend/src/components/orders/order-qr-modal.tsx`:
- Zeile `import { X } from "lucide-react";` ersetzen durch:
  ```tsx
  import { X, RotateCcw } from "lucide-react";
  ```
- Nach der `motion`-Import-Zeile (`import { motion } from "motion/react";`) ergänzen:
  ```tsx
  import { useNavigate } from "react-router";
  ```
- Nach der `Separator`-Import-Zeile (`import { Separator } from "@/components/ui/separator";`) ergänzen:
  ```tsx
  import { Button } from "@/components/ui/button";
  import { useCart } from "@/hooks/use-cart";
  ```

- [ ] **Step 2: Hooks + Reorder-Handler**

Direkt nach der Props-Destrukturierung (`}: { order; labels; onClose }): React.ReactElement {`) und **vor** dem `useEffect` einfügen:

```tsx
  const navigate = useNavigate();
  const { addToCart } = useCart();

  // Alle (Pizza-)Positionen zurück in den Warenkorb legen → Checkout.
  // (Sonderartikel existieren noch nicht; sobald CartItem ein `kind` bekommt, hier ausschließen.)
  const reorder = () => {
    order.items.forEach((item) => addToCart(item.pizzaName, item.ingredientIds, item.sauceId));
    onClose();
    navigate("/warenkorb");
  };
```

- [ ] **Step 3: Button unten im Modal einsetzen**

Am Ende der Karte, **nach** dem „Gesamt (bar)"-Block und **vor** dem schließenden `</motion.div>`, einfügen:

```tsx
        <Button className="w-full gap-2" onClick={reorder}>
          <RotateCcw size={15} /> Erneut bestellen
        </Button>
```

- [ ] **Step 4: Build + Suite grün**

Run: `cd Frontend && bun run build && bun test src`
Expected: Build erfolgreich; Tests unverändert grün.

- [ ] **Step 5: Commit**

```bash
git add Frontend/src/components/orders/order-qr-modal.tsx
git commit -m "feat(orders): Erneut bestellen (1-Tap) im OrderQrModal"
```

---

### Task 2: Dokumentation

**Files:**
- Modify: `Doku/Pizza/Changelog.md`
- Modify: `Doku/Pizza/TODO.md`

- [ ] **Step 1: Changelog-Eintrag**

In `Doku/Pizza/Changelog.md` einen neuen Abschnitt `## 2026-07-15` **über** dem obersten bestehenden Abschnitt (direkt nach der Zeile `<!-- Neue Einträge oben einfügen -->`) einfügen — falls `## 2026-07-15` schon existiert, den Punkt oben unter dieser Überschrift ergänzen:

```markdown
## 2026-07-15

- **Erneut bestellen (1-Tap):** Im Bestell-Detail-Fenster („Meine Bestellungen" → Bestellung antippen)
  legt der Button „Erneut bestellen" alle Positionen der Bestellung zurück in den Warenkorb und führt
  zum Checkout (`OrderQrModal` → `addToCart` → `/warenkorb`). Anhängen an den bestehenden Warenkorb,
  kein Bestätigungsdialog. Reines Frontend.
```

- [ ] **Step 2: TODO-Eintrag**

In `Doku/Pizza/TODO.md` in der Tabelle (bei den erledigten Kunden-Features) eine neue Zeile einfügen:

```markdown
| P3 | ~~Erneut bestellen (1-Tap)~~ | erledigt (2026-07-15) — Button im `OrderQrModal` legt Positionen zurück in den Warenkorb → Checkout | Frontend-Deployment |
```

- [ ] **Step 3: Commit**

```bash
git add Doku/Pizza/Changelog.md Doku/Pizza/TODO.md
git commit -m "docs: Erneut bestellen (Changelog/TODO)"
```

---

## Verifikation gesamt

- `cd Frontend && bun run build` → erfolgreich; `cd Frontend && bun test src` → grün.
- Manueller Klicktest (nach Merge/Deploy): „Meine Bestellungen" → Bestellung antippen → „Erneut
  bestellen" → Positionen sind im Warenkorb, Seite ist der Checkout; bestehender Warenkorb-Inhalt bleibt.
