# Warenkorb-Mengen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Jede Warenkorb-Position bekommt eine Menge (`quantity`); identische Pizzen verschmelzen zu einer Zeile mit Stepper, und die Menge zieht sauber durch Preis, Server-Validierung und alle Auswertungen.

**Architecture:** `CartItem` erhält `quantity`. Der Warenkorb-Hook verschmilzt identische Positionen und bietet Stepper. Preis-, Digest- und Dashboard-Logik summieren Mengen; alle Lese-Pfade behandeln fehlendes `quantity` als 1 (Abwärtskompatibilität für Alt-Bestellungen). Der Postgres-Trigger `validate_order` rechnet den Preis serverseitig aus der abgesicherten Mengensumme neu.

**Tech Stack:** TypeScript, React 18, Vite, `bun test` (bun:test) + Testing Library, Supabase (Postgres/JSONB), Deno (Edge Function).

## Global Constraints

- Preis: pauschal **10 € pro Pizza** (`BASE_PRICE`), Menge multipliziert.
- Mengen-Grenzen: **`clamp` = `Math.max(1, Math.min(20, Math.floor(n)))`** — Client **und** Server klemmen identisch auf `[1, 20]`.
- Fehlendes `quantity` (Alt-Bestellungen aus der DB) zählt überall als **1** (`quantity ?? 1`).
- **Kein Datenmigration** für bestehende Bestellungen (waren implizit Menge 1, korrekt bepreist).
- Test-Runner: `bun test src` (bun:test-API). Build/Typecheck: `bun run build`.
- Dateinamen kebab-case, Komponenten PascalCase. Nach jeder Task committen.
- Arbeitsverzeichnis für Frontend-Befehle: `Frontend/`. Migration liegt in `supabase/migrations/`.

---

### Task 1: Typ + Preis-Helfer

**Files:**
- Modify: `Frontend/src/types/index.ts` (CartItem)
- Modify: `Frontend/src/lib/pricing.ts`
- Test: `Frontend/src/lib/__tests__/pricing.test.ts`

**Interfaces:**
- Produces: `CartItem.quantity: number`; `clampQty(n: number): number`; `cartQuantity(items: { quantity?: number }[]): number`. `computeSubtotal(count)` bleibt unverändert, wird künftig mit `cartQuantity(...)` gefüttert.

- [ ] **Step 1: `quantity` zum Typ hinzufügen**

In `Frontend/src/types/index.ts`, `CartItem` erweitern:

```ts
export interface CartItem {
  cartId: string;
  pizzaName: string;
  ingredientIds: string[];
  sauceId?: string;
  quantity: number; // immer >= 1, geklemmt auf [1, 20]
}
```

- [ ] **Step 2: Failing tests für die Helfer schreiben**

In `Frontend/src/lib/__tests__/pricing.test.ts` ergänzen (Importzeile oben um `clampQty, cartQuantity` erweitern):

```ts
import { clampQty, cartQuantity, computeSubtotal } from "@/lib/pricing";

describe("clampQty", () => {
  it("klemmt in den Bereich [1,20] und rundet ab", () => {
    expect(clampQty(0)).toBe(1);
    expect(clampQty(-5)).toBe(1);
    expect(clampQty(3.9)).toBe(3);
    expect(clampQty(25)).toBe(20);
  });
});

describe("cartQuantity", () => {
  it("summiert quantity, fehlend zählt als 1", () => {
    expect(cartQuantity([{ quantity: 2 }, { quantity: 3 }])).toBe(5);
    expect(cartQuantity([{}, { quantity: 4 }])).toBe(5);
    expect(cartQuantity([])).toBe(0);
  });
  it("computeSubtotal mit Gesamtmenge", () => {
    expect(computeSubtotal(cartQuantity([{ quantity: 2 }, { quantity: 1 }]))).toBe(30);
  });
});
```

- [ ] **Step 3: Test zur Kontrolle laufen lassen (muss fehlschlagen)**

Run: `cd Frontend && bun test src/lib/__tests__/pricing.test.ts`
Expected: FAIL (`clampQty`/`cartQuantity` nicht exportiert).

- [ ] **Step 4: Helfer implementieren**

In `Frontend/src/lib/pricing.ts` nach `BASE_PRICE` einfügen:

