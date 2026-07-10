# Soßen, Favoriten & Service-Modus — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Erweitere das fertige Teil-A-Frontend um admin-verwaltbare Soßen (färben die Pizza-Vorschau), bis zu 5 speicherbare Favoriten-Pizzen und einen admin-schaltbaren Service-Modus (Vor Ort essen / Abholen).

**Architecture:** Alles folgt den bestehenden Mustern: async Datenschicht (`lib/data/store.ts`, localStorage-Naht), reine getestete Logik in `lib/`, gerätelokale UI-Zustände als Context-Hooks (`useCart`-Muster), Admin-Seiten nach dem `mutate`-und-persist-Muster der Zutaten-/Config-Seiten. Preis bleibt pauschal 10 €.

**Tech Stack:** Bun, Vite 6, React 18, TypeScript, Tailwind v4, shadcn/ui, react-router 7, motion, lucide-react. Tests: **bun:test** (`bun test src`) + happy-dom + @testing-library/react.

## Global Constraints

- **Package-Manager & Runner: ausschließlich Bun.** Test-Befehl: `bun test src` (NICHT Vitest). Build: `bun run build`.
- **Preis bleibt pauschal 10,00 € pro Pizza.** `lib/pricing.ts` wird NICHT verändert.
- **Alle Daten laufen über `lib/data/store.ts`** (async). Seiten importieren keine Seed-Konstanten direkt.
- **Soße nur für eigene Pizzen** (Konfigurator). Standard-Menü-Pizzen tragen keine `sauceId` → werden als Tomate angezeigt.
- **Favoriten: max. 5, gerätelokal** (localStorage `pizza-favorites`). 6. Speichern wird blockiert.
- **Service-Modus: globaler Schalter** in `AppConfig.service`. Zeitwahl für „Vor Ort" identisch zur Abholung.
- **Dateinamen `kebab-case`, Komponenten `PascalCase`.** Preisformat deutsch (`10,00 €`).
- **Referenz-Spec:** `docs/superpowers/specs/2026-07-10-sossen-favoriten-service-modus-design.md`.
- Alle Pfade unten sind relativ zu `Frontend/`. Test-/Build-Befehle aus `Frontend/` ausführen (`cd Frontend`).

---

## Dateistruktur (Ziel)

```
Frontend/src/
├── types/index.ts                         (M) Sauce, FavoritePizza, CartItem.sauceId, AppConfig.service, ServiceMode, NewOrder/OrderData.serviceMode
├── lib/
│   ├── sauces.ts                          (N) resolveSauce()
│   ├── slots.ts                           (M) availableServiceModes()
│   └── data/{seed.ts, store.ts}           (M) SAUCES_DEFAULT, DEFAULT_CONFIG.service; getSauces/saveSauces; createOrder serviceMode
├── hooks/
│   ├── use-cart.tsx                       (M) addToCart(…, sauceId?)
│   └── use-favorites.tsx                  (N) FavoritesProvider + useFavorites
├── components/pizza/
│   ├── pizza-svg.tsx                      (M) sauceColor-Prop
│   ├── sauce-picker.tsx                   (N)
│   └── favorites-bar.tsx                  (N)
├── pages/
│   ├── configurator/configurator-page.tsx (M) Soße + Favoriten
│   ├── menu/menu-page.tsx                 (M) Favoriten-Sektion + dynamischer Header
│   ├── checkout/checkout-page.tsx         (M) Service-Modus + Soßen-Anzeige
│   ├── confirmation/confirmation-page.tsx (M) Modus + Soßen-Anzeige
│   └── admin/{sauces-page.tsx, service-page.tsx} (N)
├── app.tsx                                (M) FavoritesProvider
├── router.tsx                             (M) /admin/sossen, /admin/service
└── components/layout/admin-shell.tsx      (M) 2 Nav-Punkte
```

---

### Task 1: Domänentypen, Seed & Store (Soße, Favorit, Service)

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/lib/data/seed.ts`
- Modify: `src/lib/data/store.ts`
- Modify: `src/lib/data/__tests__/store.test.ts`

**Interfaces:**
- Produces:
```ts
interface Sauce { id: string; name: string; emoji: string; color: string; available: boolean }
interface FavoritePizza { id: string; name: string; ingredientIds: string[]; sauceId: string }
type ServiceMode = "dinein" | "takeaway";
interface CartItem { cartId: string; pizzaName: string; ingredientIds: string[]; sauceId?: string }
interface AppConfig { days: Record<string, boolean>; hours: Hours; leadTimeDays: number; service: { dineIn: boolean; takeaway: boolean } }
interface NewOrder  { …; serviceMode?: ServiceMode }  // optional → hält Build grün; createOrder defaultet auf "takeaway"
interface OrderData { …; serviceMode: ServiceMode }   // immer gesetzt (von createOrder)
export const getSauces: () => Promise<Sauce[]>;
export const saveSauces: (list: Sauce[]) => Promise<void>;
export const SAUCES_DEFAULT: Sauce[]; // seed
```

- [ ] **Step 1: Typen erweitern** in `src/types/index.ts`.

`CartItem` um `sauceId` ergänzen:
```ts
export interface CartItem {
  cartId: string;
  pizzaName: string;
  ingredientIds: string[];
  sauceId?: string;
}
```
Neue Typen hinzufügen (am Dateiende):
```ts
export interface Sauce {
  id: string;
  name: string;
  emoji: string;
  color: string;
  available: boolean;
}

export interface FavoritePizza {
  id: string;
  name: string;
  ingredientIds: string[];
  sauceId: string;
}

export type ServiceMode = "dinein" | "takeaway";
```
`AppConfig` um `service` ergänzen:
```ts
export interface AppConfig {
  days: Record<string, boolean>;
  hours: Hours;
  leadTimeDays: number;
  service: { dineIn: boolean; takeaway: boolean };
}
```
`NewOrder` um `serviceMode?: ServiceMode;` (**optional** — hält den Build grün, solange der Checkout noch nicht anpasst) und `OrderData` um `serviceMode: ServiceMode;` (**pflicht** — `createOrder` setzt es immer) ergänzen, je nach `voucherCode?`.

- [ ] **Step 2: Seed erweitern** in `src/lib/data/seed.ts`.

`Sauce` in den Typ-Import aufnehmen (bestehende Zeile `import type { AppConfig, IngredientItem, PizzaTemplate, VoucherDef } from "@/types";` → `Sauce` ergänzen). Danach hinzufügen:
```ts
export const SAUCES_DEFAULT: Sauce[] = [
  { id: "tomate", name: "Tomate",        emoji: "🍅", color: "#B03818", available: true },
  { id: "creme",  name: "Crème fraîche", emoji: "🥛", color: "#ECE3C8", available: true },
  { id: "bbq",    name: "BBQ",           emoji: "🍖", color: "#7A3B1E", available: true },
  { id: "pesto",  name: "Pesto",         emoji: "🌿", color: "#4B7A2F", available: true },
  { id: "keine",  name: "Ohne Soße",     emoji: "🚫", color: "#E8C070", available: true },
];
```
`DEFAULT_CONFIG` um `service` ergänzen:
```ts
export const DEFAULT_CONFIG: AppConfig = {
  days: { Montag: true, Dienstag: true, Mittwoch: false, Donnerstag: true, Freitag: true, Samstag: true, Sonntag: false },
  hours: { from: "11:00", to: "21:00" },
  leadTimeDays: 3,
  service: { dineIn: false, takeaway: true },
};
```

- [ ] **Step 3: Store erweitern** in `src/lib/data/store.ts`.

Import-Zeile aus `./seed` um `SAUCES_DEFAULT` ergänzen. Typ-Import aus `@/types` um `Sauce` ergänzen. Neue Getter/Setter (bei den anderen `get*`/`save*` einfügen):
```ts
export const getSauces = () => delay(read<Sauce[]>("pizza-sauces", SAUCES_DEFAULT));
export const saveSauces = (list: Sauce[]) => delay(write("pizza-sauces", list));
```
In `createOrder` das `serviceMode` mit Default durchreichen: im zusammengebauten `order`-Objekt die Zeile ergänzen `serviceMode: input.serviceMode ?? "takeaway",` (z. B. direkt nach `pickupTime: input.pickupTime,`).

- [ ] **Step 4: Bestehenden Store-Test anpassen** in `src/lib/data/__tests__/store.test.ts`.

Der `createOrder`-Aufruf braucht jetzt `serviceMode`. Ergänze im Testobjekt die Zeile:
```ts
    const order = await createOrder({
      items: [{ cartId: "a", pizzaName: "Margherita", ingredientIds: [] }],
      customer: { firstName: "Max", lastName: "M", phone: "1" },
      notes: "", pickupDate: "2026-07-12", pickupTime: "18:00", serviceMode: "takeaway",
    });
```
Neuen Test für Soßen ergänzen (innerhalb `describe("data store", …)`):
```ts
  it("getSauces returns seed by default", async () => {
    const sauces = await getSauces();
    expect(sauces[0].id).toBe("tomate");
  });
```
Und den Import oben um `getSauces` erweitern:
```ts
import { getIngredients, saveConfig, getConfig, createOrder, getSauces } from "@/lib/data/store";
```
Der bestehende `saveConfig`-Aufruf konstruiert ein `AppConfig`-Literal ohne `service` → durch das neue Pflichtfeld ein Typfehler. Ergänze `service`:
```ts
    await saveConfig({ days: { Montag: true }, hours: { from: "10:00", to: "12:00" }, leadTimeDays: 5, service: { dineIn: false, takeaway: true } });
```

- [ ] **Step 4b: `slots.test.ts` compile-fest machen**

Der `cfg`-Helper in `src/lib/__tests__/slots.test.ts` baut ein `AppConfig` ohne `service` → Typfehler. Ergänze `service` (dieser Helper wird in Task 2 für den neuen Test wiederverwendet):
```ts
const cfg = (leadTimeDays: number, days = allDays): AppConfig =>
  ({ days, hours: { from: "11:00", to: "12:00" }, leadTimeDays, service: { dineIn: false, takeaway: true } });
```

- [ ] **Step 5: Tests ausführen → PASS**

Run: `cd Frontend && bun test src`
Expected: PASS (alle bestehenden + neuer Soßen-Test grün; `service`-Felder ergänzt).

- [ ] **Step 6: Build (Typecheck) → grün**

Run: `cd Frontend && bun run build`
Expected: `vite build` ohne TS-Fehler. `NewOrder.serviceMode` ist optional, daher kompiliert der bestehende Checkout-`createOrder`-Aufruf weiter; `CartItem.sauceId` und `PizzaSVG.sauceColor` sind optional → keine bestehenden Aufrufer brechen.

- [ ] **Step 7: Commit**

```bash
git add Frontend/src/types Frontend/src/lib/data
git commit -m "feat(frontend): Typen/Seed/Store für Soßen, Favoriten & Service-Modus"
```

---

### Task 2: `resolveSauce` + `availableServiceModes` (reine Logik)

**Files:**
- Create: `src/lib/sauces.ts`
- Modify: `src/lib/slots.ts`
- Test: `src/lib/__tests__/sauces.test.ts`
- Test: `src/lib/__tests__/slots.test.ts` (Ergänzung)

**Interfaces:**
- Consumes: `Sauce`, `AppConfig`, `ServiceMode` aus `@/types`.
- Produces:
```ts
export function resolveSauce(sauces: Sauce[], sauceId?: string): Sauce | undefined;
export function availableServiceModes(config: AppConfig): ServiceMode[];
```

- [ ] **Step 1: Failing test `sauces.test.ts`**

```ts
import { describe, it, expect } from "bun:test";
import { resolveSauce } from "@/lib/sauces";
import type { Sauce } from "@/types";

const sauces: Sauce[] = [
  { id: "tomate", name: "Tomate", emoji: "🍅", color: "#B03818", available: true },
  { id: "pesto",  name: "Pesto",  emoji: "🌿", color: "#4B7A2F", available: false },
];

describe("resolveSauce", () => {
  it("findet die Soße per id", () => expect(resolveSauce(sauces, "tomate")?.id).toBe("tomate"));
  it("ignoriert nicht verfügbare Soße → erste verfügbare", () => expect(resolveSauce(sauces, "pesto")?.id).toBe("tomate"));
  it("fällt ohne id auf erste verfügbare zurück", () => expect(resolveSauce(sauces, undefined)?.id).toBe("tomate"));
});
```

- [ ] **Step 2: Failing test-Ergänzung `slots.test.ts`**

Import oben ergänzen:
```ts
import { getSelectableDates, getAvailableTimes, isSlotAllowed, formatDateLabel, availableServiceModes } from "@/lib/slots";
```
Neuen Test innerhalb `describe("slots", …)` (der `cfg`-Helper hat sein `service`-Feld bereits aus Task 1 Step 4b):
```ts
  it("availableServiceModes spiegelt die Config", () => {
    const base = cfg(3);
    expect(availableServiceModes({ ...base, service: { dineIn: true,  takeaway: true  } })).toEqual(["dinein", "takeaway"]);
    expect(availableServiceModes({ ...base, service: { dineIn: false, takeaway: true  } })).toEqual(["takeaway"]);
    expect(availableServiceModes({ ...base, service: { dineIn: true,  takeaway: false } })).toEqual(["dinein"]);
    expect(availableServiceModes({ ...base, service: { dineIn: false, takeaway: false } })).toEqual([]);
  });
```

- [ ] **Step 3: Run → FAIL**

Run: `cd Frontend && bun test src/lib/__tests__/sauces.test.ts src/lib/__tests__/slots.test.ts`
Expected: FAIL (`resolveSauce`/`availableServiceModes` nicht exportiert).

- [ ] **Step 4: `src/lib/sauces.ts` implementieren**

```ts
import type { Sauce } from "@/types";