```ts
export const MAX_QTY = 20;

export function clampQty(n: number): number {
  return Math.max(1, Math.min(MAX_QTY, Math.floor(n)));
}

export function cartQuantity(items: { quantity?: number }[]): number {
  return items.reduce((s, i) => s + (i.quantity ?? 1), 0);
}
```

- [ ] **Step 5: Tests laufen lassen (müssen bestehen)**

Run: `cd Frontend && bun test src/lib/__tests__/pricing.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add Frontend/src/types/index.ts Frontend/src/lib/pricing.ts Frontend/src/lib/__tests__/pricing.test.ts
git commit -m "feat(cart): quantity im Typ + Preis-Helfer (clampQty/cartQuantity)"
```

---

### Task 2: Warenkorb-Hook (Verschmelzen + Stepper)

**Files:**
- Modify: `Frontend/src/hooks/use-cart.tsx`
- Test: `Frontend/src/hooks/__tests__/use-cart.test.tsx`

**Interfaces:**
- Consumes: `CartItem.quantity`, `clampQty`, `cartQuantity` (Task 1).
- Produces: `addToCart(pizzaName, ingredientIds, sauceId?, qty?)` (verschmilzt bei Gleichheit); `setQuantity(cartId, n)`; `increment(cartId)`; `decrement(cartId)`; `count` = Σ quantity.

- [ ] **Step 1: Failing tests schreiben**

In `Frontend/src/hooks/__tests__/use-cart.test.tsx` ergänzen (die bestehenden Tests bleiben — `count` ist bei je 1 Position weiterhin 1):

```ts
it("verschmilzt identische Positionen und summiert quantity in count", () => {
  const { result } = renderHook(() => useCart(), { wrapper });
  act(() => result.current.addToCart("Margherita", ["salami", "mozzarella"]));
  act(() => result.current.addToCart("Margherita", ["mozzarella", "salami"])); // Reihenfolge egal
  expect(result.current.cart).toHaveLength(1);
  expect(result.current.cart[0].quantity).toBe(2);
  expect(result.current.count).toBe(2);
});
it("trennt bei unterschiedlicher Soße/Name/Zutat", () => {
  const { result } = renderHook(() => useCart(), { wrapper });
  act(() => result.current.addToCart("Margherita", ["mozzarella"], "tomate"));
  act(() => result.current.addToCart("Margherita", ["mozzarella"], "pesto"));
  expect(result.current.cart).toHaveLength(2);
});
it("increment/decrement/setQuantity klemmt auf [1,20]", () => {
  const { result } = renderHook(() => useCart(), { wrapper });
  act(() => result.current.addToCart("Salami", []));
  const id = result.current.cart[0].cartId;
  act(() => result.current.decrement(id)); // bleibt 1
  expect(result.current.cart[0].quantity).toBe(1);
  act(() => result.current.setQuantity(id, 99)); // klemmt 20
  expect(result.current.cart[0].quantity).toBe(20);
  act(() => result.current.increment(id)); // bleibt 20
  expect(result.current.cart[0].quantity).toBe(20);
});
it("addToCart mit Menge verschmilzt geklemmt (Erneut bestellen)", () => {
  const { result } = renderHook(() => useCart(), { wrapper });
  act(() => result.current.addToCart("Hawaii", [], undefined, 15));
  act(() => result.current.addToCart("Hawaii", [], undefined, 15)); // 30 → klemmt 20
  expect(result.current.cart[0].quantity).toBe(20);
});
```

- [ ] **Step 2: Test zur Kontrolle laufen lassen (muss fehlschlagen)**

Run: `cd Frontend && bun test src/hooks/__tests__/use-cart.test.tsx`
Expected: FAIL (`setQuantity`/`increment`/`decrement` fehlen, keine Verschmelzung).

- [ ] **Step 3: Hook implementieren**

`Frontend/src/hooks/use-cart.tsx` vollständig ersetzen durch:

```tsx
import { createContext, useContext, useEffect, useState } from "react";
import type { CartItem } from "@/types";
import { clampQty, cartQuantity } from "@/lib/pricing";

const uid = () => Math.random().toString(36).slice(2, 9);
const KEY = "pizza-cart";

const cartKey = (i: Pick<CartItem, "pizzaName" | "ingredientIds" | "sauceId">) =>
  `${i.pizzaName}|${[...i.ingredientIds].sort().join(",")}|${i.sauceId ?? ""}`;

interface CartContextValue {
  cart: CartItem[];
  addToCart(pizzaName: string, ingredientIds: string[], sauceId?: string, qty?: number): void;
  removeFromCart(cartId: string): void;
  setQuantity(cartId: string, n: number): void;
  increment(cartId: string): void;
  decrement(cartId: string): void;
  clearCart(): void;
  count: number;
}
const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>(() => {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    // Abwärtskompatibel: Alt-Einträge ohne quantity → 1.
    return (JSON.parse(raw) as CartItem[]).map((i) => ({ ...i, quantity: clampQty(i.quantity ?? 1) }));
  });
  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(cart));
  }, [cart]);

  const addToCart = (pizzaName: string, ingredientIds: string[], sauceId?: string, qty = 1) =>
    setCart((p) => {
      const key = cartKey({ pizzaName, ingredientIds, sauceId });
      const idx = p.findIndex((x) => cartKey(x) === key);
      if (idx >= 0) {
        const next = [...p];
        next[idx] = { ...next[idx], quantity: clampQty(next[idx].quantity + qty) };
        return next;
      }
      return [...p, { cartId: uid(), pizzaName, ingredientIds, sauceId, quantity: clampQty(qty) }];
    });

  const removeFromCart = (cartId: string) => setCart((p) => p.filter((x) => x.cartId !== cartId));
  const setQuantity = (cartId: string, n: number) =>
    setCart((p) => p.map((x) => (x.cartId === cartId ? { ...x, quantity: clampQty(n) } : x)));
  const increment = (cartId: string) =>
    setCart((p) => p.map((x) => (x.cartId === cartId ? { ...x, quantity: clampQty(x.quantity + 1) } : x)));
  const decrement = (cartId: string) =>
    setCart((p) => p.map((x) => (x.cartId === cartId ? { ...x, quantity: clampQty(x.quantity - 1) } : x)));
  const clearCart = () => setCart([]);

  return (
    <CartContext.Provider
      value={{ cart, addToCart, removeFromCart, setQuantity, increment, decrement, clearCart, count: cartQuantity(cart) }}
    >
      {children}
    </CartContext.Provider>
  );
}
export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
```

- [ ] **Step 4: Tests laufen lassen (müssen bestehen)**

Run: `cd Frontend && bun test src/hooks/__tests__/use-cart.test.tsx`
Expected: PASS (inkl. der Alt-Tests).

- [ ] **Step 5: Commit**

```bash
git add Frontend/src/hooks/use-cart.tsx Frontend/src/hooks/__tests__/use-cart.test.tsx
git commit -m "feat(cart): identische Positionen verschmelzen + Mengen-Stepper"
```

---

### Task 3: Checkout-UI (Stepper + Mengenpreis)

**Files:**
- Modify: `Frontend/src/pages/checkout/checkout-page.tsx`

**Interfaces:**
- Consumes: `useCart` (`increment`/`decrement`/`removeFromCart`), `cartQuantity`, `BASE_PRICE` (Tasks 1–2).

- [ ] **Step 1: Imports + Subtotal auf Menge umstellen**

In `checkout-page.tsx`:
- Zeile 5: `Minus` zur lucide-Importliste hinzufügen (`X, Plus, Minus, ChefHat, ...`).
- Zeile 28: Destructuring erweitern:
  ```tsx
  const { cart, removeFromCart, clearCart, increment, decrement } = useCart();
  ```
- Zeile 11: Import um `cartQuantity` ergänzen:
  ```tsx
  import { BASE_PRICE, formatPrice, computeSubtotal, computeDiscount, computeTotal, validateVoucher, cartQuantity } from "@/lib/pricing";
  ```
- Zeile 62:
  ```tsx
  const subtotal = computeSubtotal(cartQuantity(cart));
  ```

- [ ] **Step 2: Pizza-Zähler in Header und Button**

- Zeile 130 (Header): `{cart.length} Pizza{cart.length !== 1 ? "en" : ""}` →
  ```tsx
  {cartQuantity(cart)} Pizza{cartQuantity(cart) !== 1 ? "en" : ""}
  ```