// Liefert die Soße zur id; fällt bei fehlender/nicht verfügbarer id auf die erste
// verfügbare Soße zurück (Default = Tomate laut Seed).
export function resolveSauce(sauces: Sauce[], sauceId?: string): Sauce | undefined {
  return (
    sauces.find((s) => s.id === sauceId && s.available) ??
    sauces.find((s) => s.available) ??
    sauces[0]
  );
}
```

- [ ] **Step 5: `availableServiceModes` in `src/lib/slots.ts`**

Import-Zeile oben um `ServiceMode` ergänzen: `import type { AppConfig, Hours, ServiceMode } from "@/types";`. Am Dateiende:
```ts
export function availableServiceModes(config: AppConfig): ServiceMode[] {
  const modes: ServiceMode[] = [];
  if (config.service.dineIn) modes.push("dinein");
  if (config.service.takeaway) modes.push("takeaway");
  return modes;
}
```

- [ ] **Step 6: Run → PASS**

Run: `cd Frontend && bun test src/lib/__tests__/sauces.test.ts src/lib/__tests__/slots.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add Frontend/src/lib/sauces.ts Frontend/src/lib/slots.ts Frontend/src/lib/__tests__/sauces.test.ts Frontend/src/lib/__tests__/slots.test.ts
git commit -m "feat(frontend): resolveSauce + availableServiceModes (getestet)"
```

---

### Task 3: `PizzaSVG` mit Soßenfarbe

**Files:**
- Modify: `src/components/pizza/pizza-svg.tsx`
- Test: `src/components/__tests__/pizza-svg.test.tsx` (Ergänzung)

**Interfaces:**
- Produces: `PizzaSVG({ selected, sauceColor? }: { selected: string[]; sauceColor?: string })`.

- [ ] **Step 1: Failing test-Ergänzung**

In `src/components/__tests__/pizza-svg.test.tsx` einen Test ergänzen:
```ts
  it("färbt den Boden mit sauceColor", () => {
    const { container } = render(<PizzaSVG selected={[]} sauceColor="#4B7A2F" />);
    const filled = Array.from(container.querySelectorAll("circle")).some(
      (c) => c.getAttribute("fill") === "#4B7A2F"
    );
    expect(filled).toBe(true);
  });
```

- [ ] **Step 2: Run → FAIL**

Run: `cd Frontend && bun test src/components/__tests__/pizza-svg.test.tsx`
Expected: FAIL (kein Kreis mit `#4B7A2F`).

- [ ] **Step 3: `PizzaSVG` anpassen**

Signatur ändern und die beiden Soßen-Layer (bisher fest `#B03818` r=88 und `#9B2A14` r=84) durch eine Verzweigung ersetzen. Default (ohne `sauceColor`) bleibt pixelgleich:
```tsx
export function PizzaSVG({ selected, sauceColor }: { selected: string[]; sauceColor?: string }): React.ReactElement {
  const total = selected.length;
  return (
    <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-2xl" xmlns="http://www.w3.org/2000/svg">
      <circle cx="100" cy="100" r="96" fill="#C4956A" />
      {sauceColor ? (
        <>
          <circle cx="100" cy="100" r="88" fill={sauceColor} />
          <circle cx="100" cy="100" r="84" fill="#000000" opacity="0.12" />
        </>
      ) : (
        <>
          <circle cx="100" cy="100" r="88" fill="#B03818" />
          <circle cx="100" cy="100" r="84" fill="#9B2A14" />
        </>
      )}
      <circle cx="100" cy="100" r="82" fill="#E8C070" opacity="0.38" />
      {/* … Rest unverändert (Zutaten-Renderer + zwei äußere Ringe) … */}
```
> Nur die Soßen-Layer ersetzen; `total === 0`-Text, `selected.map(...)` und die beiden abschließenden `<circle stroke=…>` bleiben exakt wie bisher.

- [ ] **Step 4: Run → PASS**

Run: `cd Frontend && bun test src/components/__tests__/pizza-svg.test.tsx`
Expected: PASS (beide Tests grün).

- [ ] **Step 5: Commit**

```bash
git add Frontend/src/components/pizza/pizza-svg.tsx Frontend/src/components/__tests__/pizza-svg.test.tsx
git commit -m "feat(frontend): PizzaSVG färbt Boden nach Soße"
```

---

### Task 4: `useCart` mit Soße + `SaucePicker`

**Files:**
- Modify: `src/hooks/use-cart.tsx`
- Create: `src/components/pizza/sauce-picker.tsx`
- Test: `src/hooks/__tests__/use-cart.test.tsx` (Ergänzung)
- Test: `src/components/__tests__/sauce-picker.test.tsx`

**Interfaces:**
- Consumes: `Sauce` aus `@/types`; `cn` aus `@/lib/utils`.
- Produces:
```ts
addToCart(pizzaName: string, ingredientIds: string[], sauceId?: string): void
function SaucePicker({ sauces, value, onChange }: { sauces: Sauce[]; value: string; onChange: (id: string) => void }): JSX.Element
```

- [ ] **Step 1: `use-cart.tsx` anpassen**

Interface + Implementierung von `addToCart` um `sauceId` erweitern:
```ts
interface CartContextValue {
  cart: CartItem[];
  addToCart(pizzaName: string, ingredientIds: string[], sauceId?: string): void;
  removeFromCart(cartId: string): void;
  clearCart(): void;
  count: number;
}
```
```ts
  const addToCart = (pizzaName: string, ingredientIds: string[], sauceId?: string) =>
    setCart((p) => [...p, { cartId: uid(), pizzaName, ingredientIds, sauceId }]);
```

- [ ] **Step 2: Failing test-Ergänzung `use-cart.test.tsx`**

```ts
  it("übernimmt die sauceId", () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.addToCart("Eigene Pizza", ["salami"], "pesto"));
    expect(result.current.cart[0].sauceId).toBe("pesto");
  });
```

- [ ] **Step 3: Failing test `sauce-picker.test.tsx`**

```tsx
import { describe, it, expect } from "bun:test";
import { render } from "@testing-library/react";
import { SaucePicker } from "@/components/pizza/sauce-picker";
import type { Sauce } from "@/types";

const sauces: Sauce[] = [
  { id: "tomate", name: "Tomate", emoji: "🍅", color: "#B03818", available: true },
  { id: "pesto",  name: "Pesto",  emoji: "🌿", color: "#4B7A2F", available: true },
];

describe("SaucePicker", () => {
  it("rendert einen Button je Soße", () => {
    const { getByText } = render(<SaucePicker sauces={sauces} value="tomate" onChange={() => {}} />);
    expect(getByText("Tomate")).not.toBeNull();
    expect(getByText("Pesto")).not.toBeNull();
  });
});
```

- [ ] **Step 4: Run → FAIL**