- Zeile 329 (Bestell-Button): `{cart.length} Pizza{cart.length !== 1 ? "en" : ""}` →
  ```tsx
  {cartQuantity(cart)} Pizza{cartQuantity(cart) !== 1 ? "en" : ""}
  ```

- [ ] **Step 3: Stepper in der Positions-Zeile**

Den rechten Block der Positions-Zeile (aktuell Zeilen 152–158, `<div className="flex items-center gap-2 shrink-0">…`) ersetzen durch:

```tsx
<div className="flex items-center gap-1.5 shrink-0">
  <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Weniger"
    disabled={item.quantity <= 1} onClick={() => decrement(item.cartId)}>
    <Minus size={13} />
  </Button>
  <span className="w-5 text-center text-sm font-bold tabular-nums">{item.quantity}</span>
  <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Mehr"
    disabled={item.quantity >= 20} onClick={() => increment(item.cartId)}>
    <Plus size={13} />
  </Button>
  <span className="font-black text-sm text-primary w-14 text-right">{formatPrice(BASE_PRICE * item.quantity)}</span>
  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
    onClick={() => removeFromCart(item.cartId)} aria-label="Entfernen">
    <X size={13} />
  </Button>
</div>
```

- [ ] **Step 4: Preisübersicht pro Zeile mit Menge**

Den Map-Block der Preisübersicht (aktuell Zeilen 298–303) ersetzen durch:

```tsx
{cart.map((item) => (
  <div key={item.cartId} className="flex justify-between text-muted-foreground">
    <span>{item.pizzaName}{item.quantity > 1 ? ` × ${item.quantity}` : ""}</span>
    <span>{formatPrice(BASE_PRICE * item.quantity)}</span>
  </div>
))}
```

- [ ] **Step 5: Build/Typecheck**

Run: `cd Frontend && bun run build`
Expected: PASS (keine TS-Fehler; `Minus` importiert, `increment`/`decrement` vorhanden).

- [ ] **Step 6: Commit**

```bash
git add Frontend/src/pages/checkout/checkout-page.tsx
git commit -m "feat(checkout): Mengen-Stepper + Mengenpreis im Warenkorb"
```

---

### Task 4: Menge anzeigen (Bestätigung, Status, Admin, Modal) + Erneut-bestellen mit Menge

**Files:**
- Modify: `Frontend/src/components/orders/order-qr-modal.tsx`
- Modify: `Frontend/src/pages/confirmation/confirmation-page.tsx`
- Modify: `Frontend/src/pages/status/order-status-page.tsx`
- Modify: `Frontend/src/pages/admin/orders-page.tsx`

**Interfaces:**
- Consumes: `cartQuantity`, `BASE_PRICE`, `formatPrice`; DB-Items können `quantity` fehlen → `?? 1`.

- [ ] **Step 1: `order-qr-modal.tsx` — Erneut bestellen reicht Menge durch + Zeilenanzeige**

- Zeile 8 Import um `BASE_PRICE` ergänzen: `import { formatPrice, BASE_PRICE } from "@/lib/pricing";`
- `reorder` (Zeile 29–33) anpassen:
  ```tsx
  const reorder = () => {
    order.items.forEach((item) => addToCart(item.pizzaName, item.ingredientIds, item.sauceId, item.quantity ?? 1));
    onClose();
    navigate("/warenkorb");
  };
  ```
- Namenszeile (Zeile 83) `{item.pizzaName}` → `{item.pizzaName}{(item.quantity ?? 1) > 1 ? ` × ${item.quantity}` : ""}`
- Preiszeile (Zeile 86) `<span className="text-primary font-bold shrink-0">10 €</span>` →
  ```tsx
  <span className="text-primary font-bold shrink-0">{formatPrice(BASE_PRICE * (item.quantity ?? 1))}</span>
  ```

- [ ] **Step 2: `confirmation-page.tsx` — Zähler + Zeilenanzeige**

- Zeile 8 Import: `import { formatPrice, BASE_PRICE, cartQuantity } from "@/lib/pricing";`
- Zeile 44 `{order.items.length} Pizza{order.items.length !== 1 ? "en" : ""}` →
  ```tsx
  {cartQuantity(order.items)} Pizza{cartQuantity(order.items) !== 1 ? "en" : ""}
  ```
- Namenszeile (Zeile 83) `{item.pizzaName}` → `{item.pizzaName}{(item.quantity ?? 1) > 1 ? ` × ${item.quantity}` : ""}`
- Preiszeile (Zeile 88) `10 €` → `{formatPrice(BASE_PRICE * (item.quantity ?? 1))}`

- [ ] **Step 3: `order-status-page.tsx` — Zeilenanzeige**

- Zeile 7 Import: `import { formatPrice, BASE_PRICE } from "@/lib/pricing";`
- Namenszeile (Zeile 71) `{item.pizzaName}` → `{item.pizzaName}{(item.quantity ?? 1) > 1 ? ` × ${item.quantity}` : ""}`
- Preiszeile (Zeile 74) `10 €` → `{formatPrice(BASE_PRICE * (item.quantity ?? 1))}`

- [ ] **Step 4: `admin/orders-page.tsx` — Pizza-Zähler**

- Zeile 7 Import: `import { formatPrice, cartQuantity } from "@/lib/pricing";`
- Zeile 56 `{o.items.length} Pizza{o.items.length !== 1 ? "en" : ""}` →
  ```tsx
  {cartQuantity(o.items)} Pizza{cartQuantity(o.items) !== 1 ? "en" : ""}
  ```

- [ ] **Step 5: Build/Typecheck**

Run: `cd Frontend && bun run build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add Frontend/src/components/orders/order-qr-modal.tsx Frontend/src/pages/confirmation/confirmation-page.tsx Frontend/src/pages/status/order-status-page.tsx Frontend/src/pages/admin/orders-page.tsx
git commit -m "feat(orders): Menge in Bestätigung/Status/Admin/Modal + Erneut-bestellen mit Menge"
```

---

### Task 5: Auswertungen — Dashboard + Digest × Menge

**Files:**
- Modify: `Frontend/src/lib/dashboard.ts`
- Modify: `Frontend/src/lib/digest.ts`
- Test: `Frontend/src/lib/__tests__/dashboard.test.ts`
- Test: `Frontend/src/lib/__tests__/digest.test.ts`

**Interfaces:**
- Consumes: Items mit optionalem `quantity` (DB-Rows). Read-Pfade nutzen `quantity ?? 1`.

- [ ] **Step 1: Failing tests — Dashboard**

In `Frontend/src/lib/__tests__/dashboard.test.ts` ergänzen:

```ts
it("gewichtet Pizza-/Zutaten-Zählung mit quantity (fehlend = 1)", () => {
  const stats = computeDashboard(
    [
      { total: 30, status: "eingegangen", items: [{ pizzaName: "Margherita", ingredientIds: ["m"], quantity: 3 }] },
      { total: 10, status: "eingegangen", items: [{ pizzaName: "Salami", ingredientIds: ["m"] }] }, // kein quantity → 1
    ],
    { m: "Mozzarella" },
  );
  expect(stats.topPizzas.find((p) => p.day === "Margherita")?.n).toBe(3);
  expect(stats.topIngredient).toEqual({ name: "Mozzarella", v: 4 }); // 3 + 1
});
```

- [ ] **Step 2: Test laufen lassen (muss fehlschlagen)**

Run: `cd Frontend && bun test src/lib/__tests__/dashboard.test.ts`
Expected: FAIL (Zählung ohne Gewichtung → Margherita n=1).

- [ ] **Step 3: `dashboard.ts` gewichten**

- Interface `DashboardOrder` (Zeile 5) Items um `quantity` ergänzen:
  ```ts
  items: { pizzaName: string; ingredientIds: string[]; quantity?: number }[];
  ```
- Aggregations-Schleife (Zeilen 28–33) ersetzen durch:
  ```ts
  for (const o of active) {
    for (const it of o.items) {
      const qty = it.quantity ?? 1;
      pizzaCounts[it.pizzaName] = (pizzaCounts[it.pizzaName] ?? 0) + qty;
      for (const id of it.ingredientIds) ingCounts[id] = (ingCounts[id] ?? 0) + qty;
    }
  }
  ```

- [ ] **Step 4: Failing tests — Digest**

In `Frontend/src/lib/__tests__/digest.test.ts` ergänzen:

```ts
it("formatPrepList gewichtet Zutaten/Soßen/Teige mit quantity (fehlend = 1)", () => {
  const msg = formatPrepList(
    [{ items: [{ ingredientIds: ["salami"], sauceId: "tomate", quantity: 3 }, { ingredientIds: ["salami"] }] }],
    { salami: "Salami" }, { tomate: "Tomate" }, "Mo 20.07.",
  );
  expect(msg).toContain("4 Pizzen (= 4 Teige)"); // 3 + 1
  expect(msg).toContain("4× Salami");            // 3 + 1
  expect(msg).toContain("3× Tomate");            // nur die 3er-Position hat Soße
});
it("formatDigest zeigt × n und zählt Pizzen gewichtet", () => {
  const msg = formatDigest(
    [{ pickupDate: "2026-07-20", pickupTime: "18:00", customerName: "A", customerPhone: "1",
       items: [{ pizzaName: "Margherita", quantity: 2 }], total: 20, serviceMode: "takeaway", notes: "" }],
    "Mo 20.07.",
  );
  expect(msg).toContain("2 Pizzen");
  expect(msg).toContain("• Margherita × 2");
});
```

- [ ] **Step 5: Test laufen lassen (muss fehlschlagen)**

Run: `cd Frontend && bun test src/lib/__tests__/digest.test.ts`
Expected: FAIL.

- [ ] **Step 6: `digest.ts` gewichten**

- `DigestOrder.items` (Zeile 9) → `items: { pizzaName: string; quantity?: number }[];`
- `PrepItem` (Zeile 48) → `export interface PrepItem { ingredientIds: string[]; sauceId?: string; quantity?: number }`
- In `formatDigest` den `blocks`-Map (Zeilen 32–43) anpassen: `pizzaCount` gewichten und die Bullet-Zeile um `× n` ergänzen:
  ```ts
  const blocks = orders.map((o) => {
    const pizzaCount = o.items.reduce((s, it) => s + (it.quantity ?? 1), 0);
    const pizzaLabel = `${pizzaCount} ${pizzaCount === 1 ? "Pizza" : "Pizzen"}`;
    const service = o.serviceMode === "dinein" ? "Vor Ort" : "Abholen";
    const lines = [
      `${o.pickupTime} · ${o.customerName} · ${o.customerPhone}`,
      `  ${pizzaLabel} · ${euro(o.total)} · ${service}`,
      ...o.items.map((it) => `  • ${it.pizzaName}${(it.quantity ?? 1) > 1 ? ` × ${it.quantity}` : ""}`),
    ];
    if (o.notes.trim()) lines.push(`  Notiz: ${o.notes.trim()}`);
    return lines.join("\n");
  });
  ```
- In `formatPrepList` die Aggregations-Schleife (Zeilen 64–70) ersetzen durch:
  ```ts
  for (const o of orders) {
    for (const it of o.items) {
      const qty = it.quantity ?? 1;
      doughCount += qty;
      for (const id of it.ingredientIds) ing[id] = (ing[id] ?? 0) + qty;
      if (it.sauceId) sau[it.sauceId] = (sau[it.sauceId] ?? 0) + qty;
    }
  }
  ```

- [ ] **Step 7: Alle Unit-Tests laufen lassen**

Run: `cd Frontend && bun test src`
Expected: PASS (alle bisherigen + neuen Tests grün).

- [ ] **Step 8: Commit**

```bash
git add Frontend/src/lib/dashboard.ts Frontend/src/lib/digest.ts Frontend/src/lib/__tests__/dashboard.test.ts Frontend/src/lib/__tests__/digest.test.ts
git commit -m "feat(reports): Dashboard + Digest gewichten Mengen (Alt = 1)"
```

---

### Task 6: Edge-Function-Copy synchron halten

**Files:**
- Modify: `supabase/functions/daily-digest/index.ts`

**Interfaces:**
- Muss `formatDigest`/`formatPrepList` aus `digest.ts` **wortgleich** spiegeln (Deno-Copy). Kein lokaler Build/Test — der Betreiber deployt.

- [ ] **Step 1: `DigestOrder`/`PrepItem` um quantity ergänzen**

- Zeile 12: `items: { pizzaName: string; quantity?: number }[];`
- Zeile 14: `interface PrepItem { ingredientIds: string[]; sauceId?: string; quantity?: number }`