Run: `cd Frontend && bun test src/hooks/__tests__/use-cart.test.tsx src/components/__tests__/sauce-picker.test.tsx`
Expected: FAIL (`SaucePicker` fehlt).

- [ ] **Step 5: `sauce-picker.tsx` implementieren**

```tsx
import type React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Sauce } from "@/types";

// Einfachauswahl der Soße (nur verfügbare). Muster wie die Zutaten-Chips.
export function SaucePicker({ sauces, value, onChange }: {
  sauces: Sauce[];
  value: string;
  onChange: (id: string) => void;
}): React.ReactElement {
  return (
    <div className="flex flex-wrap gap-2">
      {sauces.map((s) => {
        const active = s.id === value;
        return (
          <button key={s.id} type="button" onClick={() => onChange(s.id)}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all",
              active ? "border-primary/50 bg-primary/10 text-primary" : "border-border bg-card hover:border-border/80 text-foreground"
            )}>
            <span className="text-base leading-none">{s.emoji}</span>
            {s.name}
            {active && <Check size={11} className="text-primary" />}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 6: Run → PASS**

Run: `cd Frontend && bun test src/hooks/__tests__/use-cart.test.tsx src/components/__tests__/sauce-picker.test.tsx`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add Frontend/src/hooks/use-cart.tsx Frontend/src/components/pizza/sauce-picker.tsx Frontend/src/hooks/__tests__/use-cart.test.tsx Frontend/src/components/__tests__/sauce-picker.test.tsx
git commit -m "feat(frontend): useCart mit sauceId + SaucePicker-Komponente"
```

---

### Task 5: `useFavorites`-Hook

**Files:**
- Create: `src/hooks/use-favorites.tsx`
- Test: `src/hooks/__tests__/use-favorites.test.tsx`

**Interfaces:**
- Consumes: `FavoritePizza` aus `@/types`.
- Produces:
```ts
function FavoritesProvider({ children }: { children: React.ReactNode }): JSX.Element
function useFavorites(): {
  favorites: FavoritePizza[];
  add(name: string, ingredientIds: string[], sauceId: string): boolean; // false wenn bereits 5
  remove(id: string): void;
  isFull: boolean;
}
```

- [ ] **Step 1: Failing test `use-favorites.test.tsx`**

```tsx
import { describe, it, expect, beforeEach } from "bun:test";
import { renderHook, act } from "@testing-library/react";
import { FavoritesProvider, useFavorites } from "@/hooks/use-favorites";

const wrapper = ({ children }: { children: React.ReactNode }) => <FavoritesProvider>{children}</FavoritesProvider>;
beforeEach(() => localStorage.clear());

describe("useFavorites", () => {
  it("fügt hinzu und persistiert", () => {
    const { result } = renderHook(() => useFavorites(), { wrapper });
    act(() => { result.current.add("Meine Pizza 1", ["salami"], "tomate"); });
    expect(result.current.favorites.length).toBe(1);
    expect(localStorage.getItem("pizza-favorites")).toContain("Meine Pizza 1");
  });
  it("blockiert den 6. Favoriten", () => {
    const { result } = renderHook(() => useFavorites(), { wrapper });
    act(() => { for (let i = 0; i < 5; i++) result.current.add(`P${i}`, [], "tomate"); });
    let ok = true;
    act(() => { ok = result.current.add("P6", [], "tomate"); });
    expect(ok).toBe(false);
    expect(result.current.favorites.length).toBe(5);
    expect(result.current.isFull).toBe(true);
  });
  it("entfernt einen Favoriten", () => {
    const { result } = renderHook(() => useFavorites(), { wrapper });
    act(() => { result.current.add("P", ["mozzarella"], "tomate"); });
    const id = result.current.favorites[0].id;
    act(() => { result.current.remove(id); });
    expect(result.current.favorites.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run → FAIL**

Run: `cd Frontend && bun test src/hooks/__tests__/use-favorites.test.tsx`
Expected: FAIL (Modul fehlt).

- [ ] **Step 3: `use-favorites.tsx` implementieren**

```tsx
import { createContext, useContext, useEffect, useState } from "react";
import type { FavoritePizza } from "@/types";

const uid = () => Math.random().toString(36).slice(2, 9);
const KEY = "pizza-favorites";
const MAX = 5;

interface FavoritesContextValue {
  favorites: FavoritePizza[];
  add(name: string, ingredientIds: string[], sauceId: string): boolean;
  remove(id: string): void;
  isFull: boolean;
}
const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const [favorites, setFavorites] = useState<FavoritePizza[]>(() => {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as FavoritePizza[]) : [];
  });
  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(favorites));
  }, [favorites]);

  const add = (name: string, ingredientIds: string[], sauceId: string): boolean => {
    if (favorites.length >= MAX) return false;
    setFavorites((p) => [...p, { id: uid(), name, ingredientIds, sauceId }]);
    return true;
  };
  const remove = (id: string) => setFavorites((p) => p.filter((f) => f.id !== id));

  return (
    <FavoritesContext.Provider value={{ favorites, add, remove, isFull: favorites.length >= MAX }}>
      {children}
    </FavoritesContext.Provider>
  );
}
export function useFavorites(): FavoritesContextValue {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error("useFavorites must be used within FavoritesProvider");
  return ctx;
}
```

- [ ] **Step 4: Run → PASS**

Run: `cd Frontend && bun test src/hooks/__tests__/use-favorites.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add Frontend/src/hooks/use-favorites.tsx Frontend/src/hooks/__tests__/use-favorites.test.tsx
git commit -m "feat(frontend): useFavorites-Hook (max 5, localStorage) mit Tests"
```

---

### Task 6: Konfigurator — Soße + Favoriten

**Files:**
- Modify: `src/app.tsx`
- Create: `src/components/pizza/favorites-bar.tsx`
- Modify: `src/pages/configurator/configurator-page.tsx`

**Interfaces:**
- Consumes: `useFavorites`, `SaucePicker`, `getSauces`, `resolveSauce`, `useCart().addToCart(…, sauceId)`.
- Produces: `FavoritesBar({ onLoad }: { onLoad: (fav: FavoritePizza) => void })`.

- [ ] **Step 1: `FavoritesProvider` in `app.tsx` einhängen**

`app.tsx` importiert bereits `CartProvider`. Ergänze den Import und schachtele den Provider **innerhalb** von `CartProvider`:
```tsx
import { RouterProvider } from "react-router";
import { CartProvider } from "@/hooks/use-cart";
import { FavoritesProvider } from "@/hooks/use-favorites";
import { router } from "@/router";

export default function App() {
  return (
    <CartProvider>
      <FavoritesProvider>
        <div className="min-h-screen bg-background text-foreground max-w-lg mx-auto relative" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          <RouterProvider router={router} />
        </div>
      </FavoritesProvider>
    </CartProvider>
  );
}
```

- [ ] **Step 2: `favorites-bar.tsx` erstellen**

```tsx
import type React from "react";
import { X } from "lucide-react";
import { useFavorites } from "@/hooks/use-favorites";
import type { FavoritePizza } from "@/types";

// Leiste mit gespeicherten Favoriten. Antippen lädt, X löscht.
export function FavoritesBar({ onLoad }: { onLoad: (fav: FavoritePizza) => void }): React.ReactElement | null {
  const { favorites, remove } = useFavorites();
  if (favorites.length === 0) return null;
  return (
    <div className="mb-4">
      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Meine Favoriten</p>
      <div className="flex flex-wrap gap-2">
        {favorites.map((f) => (
          <div key={f.id} className="flex items-center gap-1 rounded-full border border-border bg-card pl-3 pr-1 py-1 text-sm">
            <button type="button" className="font-medium hover:text-primary transition-colors" onClick={() => onLoad(f)}>{f.name}</button>
            <button type="button" className="p-1 text-muted-foreground hover:text-destructive transition-colors" onClick={() => remove(f.id)}><X size={11} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: `configurator-page.tsx` verdrahten**

Ergänze Imports:
```tsx
import { useState } from "react";
import { getIngredients, getSauces } from "@/lib/data/store";
import { useFavorites } from "@/hooks/use-favorites";
import { resolveSauce } from "@/lib/sauces";
import { SaucePicker } from "@/components/pizza/sauce-picker";
import { FavoritesBar } from "@/components/pizza/favorites-bar";
import type { FavoritePizza, IngredientItem, Sauce } from "@/types";
```
Lade Soßen zusätzlich zu Zutaten und halte Soßen-/Favoriten-State. Direkt bei den bestehenden Hooks:
```tsx
  const { data, loading, error } = useAsync(getIngredients);
  const { data: sauces } = useAsync(getSauces);
  const { addToCart } = useCart();
  const { add: addFavorite, isFull } = useFavorites();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string[]>([]);
  const [sauceId, setSauceId] = useState<string>("");
  const [favMsg, setFavMsg] = useState<string>("");

  // Default-Soße setzen, sobald geladen und noch keine gewählt.
  const availableSauces = (sauces ?? []).filter((s) => s.available);
  if (availableSauces.length > 0 && !sauceId) setSauceId(availableSauces[0].id);
```
> Hinweis: Das `if (...) setSauceId(...)` während des Renders ist ein bewusstes, idempotentes „derived default"-Muster (setzt nur einmal, danach ist `sauceId` gesetzt). Alternativ ein `useEffect` mit `[sauces]`.

Die Vorschau bekommt die Soßenfarbe:
```tsx
    const sauceColor = resolveSauce(sauces ?? [], sauceId)?.color;
    // …
    <PizzaSVG selected={selected} sauceColor={sauceColor} />
```
> Der `resolveSauce`-Aufruf steht im Render vor dem `return` des inneren Boundary-Children bzw. wird an `PizzaSVG` übergeben.

Soßen-Auswahl-Block direkt über den Zutaten-Kategorien einfügen (innerhalb des `AsyncBoundary`-Children, vor `{categories.map(...)}`):
```tsx
              {availableSauces.length > 0 && (
                <div className="mb-5">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-2">Soße</p>
                  <SaucePicker sauces={availableSauces} value={sauceId} onChange={setSauceId} />
                </div>
              )}
```
`FavoritesBar` über der Live-Vorschau einfügen (ganz oben im Children-Block):
```tsx
              <FavoritesBar onLoad={(fav: FavoritePizza) => { setSelected(fav.ingredientIds); setSauceId(fav.sauceId); }} />
```
`addOwnPizza` um Soße erweitern:
```tsx
  const addOwnPizza = () => {
    if (selected.length === 0) return;
    addToCart("Eigene Pizza", selected, sauceId);
    setSelected([]);
    navigate("/warenkorb");
  };
```
Dafür den Hook um `favorites` erweitern (für den Default-Namen): `const { favorites, add: addFavorite, isFull } = useFavorites();`.
„Als Favorit speichern"-Button in die Sticky-CTA-Card neben „+ Warenkorb" einfügen (im `CardContent` der fixierten Karte, vor dem bestehenden Button):
```tsx
            <Button
              variant="outline"
              disabled={selected.length === 0 || isFull}
              onClick={() => {
                const ok = addFavorite(`Eigene Pizza ${favorites.length + 1}`, selected, sauceId);
                setFavMsg(ok ? "Als Favorit gespeichert." : "Max. 5 Favoriten – lösche zuerst einen.");
                setTimeout(() => setFavMsg(""), 2000);
              }}
              className="gap-1.5"
            >
              ♥ Favorit
            </Button>
```
> Vereinfachung (ponytail): Der Favoritenname ist automatisch „Eigene Pizza N". Eine freie Namens-Eingabe kann später ergänzt werden; `add(name, …)` akzeptiert bereits einen beliebigen Namen. Zeige den Hinweis unter den Buttons: `{favMsg && <p className="text-xs text-muted-foreground text-center">{favMsg}</p>}`.

- [ ] **Step 4: Build → grün**

Run: `cd Frontend && bun run build`
Expected: `vite build` ohne TS-Fehler.

- [ ] **Step 5: Manuell verifizieren**

Run: `cd Frontend && bun run dev` → `/konfigurator`:
- Soßen-Auswahl sichtbar, Tomate vorgewählt; Wechsel färbt die Vorschau (Pesto grün etc.).
- „♥ Favorit" speichert (ab ≥1 Zutat); nach 5 deaktiviert mit Hinweis.
- Favoriten-Chip oben lädt Zutaten + Soße.
Danach abbrechen.

- [ ] **Step 6: Commit**

```bash
git add Frontend/src/app.tsx Frontend/src/components/pizza/favorites-bar.tsx Frontend/src/pages/configurator/configurator-page.tsx
git commit -m "feat(frontend): Konfigurator mit Soßenwahl + Favoriten speichern/laden"
```

---

### Task 7: Speisekarte — Favoriten-Sektion + dynamischer Header

**Files:**
- Modify: `src/pages/menu/menu-page.tsx`

**Interfaces:**
- Consumes: `useFavorites`, `getConfig`, `getSauces`, `resolveSauce`, `availableServiceModes`, `useCart().addToCart(…, sauceId)`.

- [ ] **Step 1: Header dynamisch + Favoriten laden**

Imports ergänzen:
```tsx
import { getMenu, getIngredients, getConfig, getSauces } from "@/lib/data/store";
import { useFavorites } from "@/hooks/use-favorites";
import { resolveSauce } from "@/lib/sauces";
import { availableServiceModes } from "@/lib/slots";
```
In der Komponente:
```tsx
  const config = useAsync(getConfig);
  const sauces = useAsync(getSauces);
  const { favorites, remove } = useFavorites();
```
Header-Text ableiten (ersetzt den festen Untertitel „Pizzeria · Nur Abholung"):
```tsx
  const modes = config.data ? availableServiceModes(config.data) : [];
  const serviceLabel =
    modes.length === 2 ? "Vor Ort & Abholung"
    : modes[0] === "takeaway" ? "Nur Abholung"
    : modes[0] === "dinein" ? "Nur Vor Ort"
    : "Aktuell geschlossen";
```
Und im JSX den festen Text ersetzen:
```tsx
          <p className="text-[10px] font-black tracking-[0.3em] uppercase text-primary mb-3">
            Pizzeria · {serviceLabel}
          </p>
```

- [ ] **Step 2: Favoriten-Sektion einfügen** (nach dem `<Separator />`, vor dem Standard-Grid):

```tsx
      {favorites.length > 0 && (
        <div className="px-4 pt-5">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-2">Meine Favoriten</p>
          <div className="grid grid-cols-2 gap-3">
            {favorites.map((f) => {
              const color = resolveSauce(sauces.data ?? [], f.sauceId)?.color;
              return (
                <div key={f.id} className="rounded-2xl border border-border bg-card p-3 relative">
                  <button type="button" className="absolute top-2 right-2 text-muted-foreground hover:text-destructive" onClick={() => remove(f.id)}><X size={13} /></button>
                  <div className="h-24 mx-auto aspect-square"><PizzaSVG selected={f.ingredientIds} sauceColor={color} /></div>
                  <p className="font-black text-sm leading-tight mt-2">{f.name}</p>
                  <button type="button"
                    onClick={() => addToCart(f.name, f.ingredientIds, f.sauceId)}
                    className="mt-2 w-full bg-primary/10 border border-primary/20 rounded-lg py-2 text-xs font-bold text-primary text-center hover:bg-primary hover:text-white transition-all">
                    + In den Warenkorb
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
```
> `X` und `PizzaSVG` importieren, falls noch nicht vorhanden: `import { X } from "lucide-react";` und `import { PizzaSVG } from "@/components/pizza/pizza-svg";`.

- [ ] **Step 3: Build → grün**

Run: `cd Frontend && bun run build`
Expected: ohne TS-Fehler.

- [ ] **Step 4: Manuell verifizieren**

`bun run dev` → `/`: Header spiegelt Service-Config; wenn Favoriten existieren, erscheint die Sektion; „In den Warenkorb" zählt das Badge hoch. Abbrechen.

- [ ] **Step 5: Commit**

```bash
git add Frontend/src/pages/menu/menu-page.tsx
git commit -m "feat(frontend): Speisekarte mit Favoriten-Sektion + dynamischem Service-Header"
```

---

### Task 8: Admin — Soßen-Verwaltung

**Files:**
- Create: `src/pages/admin/sauces-page.tsx`
- Modify: `src/router.tsx`
- Modify: `src/components/layout/admin-shell.tsx`

**Interfaces:**
- Consumes: `getSauces`, `saveSauces`, `useAsync`, `AsyncBoundary`.

- [ ] **Step 1: `sauces-page.tsx` erstellen** (Muster der Zutaten-Seite, flache Liste + Farb-Input)

```tsx
import type React from "react";
import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { getSauces, saveSauces } from "@/lib/data/store";
import { useAsync } from "@/hooks/use-async";
import { cn } from "@/lib/utils";
import type { Sauce } from "@/types";
import { AsyncBoundary } from "@/components/common/async-boundary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const uid = () => Math.random().toString(36).slice(2, 9);
const EMPTY = { name: "", emoji: "🍅", color: "#B03818" };

// Admin: Soßenverwaltung. Muster der Zutaten-Seite; persistiert via saveSauces.
export default function SaucesPage(): React.ReactElement {
  const { data, loading, error } = useAsync(getSauces);
  const [list, setList] = useState<Sauce[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);

  useEffect(() => { if (data) setList(data); }, [data]);

  const mutate = (next: Sauce[]) => { setList(next); void saveSauces(next); };

  const addSauce = () => {
    if (!form.name.trim() || !list) return;
    mutate([...list, { id: uid(), name: form.name.trim(), emoji: form.emoji, color: form.color, available: true }]);
    setForm(EMPTY);
    setShowForm(false);
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-lg">Soßen</h2>
        <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={() => setShowForm(!showForm)}><Plus size={12} /> Neue Soße</Button>
      </div>

      {showForm && (
        <Card className="border-primary/20">
          <CardHeader><CardTitle className="text-sm">Neue Soße</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Emoji</Label>
                <Input value={form.emoji} onChange={(e) => setForm((f) => ({ ...f, emoji: e.target.value }))} className="text-center text-xl" maxLength={2} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Name</Label>
                <Input placeholder="z.B. Trüffelcreme" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Bodenfarbe</Label>
              <input type="color" value={form.color} onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))} className="h-10 w-full rounded-lg border border-border bg-input-background" />
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={addSauce} disabled={!form.name.trim()}><Plus size={13} /> Hinzufügen</Button>
              <Button variant="ghost" onClick={() => setShowForm(false)}>Abbrechen</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <AsyncBoundary loading={loading} error={error} data={list}
        empty={<p className="text-sm text-muted-foreground text-center py-8">Noch keine Soßen.</p>}>
        {(sauces: Sauce[]) => (
          <div className="space-y-2">
            {sauces.map((s) => (
              <Card key={s.id} className={cn(!s.available && "opacity-40")}>
                <CardContent className="py-3 px-4 flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full border border-border shrink-0" style={{ background: s.color }} />
                  <span className="text-xl">{s.emoji}</span>
                  <div className="flex-1 min-w-0"><p className="font-semibold text-sm">{s.name}</p></div>
                  <div className="flex items-center gap-2">
                    <Switch checked={s.available} onCheckedChange={() => mutate(sauces.map((x) => x.id === s.id ? { ...x, available: !x.available } : x))} />
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => mutate(sauces.filter((x) => x.id !== s.id))}><X size={12} /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </AsyncBoundary>
    </div>
  );
}
```

- [ ] **Step 2: Route + Nav ergänzen**

In `src/router.tsx` den Import `import SaucesPage from "@/pages/admin/sauces-page";` und im Admin-Layout-`children`-Array eine Route ergänzen:
```tsx
      { path: "sossen", element: <SaucesPage /> },
```
In `src/components/layout/admin-shell.tsx` den Icon-Import um `Droplet` erweitern und im `NAV`-Array einen Eintrag ergänzen (z. B. nach „zutaten"):
```tsx
  { to: "/admin/sossen", icon: Droplet, label: "Soßen" },
```

- [ ] **Step 3: Build + manuell**

Run: `cd Frontend && bun run build` → grün. `bun run dev` → `/admin/sossen`: Soßen listen, anlegen (Farbe wählbar), toggeln, löschen. Neue Soße erscheint danach im Konfigurator. Abbrechen.

- [ ] **Step 4: Commit**

```bash
git add Frontend/src/pages/admin/sauces-page.tsx Frontend/src/router.tsx Frontend/src/components/layout/admin-shell.tsx
git commit -m "feat(frontend): Admin-Soßenverwaltung (persistent)"
```

---

### Task 9: Admin — Service-Modus

**Files:**
- Create: `src/pages/admin/service-page.tsx`
- Modify: `src/router.tsx`
- Modify: `src/components/layout/admin-shell.tsx`

**Interfaces:**
- Consumes: `useConfigEditor`, `AsyncBoundary`, `Switch`.

- [ ] **Step 1: `service-page.tsx` erstellen** (Muster der Config-Seiten via `useConfigEditor`)

```tsx
import type React from "react";
import { Check } from "lucide-react";
import { useConfigEditor } from "@/hooks/use-config-editor";
import type { AppConfig } from "@/types";
import { AsyncBoundary } from "@/components/common/async-boundary";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";

// Admin: Service-Modus. Globaler Schalter Vor Ort / Abholen; persistiert via saveConfig.
export default function ServicePage(): React.ReactElement {
  const { config, setConfig, loading, error, saved, save } = useConfigEditor();

  const toggle = (key: "dineIn" | "takeaway") =>
    setConfig((c) => (c ? { ...c, service: { ...c.service, [key]: !c.service[key] } } : c));

  return (
    <div className="p-4 space-y-4">
      <div>
        <h2 className="font-bold text-lg">Service</h2>
        <p className="text-sm text-muted-foreground mt-1">Lege fest, wie bestellt werden kann. Beide aus = keine Bestellungen möglich.</p>
      </div>
      <AsyncBoundary loading={loading} error={error} data={config}>
        {(cfg: AppConfig) => (
          <>
            <Card>
              <CardContent className="py-0">
                <div className="flex items-center justify-between py-4">
                  <div>
                    <p className="font-semibold text-sm">Vor Ort essen</p>
                    <p className={"text-xs mt-0.5 " + (cfg.service.dineIn ? "text-green-400" : "text-muted-foreground")}>{cfg.service.dineIn ? "Aktiv" : "Aus"}</p>
                  </div>
                  <Switch checked={cfg.service.dineIn} onCheckedChange={() => toggle("dineIn")} />
                </div>
                <Separator />
                <div className="flex items-center justify-between py-4">
                  <div>
                    <p className="font-semibold text-sm">Abholen</p>
                    <p className={"text-xs mt-0.5 " + (cfg.service.takeaway ? "text-green-400" : "text-muted-foreground")}>{cfg.service.takeaway ? "Aktiv" : "Aus"}</p>
                  </div>
                  <Switch checked={cfg.service.takeaway} onCheckedChange={() => toggle("takeaway")} />
                </div>
              </CardContent>
            </Card>
            <Button className="w-full gap-2" onClick={save}>{saved ? <><Check size={15} /> Gespeichert</> : "Speichern"}</Button>
          </>
        )}
      </AsyncBoundary>
    </div>
  );
}
```

- [ ] **Step 2: Route + Nav ergänzen**

In `src/router.tsx`: `import ServicePage from "@/pages/admin/service-page";` und Route:
```tsx
      { path: "service", element: <ServicePage /> },
```
In `admin-shell.tsx`: Icon-Import um `Store` erweitern, `NAV`-Eintrag (z. B. nach „vorlaufzeit"):
```tsx
  { to: "/admin/service", icon: Store, label: "Service" },
```

- [ ] **Step 3: Build + manuell**

Run: `cd Frontend && bun run build` → grün. `bun run dev` → `/admin/service`: beide Schalter, Speichern persistiert. Abbrechen.

- [ ] **Step 4: Commit**

```bash
git add Frontend/src/pages/admin/service-page.tsx Frontend/src/router.tsx Frontend/src/components/layout/admin-shell.tsx
git commit -m "feat(frontend): Admin-Service-Modus (Vor Ort / Abholen)"
```

---

### Task 10: Checkout — Service-Modus + Soßen-Anzeige

**Files:**
- Modify: `src/pages/checkout/checkout-page.tsx`

**Interfaces:**
- Consumes: `availableServiceModes`, `getSauces`, `resolveSauce`, `createOrder({ …, serviceMode })`.

- [ ] **Step 1: Service-Modus-State + Soßen laden**

Imports ergänzen:
```tsx
import { getConfig, getIngredients, getVouchers, getSauces, createOrder } from "@/lib/data/store";
import { getSelectableDates, getAvailableTimes, formatDateLabel, availableServiceModes } from "@/lib/slots";
import { resolveSauce } from "@/lib/sauces";
import type { Customer, ServiceMode, VoucherDef } from "@/types";
```
State + abgeleitete Modi (bei den bestehenden States/Ableitungen):
```tsx
  const { data: sauces } = useAsync(getSauces);
  const [serviceMode, setServiceMode] = useState<ServiceMode | "">("");

  const modes = config ? availableServiceModes(config) : [];
  const noService = !cfg.loading && modes.length === 0;
  // Default-Modus setzen, sobald verfügbar
  if (modes.length > 0 && !serviceMode) setServiceMode(modes[0]);
```
> `config` ist der bereits vorhandene `cfg.data`. `noService` analog zu `noDates` behandeln.

- [ ] **Step 2: Modus-Auswahl im „Abholung"-Block**

Ersetze die Überschrift/Logik der Abholungs-Karte so, dass sie den Modus berücksichtigt. Titel dynamisch:
```tsx
        <Card>
          <CardHeader><CardTitle>{serviceMode === "dinein" ? "Vor Ort essen" : "Abholung"}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {modes.length === 2 && (
              <div className="flex gap-2">
                {(["dinein", "takeaway"] as const).map((m) => (
                  <button key={m} type="button" onClick={() => setServiceMode(m)}
                    className={"flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition-all " +
                      (serviceMode === m ? "border-primary/50 bg-primary/10 text-primary" : "border-border bg-card text-foreground")}>
                    {m === "dinein" ? "Vor Ort essen" : "Abholen"}
                  </button>
                ))}
              </div>
            )}
            {/* … bestehender Datum/Uhrzeit-Block unverändert … */}
```
> Der bestehende `noDates`/Datum/Uhrzeit-Code bleibt darunter erhalten.

- [ ] **Step 3: Soßenname je Position anzeigen**

Helper neben `ingName`:
```tsx
  const sauceName = (id?: string) => resolveSauce(sauces ?? [], id)?.name;
```
In der Warenkorb-Positionszeile die Beschreibung um die Soße ergänzen (nach den Zutatennamen):
```tsx
                    <p className="text-xs text-muted-foreground truncate">
                      {[sauceName(item.sauceId), ...item.ingredientIds.map(ingName)].filter(Boolean).join(", ") || "Käse & Sauce"}
                    </p>
```

- [ ] **Step 4: Bestellung mit `serviceMode`**

`canOrder` um Modus erweitern und `placeOrder` anpassen:
```tsx
  const canOrder =
    customer.firstName.trim() && customer.lastName.trim() && customer.phone.trim() &&
    pickupDate && pickupTime && cart.length > 0 && !!serviceMode;

  const placeOrder = async () => {
    if (!canOrder || noDates || noService || !serviceMode) return;
    const order = await createOrder({
      items: cart, customer, notes, pickupDate, pickupTime,
      voucherCode: appliedVoucher?.code, serviceMode,
    });
    clearCart();
    navigate("/bestaetigung", { state: order });
  };
```
Den finalen Button ggf. um `|| noService` im `disabled` erweitern:
```tsx
        <Button size="lg" className="w-full font-black text-base shadow-2xl shadow-primary/25"
          disabled={!canOrder || noDates || noService} onClick={placeOrder}>
          {cart.length} Pizza{cart.length !== 1 ? "en" : ""} {serviceMode === "dinein" ? "vor Ort" : "abholen"} — {formatPrice(total)}
        </Button>
```

- [ ] **Step 5: Build + manuell**

Run: `cd Frontend && bun run build` → grün. `bun run dev`:
- Admin: nur „Vor Ort" aktiv → Checkout zeigt „Vor Ort essen" fest, Button „… vor Ort".
- Beide aktiv → Auswahl erscheint.
- Beide aus → Bestellung gesperrt.
- Eigene Pizza mit Pesto → Soßenname in der Warenkorbzeile.
Abbrechen.

- [ ] **Step 6: Commit**

```bash
git add Frontend/src/pages/checkout/checkout-page.tsx
git commit -m "feat(frontend): Checkout mit Service-Modus-Auswahl + Soßen-Anzeige"
```

---

### Task 11: Bestätigung — Modus + Soße

**Files:**
- Modify: `src/pages/confirmation/confirmation-page.tsx`

**Interfaces:**
- Consumes: `order.serviceMode`, `getSauces`, `resolveSauce`.

- [ ] **Step 1: Modus + Soße anzeigen**

Imports ergänzen:
```tsx
import { getIngredients, getSauces } from "@/lib/data/store";
import { resolveSauce } from "@/lib/sauces";
```
Soßen laden und Helper:
```tsx
  const { data: sauces } = useAsync(getSauces);
  const sauceName = (id?: string) => resolveSauce(sauces ?? [], id)?.name;
```
Die „Abholung"-Zeile um den Modus erweitern (Label + Wert):
```tsx
            <div className="flex justify-between">
              <span className="text-muted-foreground">{order.serviceMode === "dinein" ? "Vor Ort" : "Abholung"}</span>
              <span className="font-semibold">{formatDateLabel(order.pickupDate)} · {order.pickupTime} Uhr</span>
            </div>
```
In der Positionszeile die Soße ergänzen (analog Checkout):
```tsx
                    <p className="text-xs text-muted-foreground truncate">
                      {[sauceName(item.sauceId), ...item.ingredientIds.map(ingName)].filter(Boolean).join(", ") || "Käse & Sauce"}
                    </p>
```

- [ ] **Step 2: Build + manuell**

Run: `cd Frontend && bun run build` → grün. `bun run dev`: Bestellung abschließen → Bestätigung zeigt Modus („Vor Ort"/„Abholung") und Soßenname. Abbrechen.

- [ ] **Step 3: Commit**

```bash
git add Frontend/src/pages/confirmation/confirmation-page.tsx
git commit -m "feat(frontend): Bestätigung zeigt Service-Modus + Soße"
```

---

### Task 12: Doku & Gesamt-Verifikation

**Files:**
- Modify: `Doku/Pizza/Changelog.md`, `Doku/Pizza/Frontend/README.md`, `Frontend/README.md`
- Modify: `Doku/Pizza/TODO.md` (Erledigt-Vermerk)

- [ ] **Step 1: Gesamt-Verifikation**

Run: `cd Frontend && bun run build && bun test src`
Expected: Build ohne TS-Fehler; alle Unit-Tests grün (inkl. neue: sauces, use-favorites, slots-Ergänzung, use-cart-Ergänzung, pizza-svg-Ergänzung, store-Ergänzung).

- [ ] **Step 2: Altlasten-/Konsistenz-Check**

Run: `cd Frontend && grep -rInE "mui|emotion|figma:asset" src package.json || echo "sauber"`
Expected: `sauber`.

- [ ] **Step 3: Changelog + READMEs**

`Doku/Pizza/Changelog.md` (Datum 2026-07-10, oben): Eintrag „Teil-A-Erweiterung: Soßen (admin-verwaltbar, färben Vorschau), Favoriten (max 5, Konfigurator + Speisekarte), Service-Modus (Vor Ort / Abholen, admin-schaltbar)."
`Frontend/README.md` + `Doku/Pizza/Frontend/README.md`: je einen kurzen Abschnitt zu Soßen, Favoriten und Service-Modus ergänzen (analog bestehender Struktur).
`Doku/Pizza/TODO.md`: neue Zeile „Teil-A-Erweiterung (Soßen/Favoriten/Service) — erledigt".

- [ ] **Step 4: Commit**

```bash
git add Frontend/README.md Doku/
git commit -m "docs: Teil-A-Erweiterung (Soßen/Favoriten/Service) dokumentiert"
```

---

## Self-Review (durchgeführt)

- **Spec-Abdeckung:** Soße → T1 (Typ/Seed/Store) + T2 (resolveSauce) + T3 (SVG) + T4 (SaucePicker) + T6 (Konfigurator) + T8 (Admin) + T10/T11 (Anzeige). Favoriten → T1 (Typ) + T5 (Hook) + T6 (Konfigurator) + T7 (Speisekarte). Service-Modus → T1 (Config/Order-Typ) + T2 (availableServiceModes) + T9 (Admin) + T10 (Checkout) + T11 (Bestätigung) + T7 (Header). Preis unverändert (pricing.ts nicht in der Dateiliste). DoD → T12.
- **Signatur-Konsistenz:** `addToCart(name, ids, sauceId?)` (T4) einheitlich in T6/T7 verwendet; `createOrder({…, serviceMode})` (T1) in T10 aufgerufen und in `store.test` (T1) angepasst; `resolveSauce(sauces, sauceId?)` und `availableServiceModes(config)` (T2) in T6/T7/T10/T11 identisch genutzt; `PizzaSVG({selected, sauceColor?})` (T3) in T6/T7 genutzt.
- **Build bleibt grün:** `NewOrder.serviceMode`, `CartItem.sauceId` und `PizzaSVG.sauceColor` sind optional → bestehende Aufrufer kompilieren ab T1 weiter. Die einzigen bestehenden `AppConfig`-Literale (in `store.test`/`slots.test`) werden in T1 (Step 4/4b) um `service` ergänzt. So endet jeder Task mit grünem Build + grünen Tests.
- **Platzhalter:** keine offenen TODOs; „ponytail"-Hinweis (fixer Favoritenname) ist eine bewusste, benannte Vereinfachung mit Upgrade-Pfad.