- [ ] **Step 2: `formatDigest` spiegeln**

Den `blocks`-Map (Zeilen 26–37) exakt wie in Task 5 Step 6 anpassen (`pc` gewichten, Bullet `× n`):

```ts
const blocks = orders.map((o) => {
  const pc = o.items.reduce((s, it) => s + (it.quantity ?? 1), 0);
  const pizzaLabel = `${pc} ${pc === 1 ? "Pizza" : "Pizzen"}`;
  const service = o.serviceMode === "dinein" ? "Vor Ort" : "Abholen";
  const lines = [
    `${o.pickupTime} · ${o.customerName} · ${o.customerPhone}`,
    `  ${pizzaLabel} · ${euro(o.total)} · ${service}`,
    ...o.items.map((it) => `  • ${it.pizzaName}${(it.quantity ?? 1) > 1 ? ` × ${it.quantity}` : ""}`),
  ];
  if (o.notes.trim()) lines.push(`  Notiz: ${o.notes.trim()}`);
  return lines.join("\n");
});
```

- [ ] **Step 3: `formatPrepList` spiegeln**

Die Aggregations-Schleife (Zeilen 52–58) ersetzen durch die gewichtete Variante aus Task 5 Step 6 (`qty = it.quantity ?? 1`; `doughCount`, `ing`, `sau` mit `qty`).

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/daily-digest/index.ts
git commit -m "chore(edge): daily-digest spiegelt Mengen-Gewichtung (Deno-Copy)"
```

> Hinweis für den Betreiber: `bunx supabase functions deploy daily-digest` nach dem Merge.

---

### Task 7: Server-Migration — Preis aus abgesicherter Mengensumme

**Files:**
- Create: `supabase/migrations/0011_order_quantity.sql`

**Interfaces:**
- Ersetzt `public.validate_order` (aus `0007`) per `create or replace`; Trigger aus `0005` bleibt. Kein lokaler Test — der Betreiber führt `bunx supabase db push` aus.

- [ ] **Step 1: Migration schreiben**

`supabase/migrations/0011_order_quantity.sql` anlegen. Identisch zu `0007`, nur die Subtotal-Berechnung nutzt die abgesicherte Mengensumme statt der Positionsanzahl:

```sql
-- Mengen im Warenkorb: Preis serverseitig aus der Summe der (abgesicherten) Positions-Mengen
-- statt aus der Positionsanzahl. Ersetzt validate_order aus 0007; Trigger aus 0005 bleibt.
-- Menge pro Position: fehlend/ungültig -> 1, geklemmt auf [1,20] — gegen Preis-Manipulation via JSON.
create or replace function public.validate_order() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  total_qty int;
  subtotal numeric;
  discount numeric := 0;
  v record;
  cfg record;
  dayname text;
begin
  -- ── Preis serverseitig neu berechnen (überschreibt Client-Werte) ──
  if coalesce(jsonb_array_length(new.items), 0) < 1 then
    raise exception 'Leere Bestellung';
  end if;
  select coalesce(sum(greatest(1, least(20, floor(coalesce((elem->>'quantity')::numeric, 1))::int))), 0)
    into total_qty
    from jsonb_array_elements(new.items) elem;
  subtotal := 10 * total_qty;

  new.free_ingredient := null;
  if new.voucher_code is not null then
    update public.vouchers
       set uses = uses + 1
     where id = (
       select id from public.vouchers
        where code = new.voucher_code
          and active
          and expires_at >= current_date
          and (max_uses <= 0 or uses < max_uses)
        limit 1
        for update
     )
     returning * into v;
    if found then
      if v.type = 'percent' then
        discount := subtotal * v.value / 100;
      elsif v.type = 'fixed' then
        discount := v.value;
      elsif v.type = 'ingredient' then
        discount := 0;
        new.free_ingredient := v.ingredient_name;
      end if;
    else
      new.voucher_code := null;
    end if;
  end if;

  new.subtotal := subtotal;
  new.discount := discount;
  new.total := greatest(0, subtotal - discount);

  -- ── Abhol-Slot prüfen (unverändert zu 0007) ──
  select days, hours, lead_time_days, service into cfg from public.app_config where id = 1;
  if not found then
    raise exception 'Konfiguration fehlt';
  end if;

  if new.pickup_date::date < current_date + cfg.lead_time_days then
    raise exception 'Abholtag zu früh (Vorlaufzeit)';
  end if;

  dayname := case extract(dow from new.pickup_date::date)::int
    when 0 then 'Sonntag' when 1 then 'Montag' when 2 then 'Dienstag'
    when 3 then 'Mittwoch' when 4 then 'Donnerstag' when 5 then 'Freitag'
    when 6 then 'Samstag' end;
  if not coalesce((cfg.days ->> dayname)::boolean, false) then
    raise exception 'Wochentag nicht verfügbar';
  end if;

  if new.pickup_time < (cfg.hours ->> 'from') or new.pickup_time > (cfg.hours ->> 'to') then
    raise exception 'Uhrzeit außerhalb der Öffnungszeiten';
  end if;

  if new.service_mode not in ('dinein', 'takeaway') then
    raise exception 'Ungültiger Service-Modus';
  end if;
  if new.service_mode = 'dinein' and not coalesce((cfg.service ->> 'dineIn')::boolean, false) then
    raise exception 'Service-Modus nicht verfügbar';
  end if;
  if new.service_mode = 'takeaway' and not coalesce((cfg.service ->> 'takeaway')::boolean, false) then
    raise exception 'Service-Modus nicht verfügbar';
  end if;

  return new;
end; $$;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/0011_order_quantity.sql
git commit -m "feat(db): validate_order rechnet Preis aus abgesicherter Mengensumme (0011)"
```

> Hinweis für den Betreiber: `bunx supabase db push` (Migration `0011`) + `bunx supabase functions deploy daily-digest`.

---

### Task 8: Doku aktualisieren

**Files:**
- Modify: `Doku/Pizza/Changelog.md`
- Modify: `Doku/Pizza/TODO.md`

- [ ] **Step 1: Changelog-Eintrag (oben) einfügen**

Unter der `<!-- Neue Einträge oben einfügen -->`-Zeile einen Block mit heutigem Datum: Mengen im Warenkorb (Verschmelzen identischer Positionen, Stepper `[1,20]`, Preis × Menge, Server-Trigger `0011` mit abgesicherter Mengensumme, Dashboard/Digest gewichtet, Alt-Bestellungen = Menge 1). Betreiber: `db push` (0011) + `functions deploy daily-digest`.

- [ ] **Step 2: TODO aktualisieren**

Die versteckte-Gutschein-Zeile (P2) um den Hinweis ergänzen, dass das Cart-Modell jetzt Mengen kennt (Vorbedingung erfüllt). Eine erledigte Zeile „Mengen im Warenkorb" ergänzen.

- [ ] **Step 3: Commit**

```bash
git add Doku/Pizza/Changelog.md Doku/Pizza/TODO.md
git commit -m "docs: Mengen im Warenkorb (Changelog/TODO)"
```

---

## Self-Review

**Spec-Abdeckung:**
- Datenmodell (`quantity`, Gleichheits-Schlüssel) → Task 1 + 2. ✅
- Warenkorb-Hook (merge, Stepper, count) → Task 2. ✅
- Preis (`cartQuantity`, `computeSubtotal`) → Task 1 + 3. ✅
- Server-Migration `0011` (Klemmung [1,20], fehlend→1) → Task 7. ✅
- Lese-Stellen mit `?? 1` (dashboard, digest, Anzeige-Seiten) → Task 4 + 5. ✅
- Edge-Function-Copy (Parität) → Task 6. ✅
- Tests (pricing, use-cart, digest, dashboard, Legacy=1) → Task 1, 2, 5. ✅
- Kein Datenmigration → als Constraint dokumentiert, keine Task nötig. ✅

**Platzhalter:** keine offenen TBD/TODO; jeder Code-Schritt zeigt echten Code.

**Typ-Konsistenz:** `quantity: number` (Task 1) wird überall als `item.quantity` gelesen; DB-/Digest-/Dashboard-Interfaces nutzen `quantity?: number` mit `?? 1`. `clampQty`/`cartQuantity` einheitlich benannt und aus `pricing.ts` importiert.

**Scope:** ein zusammenhängendes Feature, für einen Plan passend.
