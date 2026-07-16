# Sonderartikel/VIP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admins können versteckte **Sonderartikel** anlegen und einzelnen registrierten Kunden mit pro-Kunde-Preis + Mengen-Staffeln freischalten; freigeschaltete Kunden lösen sie per Code im Gutscheinfeld ein und bestellen sie mit Menge — serverseitig autoritativ bepreist und zugangsgeprüft.

**Architecture:** Neue Tabellen `special_items` + `special_item_grants` (RLS admin-only), ein SECURITY-DEFINER-RPC `unlock_special_item` für die Kunden-Einlösung und ein neuer `validate_order`-Trigger, der Preis **und** Zugang serverseitig erzwingt. Im Frontend wird `CartItem` zu einer diskriminierten Union (Pizza | Special); reine, getestete Helfer bepreisen/aggregieren; alle Anzeige-Stellen unterscheiden Pizza vs. Sonderartikel. Phase 2 fügt eine Admin-CRUD-Seite hinzu, Phase 3 blendet Sonderartikel aus Dashboard/Digest-Aggregation aus.

**Tech Stack:** TypeScript/React/Vite, Tailwind + shadcn/ui, **Bun** (Package-Manager + `bun:test`), Supabase (Postgres/RLS/RPC), motion/react, react-router.

## Global Constraints

- **Server autoritativ:** Client-`lineTotal`/`subtotal` sind nur Anzeige; der DB-Trigger `validate_order` überschreibt `subtotal`/`discount`/`total` und bestimmt Zugang. Nie dem Client-Preis vertrauen.
- **Kein Leak:** `unlock_special_item` liefert bei unbekanntem Code UND bei fehlender Freischaltung dasselbe leere Ergebnis. `special_items`/`special_item_grants` sind per RLS **nur für Admins** les-/schreibbar; Kunden greifen ausschließlich über den RPC (nur eigene Freischaltung) zu.
- **Diskretion nach Abholung = JA (nur kundenseitig):** Sobald `status = "abgeholt"`, verschwinden Sonderartikel aus der **Kunden**-Ansicht (mischbestellung: nur die Special-Zeilen; reine Special-Bestellung: ganze Bestellung). Admin sieht immer alles — reines Anzeige-Filtern, kein Löschen.
- **Basiswert = Migration 0011 (mengengewichtet):** Pizza-Subtotal ist `10 € × Σ(Pizza-Menge)`, NICHT `10 € × Positionsanzahl`. Der neue `validate_order` setzt auf 0011 auf.
- **Migration heißt `0012_special_items.sql`** (nächste freie Nummer nach `0011_order_quantity.sql`).
- **Preis-Spiegelung:** Die SQL-Preislogik spiegelt `priceForQty` aus `special-pricing.ts` — bei Änderungen synchron halten (Kommentar im Code pflegen). Ebenso bleibt `digest.ts` ↔ `supabase/functions/daily-digest/index.ts` (Deno-Copy) synchron.
- **Betreiber-Schritte (nach Merge, in dieser Reihenfolge):** `bunx supabase db push` (spielt 0012 ein) **vor** dem Frontend-Deploy, danach `bunx supabase functions deploy daily-digest --use-api --project-ref gvszyvgbbsmlulhqiakp`. Migration MUSS vor dem Deploy laufen, da `createOrder` dann Special-Positionen schreibt, die der neue Trigger prüft.
- **Staffel-Semantik (flach je Stufe):** Für Menge `q` gilt der Stückpreis der Stufe mit dem größten `min_qty ≤ q`; Zeilenpreis = `q × unit_price`. Tiers enthalten immer `min_qty:1` als Basispreis (vom Admin-UI erzwungen). Keine Marginal-/Bracket-Mischpreise.
- **Special-Menge geklemmt auf [1, 99]** (Schutz vor Vertippern); Pizza-Menge bleibt [1, 20].
- **Deviation vom Design-Sketch (bewusst):** Beide Cart-Varianten nutzen das Feld **`quantity`** (nicht `qty` für Specials) — so bleibt der Mengenzugriff an allen Anzeige-Stellen uniform, ohne `kind`-Narrowing. Die Special-Variante trägt zusätzlich `tiers` (damit `setSpecialQty` `lineTotal` neu berechnen kann) und `lineTotal` (persistiert, damit Anzeige ohne Tiers auskommt).

---

### Task 1: Typen — diskriminierte CartItem-Union + Special-Domänentypen

**Files:**
- Modify: `Frontend/src/types/index.ts:38-44` (CartItem)

**Interfaces:**
- Produces: `Tier`, `PizzaCartItem`, `SpecialCartItem`, `CartItem` (union), `SpecialItem`, `SpecialGrant`. Alle folgenden Tasks bauen darauf auf.

- [ ] **Step 1: CartItem durch diskriminierte Union ersetzen und Special-Typen ergänzen**

Ersetze den bestehenden `CartItem`-Block (`Frontend/src/types/index.ts:38-44`) durch:

```ts
export interface Tier {
  min_qty: number;   // aufsteigend; enthält min_qty:1 als Basispreis
  unit_price: number;
}

export interface PizzaCartItem {
  cartId: string;
  kind?: "pizza"; // fehlend = Pizza (rückwärtskompatibel zu Alt-localStorage/Alt-Bestellungen)
  pizzaName: string;
  ingredientIds: string[];
  sauceId?: string;
  quantity: number; // immer >= 1, geklemmt auf [1, 20]
}

export interface SpecialCartItem {
  cartId: string;
  kind: "special";
  specialItemId: string;
  code: string;
  name: string;
  emoji: string;
  tiers: Tier[];      // für Neuberechnung von lineTotal bei Mengenänderung
  quantity: number;   // geklemmt auf [1, 99]
  lineTotal: number;  // client-berechneter Anzeigepreis (NICHT autoritativ), persistiert
}

export type CartItem = PizzaCartItem | SpecialCartItem;
```

- [ ] **Step 2: Admin-Domänentypen am Dateiende ergänzen**

Füge am Ende von `Frontend/src/types/index.ts` an:

```ts
export interface SpecialItem {
  id: string;
  code: string;
  name: string;
  emoji: string;
  active: boolean;
}

export interface SpecialGrant {
  id: string;
  itemId: string;
  userId: string;
  tiers: Tier[];
  active: boolean;
}
```

- [ ] **Step 3: Typecheck (erwartet Fehler an Nutzungsstellen — als Arbeitsliste)**

Run: `cd Frontend && bunx tsc --noEmit`
Expected: FEHLER in Dateien, die `item.ingredientIds`/`item.pizzaName` ohne `kind`-Narrowing lesen (checkout, confirmation, order-status, order-qr-modal, dashboard, store, use-cart). Das ist erwartet — die folgenden Tasks beheben sie. (Keine neuen Fehler in `types/index.ts` selbst.)

- [ ] **Step 4: Commit**

```bash
git add Frontend/src/types/index.ts
git commit -m "feat(types): CartItem diskriminierte Union (Pizza|Special) + Special-Domänentypen"
```

---

### Task 2: Reine Staffel-Preislogik `priceForQty` (TDD)

**Files:**
- Create: `Frontend/src/lib/special-pricing.ts`
- Test: `Frontend/src/lib/__tests__/special-pricing.test.ts`

**Interfaces:**
- Consumes: `Tier` (Task 1)
- Produces: `priceForQty(tiers: Tier[], qty: number): number` — wählt die Stufe mit größtem `min_qty ≤ qty` und liefert `qty × unit_price`. Leere Tiers → `0`. `qty` unter kleinster Stufe → kleinste Stufe.

- [ ] **Step 1: Failing test schreiben**

`Frontend/src/lib/__tests__/special-pricing.test.ts`:

```ts
import { describe, it, expect } from "bun:test";
import { priceForQty } from "@/lib/special-pricing";
import type { Tier } from "@/types";

const tiers: Tier[] = [
  { min_qty: 1, unit_price: 6 },
  { min_qty: 3, unit_price: 4 },
  { min_qty: 10, unit_price: 3 },
];

describe("priceForQty", () => {
  it("Basisstufe: 1 Stück = 6€", () => expect(priceForQty(tiers, 1)).toBe(6));
  it("unter nächster Stufe: 2 Stück = 12€", () => expect(priceForQty(tiers, 2)).toBe(12));
  it("Stufengrenze exakt: 3 Stück = 12€", () => expect(priceForQty(tiers, 3)).toBe(12));
  it("mittlere Stufe: 9 Stück = 36€", () => expect(priceForQty(tiers, 9)).toBe(36));
  it("oberste Stufe: 10 Stück = 30€", () => expect(priceForQty(tiers, 10)).toBe(30));
  it("unsortierte Tiers liefern dasselbe", () => {
    const unsorted: Tier[] = [{ min_qty: 10, unit_price: 3 }, { min_qty: 1, unit_price: 6 }, { min_qty: 3, unit_price: 4 }];
    expect(priceForQty(unsorted, 3)).toBe(12);
  });
  it("qty unter kleinster Stufe nutzt kleinste Stufe", () => {
    expect(priceForQty([{ min_qty: 2, unit_price: 5 }], 1)).toBe(5);
  });
  it("leere Tiers => 0", () => expect(priceForQty([], 3)).toBe(0));
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag prüfen**

Run: `cd Frontend && bun test special-pricing`
Expected: FAIL mit "Cannot find module '@/lib/special-pricing'" bzw. `priceForQty is not a function`.

- [ ] **Step 3: Minimale Implementierung**

`Frontend/src/lib/special-pricing.ts`:

```ts
import type { Tier } from "@/types";

// Reine Staffel-Preislogik. SPIEGELT public.special_line_price aus Migration 0012 — synchron halten!
// Semantik: flach je Stufe — Stückpreis der Stufe mit größtem min_qty <= qty, Zeilenpreis = qty * unit_price.
export function priceForQty(tiers: Tier[], qty: number): number {
  if (!tiers || tiers.length === 0) return 0;
  const sorted = [...tiers].sort((a, b) => a.min_qty - b.min_qty);
  let chosen = sorted[0]; // Fallback: kleinste Stufe (qty unter kleinster min_qty)
  for (const t of sorted) {
    if (t.min_qty <= qty) chosen = t;
  }
  return qty * chosen.unit_price;
}
```

- [ ] **Step 4: Test laufen lassen, Erfolg prüfen**

Run: `cd Frontend && bun test special-pricing`
Expected: PASS (alle 7 Assertions grün).

- [ ] **Step 5: Commit**

```bash
git add Frontend/src/lib/special-pricing.ts Frontend/src/lib/__tests__/special-pricing.test.ts
git commit -m "feat(pricing): reine Staffel-Preislogik priceForQty (bun:test)"
```

---

### Task 3: Cart-Item-Helfer (Typguard, Titel, Zeilenpreis, Aggregation) (TDD)

**Files:**
- Create: `Frontend/src/lib/cart-items.ts`
- Test: `Frontend/src/lib/__tests__/cart-items.test.ts`

**Interfaces:**
- Consumes: `CartItem`, `SpecialCartItem`, `PizzaCartItem` (Task 1), `BASE_PRICE` (`@/lib/pricing`)
- Produces:
  - `isSpecialItem(item: CartItem): item is SpecialCartItem`
  - `itemTitle(item: CartItem): string` — Pizza: `pizzaName`; Special: `${emoji} ${name}`
  - `itemLineTotal(item: CartItem): number` — Pizza: `BASE_PRICE × quantity`; Special: `item.lineTotal`
  - `pizzaQuantity(items: CartItem[]): number` — Summe der Mengen nur der Pizza-Positionen
  - `specialsTotal(items: CartItem[]): number` — Summe der `lineTotal` der Special-Positionen
  - `cartSubtotal(items: CartItem[]): number` — `BASE_PRICE × pizzaQuantity + specialsTotal`

- [ ] **Step 1: Failing test schreiben**

`Frontend/src/lib/__tests__/cart-items.test.ts`:

```ts
import { describe, it, expect } from "bun:test";
import { isSpecialItem, itemTitle, itemLineTotal, pizzaQuantity, specialsTotal, cartSubtotal } from "@/lib/cart-items";
import type { CartItem, PizzaCartItem, SpecialCartItem } from "@/types";

const pizza: PizzaCartItem = { cartId: "p1", pizzaName: "Margherita", ingredientIds: ["cheese"], quantity: 2 };
const special: SpecialCartItem = {
  cartId: "s1", kind: "special", specialItemId: "it1", code: "WEED420",
  name: "Special", emoji: "🌿", tiers: [{ min_qty: 1, unit_price: 6 }], quantity: 3, lineTotal: 18,
};
const cart: CartItem[] = [pizza, special];

describe("cart-items", () => {
  it("isSpecialItem erkennt Specials", () => {
    expect(isSpecialItem(special)).toBe(true);
    expect(isSpecialItem(pizza)).toBe(false);
  });
  it("itemTitle: Pizza=Name, Special=Emoji+Name", () => {
    expect(itemTitle(pizza)).toBe("Margherita");
    expect(itemTitle(special)).toBe("🌿 Special");
  });
  it("itemLineTotal: Pizza=10*qty, Special=lineTotal", () => {
    expect(itemLineTotal(pizza)).toBe(20);
    expect(itemLineTotal(special)).toBe(18);
  });
  it("pizzaQuantity zählt nur Pizzas", () => expect(pizzaQuantity(cart)).toBe(2));
  it("specialsTotal summiert lineTotal der Specials", () => expect(specialsTotal(cart)).toBe(18));
  it("cartSubtotal = 10*Pizzamenge + Specials", () => expect(cartSubtotal(cart)).toBe(38));
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag prüfen**

Run: `cd Frontend && bun test cart-items`
Expected: FAIL mit "Cannot find module '@/lib/cart-items'".

- [ ] **Step 3: Minimale Implementierung**

`Frontend/src/lib/cart-items.ts`:

```ts
import type { CartItem, SpecialCartItem } from "@/types";
import { BASE_PRICE } from "@/lib/pricing";

export function isSpecialItem(item: CartItem): item is SpecialCartItem {
  return item.kind === "special";
}

export function itemTitle(item: CartItem): string {
  return isSpecialItem(item) ? `${item.emoji} ${item.name}` : item.pizzaName;
}

export function itemLineTotal(item: CartItem): number {
  return isSpecialItem(item) ? item.lineTotal : BASE_PRICE * (item.quantity ?? 1);
}

export function pizzaQuantity(items: CartItem[]): number {
  return items.reduce((s, i) => (isSpecialItem(i) ? s : s + (i.quantity ?? 1)), 0);
}

export function specialsTotal(items: CartItem[]): number {
  return items.reduce((s, i) => (isSpecialItem(i) ? s + i.lineTotal : s), 0);
}

export function cartSubtotal(items: CartItem[]): number {
  return BASE_PRICE * pizzaQuantity(items) + specialsTotal(items);
}
```

- [ ] **Step 4: Test laufen lassen, Erfolg prüfen**

Run: `cd Frontend && bun test cart-items`
Expected: PASS (6 Assertions grün).

- [ ] **Step 5: Commit**

```bash
git add Frontend/src/lib/cart-items.ts Frontend/src/lib/__tests__/cart-items.test.ts
git commit -m "feat(cart): reine Cart-Item-Helfer (Typguard, Titel, Zeilenpreis, Aggregation)"
```

---

### Task 4: `useCart` — Sonderartikel hinzufügen / Menge setzen; count zählt nur Pizzas

**Files:**
- Modify: `Frontend/src/hooks/use-cart.tsx`
- Modify: `Frontend/src/lib/pricing.ts`
- Modify: `Frontend/src/lib/cart-items.ts` (Reducer-Helfer)
- Test: `Frontend/src/lib/__tests__/cart-special-reducer.test.ts`

**Interfaces:**
- Consumes: `CartItem`, `SpecialCartItem`, `Tier` (Task 1); `priceForQty` (Task 2); `isSpecialItem`, `pizzaQuantity` (Task 3); `clampQty` (`@/lib/pricing`)
- Produces (erweitert `CartContextValue`):
  - `addSpecial(input: SpecialInput): void` — fügt mit Menge 1 hinzu; identische `specialItemId` verschmelzen (Menge +1, lineTotal neu).
  - `setSpecialQty(cartId: string, n: number): void` — Menge auf `clampSpecialQty(n)` setzen, `lineTotal` via `priceForQty` neu.
  - `count` zählt künftig nur Pizzas (`pizzaQuantity`).
- Produces in `@/lib/pricing`: `clampSpecialQty(n: number): number`, `MAX_SPECIAL_QTY`.
- Produces in `@/lib/cart-items`: `SpecialInput`, `addSpecialTo`, `setSpecialQtyIn`.

- [ ] **Step 1: `clampSpecialQty` + `MAX_SPECIAL_QTY` in pricing.ts ergänzen**

In `Frontend/src/lib/pricing.ts` nach `clampQty` (Zeile 9) einfügen:

```ts
export const MAX_SPECIAL_QTY = 99;

export function clampSpecialQty(n: number): number {
  return Math.max(1, Math.min(MAX_SPECIAL_QTY, Math.floor(n)));
}
```

- [ ] **Step 2: Reducer-Test für addSpecial/setSpecialQty (TDD, reine Helfer)**

`Frontend/src/lib/__tests__/cart-special-reducer.test.ts`:

```ts
import { describe, it, expect } from "bun:test";
import { addSpecialTo, setSpecialQtyIn } from "@/lib/cart-items";
import type { CartItem } from "@/types";

const base = { specialItemId: "it1", code: "WEED420", name: "Special", emoji: "🌿", tiers: [{ min_qty: 1, unit_price: 6 }, { min_qty: 3, unit_price: 4 }] };

describe("cart special reducer", () => {
  it("addSpecialTo fügt mit Menge 1 + lineTotal hinzu", () => {
    const next = addSpecialTo([], base, "s1");
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ cartId: "s1", kind: "special", quantity: 1, lineTotal: 6 });
  });
  it("addSpecialTo verschmilzt gleiche specialItemId (Menge +1, lineTotal neu)", () => {
    const once = addSpecialTo([], base, "s1");
    const twice = addSpecialTo(once, base, "s2");
    expect(twice).toHaveLength(1);
    expect(twice[0]).toMatchObject({ quantity: 2, lineTotal: 12 });
  });
  it("setSpecialQtyIn klemmt und rechnet lineTotal über Staffel neu", () => {
    const once = addSpecialTo([], base, "s1");
    const bumped = setSpecialQtyIn(once as CartItem[], "s1", 3);
    expect(bumped[0]).toMatchObject({ quantity: 3, lineTotal: 12 });
  });
});
```

- [ ] **Step 3: Reducer-Helfer in cart-items.ts ergänzen (Test soll grün werden)**

In `Frontend/src/lib/cart-items.ts` die Import-Zeilen oben erweitern und die Reducer anfügen:

```ts
import type { CartItem, SpecialCartItem, Tier } from "@/types";
import { BASE_PRICE, clampSpecialQty } from "@/lib/pricing";
import { priceForQty } from "@/lib/special-pricing";
```

```ts
export interface SpecialInput {
  specialItemId: string; code: string; name: string; emoji: string; tiers: Tier[];
}

// Reine Reducer: von useCart genutzt, hier für Tests entkoppelt.
export function addSpecialTo(cart: CartItem[], input: SpecialInput, newCartId: string): CartItem[] {
  const idx = cart.findIndex((x) => isSpecialItem(x) && x.specialItemId === input.specialItemId);
  if (idx >= 0) {
    const cur = cart[idx] as SpecialCartItem;
    const quantity = clampSpecialQty(cur.quantity + 1);
    const next = [...cart];
    next[idx] = { ...cur, quantity, lineTotal: priceForQty(cur.tiers, quantity) };
    return next;
  }
  const item: SpecialCartItem = {
    cartId: newCartId, kind: "special", specialItemId: input.specialItemId, code: input.code,
    name: input.name, emoji: input.emoji, tiers: input.tiers, quantity: 1, lineTotal: priceForQty(input.tiers, 1),
  };
  return [...cart, item];
}

export function setSpecialQtyIn(cart: CartItem[], cartId: string, n: number): CartItem[] {
  return cart.map((x) => {
    if (x.cartId !== cartId || !isSpecialItem(x)) return x;
    const quantity = clampSpecialQty(n);
    return { ...x, quantity, lineTotal: priceForQty(x.tiers, quantity) };
  });
}
```

- [ ] **Step 4: Reducer-Test laufen lassen**

Run: `cd Frontend && bun test cart-special-reducer`
Expected: PASS (3 Assertions grün).

- [ ] **Step 5: `useCart` verdrahten**

In `Frontend/src/hooks/use-cart.tsx`:

(a) Import-Zeile 3 ersetzen:

```ts
import { clampQty } from "@/lib/pricing";
import { addSpecialTo, setSpecialQtyIn, pizzaQuantity, type SpecialInput } from "@/lib/cart-items";
```

(b) localStorage-Migration (Zeile 28) so, dass Specials unangetastet bleiben:

```ts
    return (JSON.parse(raw) as CartItem[]).map((i) =>
      i.kind === "special" ? i : { ...i, quantity: clampQty(i.quantity ?? 1) }
    );
```

(c) `CartContextValue` (Zeile 11-20) um zwei Methoden erweitern:

```ts
  addSpecial(input: SpecialInput): void;
  setSpecialQty(cartId: string, n: number): void;
```

(d) Innerhalb `CartProvider` nach `decrement` (Zeile 52) ergänzen:

```ts
  const addSpecial = (input: SpecialInput) => setCart((p) => addSpecialTo(p, input, uid()));
  const setSpecialQty = (cartId: string, n: number) => setCart((p) => setSpecialQtyIn(p, cartId, n));
```

(e) Provider-`value` (Zeile 56-58): `addSpecial, setSpecialQty` ergänzen und `count` auf Pizzas umstellen:

```ts
      value={{ cart, addToCart, removeFromCart, setQuantity, increment, decrement, addSpecial, setSpecialQty, clearCart, count: pizzaQuantity(cart) }}
```

- [ ] **Step 6: Typecheck (nur Cart-Kette) + Tests**

Run: `cd Frontend && bunx tsc --noEmit 2>&1 | grep "use-cart\|cart-items\|pricing.ts" ; bun test cart`
Expected: Keine Typfehler mit `use-cart`/`cart-items`/`pricing.ts` im Pfad (verbleibende Fehler nur in noch nicht angefassten Anzeige-Dateien). Cart-Tests PASS.

- [ ] **Step 7: Commit**

```bash
git add Frontend/src/hooks/use-cart.tsx Frontend/src/lib/cart-items.ts Frontend/src/lib/pricing.ts Frontend/src/lib/__tests__/cart-special-reducer.test.ts
git commit -m "feat(cart): addSpecial/setSpecialQty; count zählt nur Pizzas"
```

---

### Task 5: Migration 0012 — Tabellen, RLS, RPC, `validate_order`, Diskretion in `get_order_status`

**Files:**
- Create: `supabase/migrations/0012_special_items.sql`

**Interfaces:**
- Produces (DB): Tabellen `special_items`, `special_item_grants`; Funktionen `public.special_line_price(jsonb,int)`, `public.unlock_special_item(text)`, neuer `public.validate_order()`, geänderter `public.get_order_status(uuid)`.

> **Hinweis:** SQL ist in dieser Umgebung nicht ausführbar → kein automatischer Test. Sorgfältiges Review; der Betreiber spielt via `bunx supabase db push` ein. Der `validate_order`-Trigger aus 0005 bleibt bestehen; hier wird nur die Funktion ersetzt (`create or replace`).

- [ ] **Step 1: Migration-Datei anlegen — Tabellen + RLS**

`supabase/migrations/0012_special_items.sql`:

```sql
-- Sonderartikel/VIP: versteckte, kontogebunden freischaltbare Menü-Items mit pro-Kunde-Preis + Staffeln.
-- Ersetzt validate_order aus 0011 (Preis jetzt inkl. Sonderartikel + serverseitige Zugangsprüfung).
-- Trigger aus 0005 bleibt; hier nur create-or-replace der Funktionen.

-- ── Tabellen ─────────────────────────────────────────────
create table if not exists public.special_items (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  name       text not null,
  emoji      text not null default '⭐',
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.special_item_grants (
  id         uuid primary key default gen_random_uuid(),
  item_id    uuid not null references public.special_items(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  tiers      jsonb not null default '[]'::jsonb, -- [{ "min_qty": int, "unit_price": numeric }, …]
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  unique (item_id, user_id)
);

alter table public.special_items       enable row level security;
alter table public.special_item_grants enable row level security;

-- Nur Admins lesen/schreiben direkt (Kunden ausschließlich über unlock_special_item-RPC).
create policy special_items_admin  on public.special_items       for all using (public.is_admin()) with check (public.is_admin());
create policy special_grants_admin on public.special_item_grants for all using (public.is_admin()) with check (public.is_admin());

-- Grants (Muster wie 0009): Tabellen-Berechtigung vor RLS. Neu erstellte Tabellen brauchen sie explizit,
-- falls ein db reset die Default-Privilegien nicht greifen lässt.
grant all on public.special_items       to postgres, anon, authenticated, service_role;
grant all on public.special_item_grants to postgres, anon, authenticated, service_role;
```

- [ ] **Step 2: Preis-Helfer `special_line_price` (spiegelt priceForQty)**

Am Ende der Datei anfügen:

```sql
-- Spiegelt priceForQty aus Frontend/src/lib/special-pricing.ts — synchron halten!
-- Flach je Stufe: Stückpreis der Stufe mit größtem min_qty <= qty, Zeilenpreis = qty * unit_price.
create or replace function public.special_line_price(p_tiers jsonb, p_qty int)
returns numeric language plpgsql immutable set search_path = public as $$
declare
  best_price numeric := null;
  best_min   int := -1;
  e jsonb;
  m int;
  up numeric;
begin
  if p_tiers is null or jsonb_typeof(p_tiers) <> 'array' or jsonb_array_length(p_tiers) = 0 then
    raise exception 'Ungültige Sonderartikel-Preisstaffel';
  end if;
  for e in select * from jsonb_array_elements(p_tiers) loop
    m  := (e->>'min_qty')::int;
    up := (e->>'unit_price')::numeric;
    if m <= p_qty and m > best_min then
      best_min := m;
      best_price := up;
    end if;
  end loop;
  if best_price is null then
    raise exception 'Keine passende Preisstaffel für Menge %', p_qty;
  end if;
  return p_qty * best_price;
end; $$;
```

- [ ] **Step 3: Einlöse-RPC `unlock_special_item`**

Anfügen:

```sql
-- Kunden-Einlösung: liefert die EIGENE Freischaltung oder leer (kein Leak, ob Code existiert).
create or replace function public.unlock_special_item(p_code text)
returns table (special_item_id uuid, name text, emoji text, tiers jsonb)
language sql security definer stable set search_path = public as $$
  select si.id, si.name, si.emoji, g.tiers
  from public.special_items si
  join public.special_item_grants g on g.item_id = si.id
  where si.code = p_code and si.active
    and g.user_id = auth.uid() and g.active
  limit 1;
$$;

grant execute on function public.unlock_special_item(text) to authenticated;
```

- [ ] **Step 4: Neuer `validate_order` (Pizza mengengewichtet + Sonderartikel autoritativ)**

Anfügen — vollständige Funktion (ersetzt 0011):

```sql
-- Preis serverseitig: 10€ * Σ(Pizza-Menge) + Σ(Sonderartikel-Zeilenpreise, über Grant+Staffel).
-- Sonderartikel ohne aktiven Grant für new.user_id -> Bestellung scheitert.
create or replace function public.validate_order() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  pizza_qty int := 0;
  specials_sum numeric := 0;
  subtotal numeric;
  discount numeric := 0;
  v record;
  cfg record;
  dayname text;
  elem jsonb;
  q int;
  sid uuid;
  g record;
begin
  if coalesce(jsonb_array_length(new.items), 0) < 1 then
    raise exception 'Leere Bestellung';
  end if;

  for elem in select * from jsonb_array_elements(new.items) loop
    if elem->>'kind' = 'special' then
      q := greatest(1, least(99, floor(coalesce((elem->>'quantity')::numeric, 1))::int));
      sid := (elem->>'specialItemId')::uuid;
      select g2.tiers into g
        from public.special_item_grants g2
        join public.special_items si on si.id = g2.item_id
       where g2.item_id = sid and g2.user_id = new.user_id and g2.active and si.active
       limit 1;
      if not found then
        raise exception 'Kein Zugang zu Sonderartikel';
      end if;
      specials_sum := specials_sum + public.special_line_price(g.tiers, q);
    else
      pizza_qty := pizza_qty + greatest(1, least(20, floor(coalesce((elem->>'quantity')::numeric, 1))::int));
    end if;
  end loop;

  subtotal := 10 * pizza_qty + specials_sum;

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

  -- ── Abhol-Slot prüfen (unverändert zu 0011) ──
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

- [ ] **Step 5: Diskretion in `get_order_status` (öffentliche Status-Seite)**

Anfügen — ersetzt die RPC aus 0010; blendet nach Abholung Sonderartikel aus, versteckt reine Special-Bestellungen ganz:

```sql
-- Öffentliche Status-RPC (ersetzt 0010): nach Abholung Sonderartikel diskret.
-- - status='abgeholt': Sonderartikel-Positionen werden aus items entfernt.
-- - bestand die Bestellung NUR aus Sonderartikeln -> keine Zeile zurück (nicht gefunden).
create or replace function public.get_order_status(p_token uuid)
returns table (
  id text, status text, pickup_date text, pickup_time text,
  service_mode text, items jsonb, total numeric, created_at timestamptz, labels jsonb
)
language sql security definer stable set search_path = public as $$
  with o as (
    select * from public.orders where public_token = p_token
  ),
  filtered as (
    select o.*,
      case when o.status = 'abgeholt'
        then coalesce((
          select jsonb_agg(it) from jsonb_array_elements(o.items) it
          where it->>'kind' is distinct from 'special'
        ), '[]'::jsonb)
        else o.items
      end as vis_items
    from o
  ),
  ing_ids as (
    select distinct ing.value as id
    from filtered f,
         jsonb_array_elements(f.vis_items) it,
         jsonb_array_elements_text(it->'ingredientIds') ing(value)
  ),
  sauce_ids as (
    select distinct (it->>'sauceId') as id
    from filtered f, jsonb_array_elements(f.vis_items) it
    where it->>'sauceId' is not null
  ),
  lbl as (
    select i.id, i.name from public.ingredients i where i.id in (select id from ing_ids)
    union
    select s.id, s.name from public.sauces s where s.id in (select id from sauce_ids)
  )
  select f.id, f.status, f.pickup_date, f.pickup_time,
         f.service_mode, f.vis_items, f.total, f.created_at,
         coalesce((select jsonb_object_agg(lbl.id, lbl.name) from lbl), '{}'::jsonb) as labels
  from filtered f
  where jsonb_array_length(f.vis_items) > 0;  -- reine Special-Bestellung nach Abholung -> ausgeblendet
$$;

grant execute on function public.get_order_status(uuid) to anon, authenticated;
```

- [ ] **Step 6: Review-Gate (statt Ausführung)**

Prüfe manuell: (a) `special_line_price` spiegelt `priceForQty` (größtes `min_qty ≤ qty`, `qty × unit_price`); (b) `validate_order` nutzt `new.user_id` für den Grant-Lookup (kein Fremdpreis); (c) `get_order_status` gibt bei `total` weiterhin den DB-`total` (inkl. Special) zurück — das ist gewollt (Kunde sah den Preis bei Bestellung); nur die **Positionen** werden nach Abholung gefiltert.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0012_special_items.sql
git commit -m "feat(db): 0012 Sonderartikel — Tabellen/RLS, unlock-RPC, validate_order (Zugang+Staffelpreis), get_order_status-Diskretion"
```

---

### Task 6: Store — Einlöse-RPC, Admin-CRUD, `createOrder` mit Specials, Kunden-Diskretion

**Files:**
- Modify: `Frontend/src/lib/data/store.ts`
- Modify: `Frontend/src/lib/cart-items.ts` (Diskretions-Helfer)
- Test: `Frontend/src/lib/__tests__/order-discretion.test.ts`

**Interfaces:**
- Consumes: `SpecialItem`, `SpecialGrant`, `OrderRow` (Task 1); `cartSubtotal`, `isSpecialItem` (Task 3); `SpecialInput` (Task 4)
- Produces:
  - `unlockSpecialItem(code: string): Promise<SpecialInput | null>`
  - `getSpecialItems(): Promise<SpecialItem[]>`, `saveSpecialItem(item: SpecialItem): Promise<void>`, `deleteSpecialItem(id: string): Promise<void>`
  - `getGrants(itemId: string): Promise<SpecialGrant[]>`, `saveGrant(grant: SpecialGrant): Promise<void>`, `deleteGrant(id: string): Promise<void>`
  - `redactPickedUpSpecials(orders: OrderRow[]): OrderRow[]` (in `@/lib/cart-items`)
  - `createOrder` schreibt Special-Positionen; `subtotal` über `cartSubtotal`.
  - `getMyOrders` wendet `redactPickedUpSpecials` an.

- [ ] **Step 1: Failing test für Diskretions-Helfer**

`Frontend/src/lib/__tests__/order-discretion.test.ts`:

```ts
import { describe, it, expect } from "bun:test";
import { redactPickedUpSpecials } from "@/lib/cart-items";
import type { OrderRow } from "@/types";

const mk = (status: OrderRow["status"], items: OrderRow["items"]): OrderRow => ({
  id: "#1", publicToken: "t", items, total: 30, serviceMode: "takeaway",
  pickupDate: "2026-07-16", pickupTime: "18:00", notes: "", status, createdAt: "", userId: "u1",
});
const pizza = { cartId: "p", pizzaName: "Marg", ingredientIds: ["cheese"], quantity: 1 } as const;
const special = { cartId: "s", kind: "special", specialItemId: "it", code: "C", name: "S", emoji: "🌿", tiers: [], quantity: 1, lineTotal: 6 } as const;

describe("redactPickedUpSpecials", () => {
  it("aktiv: nichts filtern", () => {
    const out = redactPickedUpSpecials([mk("in_arbeit", [pizza, special])]);
    expect(out[0].items).toHaveLength(2);
  });
  it("abgeholt + gemischt: Special entfernen, Pizza bleibt", () => {
    const out = redactPickedUpSpecials([mk("abgeholt", [pizza, special])]);
    expect(out[0].items).toHaveLength(1);
    expect(out[0].items[0].cartId).toBe("p");
  });
  it("abgeholt + nur Special: Bestellung ganz raus", () => {
    const out = redactPickedUpSpecials([mk("abgeholt", [special])]);
    expect(out).toHaveLength(0);
  });
});
```

- [ ] **Step 2: `redactPickedUpSpecials` in cart-items.ts ergänzen**

In `Frontend/src/lib/cart-items.ts` den `OrderRow`-Import zu den Typen hinzufügen und den Helfer anfügen:

```ts
import type { CartItem, SpecialCartItem, Tier, OrderRow } from "@/types";
```

```ts
// Kundenseitige Diskretion: nach Abholung Sonderartikel ausblenden; reine Special-Bestellung ganz entfernen.
export function redactPickedUpSpecials(orders: OrderRow[]): OrderRow[] {
  const out: OrderRow[] = [];
  for (const o of orders) {
    if (o.status !== "abgeholt") { out.push(o); continue; }
    const items = o.items.filter((it) => !isSpecialItem(it));
    if (items.length === 0) continue;
    out.push({ ...o, items });
  }
  return out;
}
```

- [ ] **Step 3: Test laufen lassen**

Run: `cd Frontend && bun test order-discretion`
Expected: PASS (3 Assertions).

- [ ] **Step 4: Store — RPC + Admin-CRUD + createOrder + getMyOrders**

In `Frontend/src/lib/data/store.ts`:

(a) Imports (Zeile 1-6) erweitern:

```ts
import type { AppConfig, IngredientItem, NewOrder, NotifyConfig, OrderData, OrderRow, OrderStatus, PizzaTemplate, VoucherDef, Sauce, User, PublicOrderStatus, SpecialItem, SpecialGrant } from "@/types";
import type { SpecialInput } from "@/lib/cart-items";
import { computeDiscount, computeTotal, validateVoucher } from "@/lib/pricing";
import { cartSubtotal, redactPickedUpSpecials } from "@/lib/cart-items";
```

(`computeSubtotal` und `cartQuantity` werden von `createOrder` nicht mehr gebraucht — aus dem `@/lib/pricing`-Import entfernen; falls `tsc` sie anderswo noch als genutzt meldet, dort belassen.)

(b) `createOrder` (Zeile 74): `subtotal`-Zeile ersetzen:

```ts
  const subtotal = cartSubtotal(input.items);
```

(Die `items`-jsonb-Persistenz bleibt `items: order.items` — die Union serialisiert Specials mitsamt `kind`/`specialItemId`/`quantity`/`lineTotal`. Keine weitere Änderung nötig.)

(c) `getMyOrders` (Zeile 147): Rückgabe durch Diskretion filtern. Ersetze die letzte Zeile der Funktion:

```ts
  return redactPickedUpSpecials((data ?? []).map(rowToOrder));
```

(d) Nach `getOrderStatus` (Zeile 103) neue Funktionen einfügen:

```ts
// ── Sonderartikel (VIP) ──
export async function unlockSpecialItem(code: string): Promise<SpecialInput | null> {
  const { data, error } = await supabase.rpc("unlock_special_item", { p_code: code });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return { specialItemId: row.special_item_id, code, name: row.name, emoji: row.emoji, tiers: row.tiers ?? [] };
}

export async function getSpecialItems(): Promise<SpecialItem[]> {
  const { data, error } = await supabase.from("special_items").select("*").order("created_at");
  if (error) throw error;
  return (data ?? []).map((r) => ({ id: r.id, code: r.code, name: r.name, emoji: r.emoji, active: r.active }));
}
export async function saveSpecialItem(item: SpecialItem): Promise<void> {
  const { error } = await supabase.from("special_items").upsert({
    id: item.id, code: item.code, name: item.name, emoji: item.emoji, active: item.active,
  });
  if (error) throw error;
}
export async function deleteSpecialItem(id: string): Promise<void> {
  const { error } = await supabase.from("special_items").delete().eq("id", id);
  if (error) throw error;
}

export async function getGrants(itemId: string): Promise<SpecialGrant[]> {
  const { data, error } = await supabase.from("special_item_grants").select("*").eq("item_id", itemId);
  if (error) throw error;
  return (data ?? []).map((r) => ({ id: r.id, itemId: r.item_id, userId: r.user_id, tiers: r.tiers ?? [], active: r.active }));
}
export async function saveGrant(grant: SpecialGrant): Promise<void> {
  const { error } = await supabase.from("special_item_grants").upsert({
    id: grant.id, item_id: grant.itemId, user_id: grant.userId, tiers: grant.tiers, active: grant.active,
  }, { onConflict: "item_id,user_id" });
  if (error) throw error;
}
export async function deleteGrant(id: string): Promise<void> {
  const { error } = await supabase.from("special_item_grants").delete().eq("id", id);
  if (error) throw error;
}
```

- [ ] **Step 5: Typecheck (Store-Datei sauber) + Tests**

Run: `cd Frontend && bunx tsc --noEmit 2>&1 | grep "store.ts" ; bun test`
Expected: Keine Fehler mit `store.ts` im Pfad. Alle bestehenden + neuen Tests PASS.

- [ ] **Step 6: Commit**

```bash
git add Frontend/src/lib/data/store.ts Frontend/src/lib/cart-items.ts Frontend/src/lib/__tests__/order-discretion.test.ts
git commit -m "feat(store): unlockSpecialItem + Special-Admin-CRUD; createOrder/getMyOrders mit Sonderartikeln + Diskretion"
```

---

### Task 7: Checkout — Code-Einlösung im Gutscheinfeld, Special-Zeilen mit Stepper, Preisübersicht, Zähler

**Files:**
- Modify: `Frontend/src/pages/checkout/checkout-page.tsx`

**Interfaces:**
- Consumes: `useCart().addSpecial/setSpecialQty` (Task 4); `unlockSpecialItem` (Task 6); `isSpecialItem`, `itemLineTotal`, `cartSubtotal`, `pizzaQuantity` (Task 3)

- [ ] **Step 1: Imports + Cart-Destrukturierung erweitern**

In `checkout-page.tsx`:

(a) Zeile 6: `unlockSpecialItem` importieren:

```ts
import { getConfig, getIngredients, getVouchers, getSauces, createOrder, unlockSpecialItem } from "@/lib/data/store";
```

(b) Zeile 11: Preis-Imports auf Helfer umstellen:

```ts
import { BASE_PRICE, formatPrice, computeDiscount, computeTotal, validateVoucher } from "@/lib/pricing";
import { isSpecialItem, itemLineTotal, cartSubtotal, pizzaQuantity } from "@/lib/cart-items";
```

(`computeSubtotal` und `cartQuantity` aus dem pricing-Import entfernen; `BASE_PRICE` bleibt zunächst, wird in Step 4/5 durch `itemLineTotal` verdrängt — nach Umbau prüfen und ggf. entfernen.)

(c) Zeile 28: Destrukturierung:

```ts
  const { cart, removeFromCart, clearCart, increment, decrement, addSpecial, setSpecialQty } = useCart();
```

- [ ] **Step 2: Subtotal + Pizza-Zähler**

Ersetze Zeile 62-64:

```ts
  const subtotal = cartSubtotal(cart);
  const discount = computeDiscount(subtotal, appliedVoucher);
  const total = computeTotal(subtotal, discount);
```

Ersetze überall `cartQuantity(cart)` durch `pizzaQuantity(cart)` (Zeilen 68 `canOrder`, 130 Header, 338 Bottom-Button).

- [ ] **Step 3: Gutschein-Einlösung erweitert um Sonderartikel-Code**

Ersetze `applyVoucher` (Zeile 70-80) durch:

```ts
  const applyVoucher = async () => {
    // Zuerst prüfen, ob der Code ein freigeschalteter Sonderartikel ist.
    try {
      const special = await unlockSpecialItem(voucherCode.trim());
      if (special) {
        addSpecial(special);
        setVoucherMessage({ ok: true, text: `${special.emoji} ${special.name} freigeschaltet!` });
        setVoucherCode("");
        return;
      }
    } catch {
      // Netzwerk-/RPC-Fehler: still weiter zum normalen Gutschein-Flow.
    }
    const vouchers = await getVouchers();
    const result = validateVoucher(voucherCode, vouchers, new Date());
    if (result.ok) {
      setAppliedVoucher(result.voucher);
      setVoucherMessage({ ok: true, text: result.message });
    } else {
      setAppliedVoucher(null);
      setVoucherMessage({ ok: false, text: result.message });
    }
  };
```

- [ ] **Step 4: Warenkorb-Positionen — Pizza vs. Sonderartikel rendern**

Ersetze die Positionsliste (Zeile 139-170, `{cart.map(...)}`) durch:

```tsx
            {cart.map((item, i) => (
              <div key={item.cartId}>
                {i > 0 && <Separator className="mb-3" />}
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 shrink-0 flex items-center justify-center">
                    {isSpecialItem(item)
                      ? <span className="text-2xl">{item.emoji}</span>
                      : <PizzaSVG selected={item.ingredientIds} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{isSpecialItem(item) ? item.name : item.pizzaName}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {isSpecialItem(item)
                        ? "Sonderartikel"
                        : [sauceName(item.sauceId), ...item.ingredientIds.map(ingName)].filter(Boolean).join(", ") || "Käse & Sauce"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Weniger"
                      disabled={item.quantity <= 1}
                      onClick={() => isSpecialItem(item) ? setSpecialQty(item.cartId, item.quantity - 1) : decrement(item.cartId)}>
                      <Minus size={13} />
                    </Button>
                    <span className="w-5 text-center text-sm font-bold tabular-nums">{item.quantity}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Mehr"
                      disabled={item.quantity >= (isSpecialItem(item) ? 99 : 20)}
                      onClick={() => isSpecialItem(item) ? setSpecialQty(item.cartId, item.quantity + 1) : increment(item.cartId)}>
                      <Plus size={13} />
                    </Button>
                    <span className="font-black text-sm text-primary w-14 text-right">{formatPrice(itemLineTotal(item))}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => removeFromCart(item.cartId)} aria-label="Entfernen">
                      <X size={13} />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
```

- [ ] **Step 5: Preisübersicht — Zeilenpreis je Position vereinheitlichen**

Ersetze die Preisübersicht-Map (Zeile 307-312) durch:

```tsx
            {cart.map((item) => (
              <div key={item.cartId} className="flex justify-between text-muted-foreground">
                <span>{isSpecialItem(item) ? item.name : item.pizzaName}{item.quantity > 1 ? ` × ${item.quantity}` : ""}</span>
                <span>{formatPrice(itemLineTotal(item))}</span>
              </div>
            ))}
```

(Prüfe danach, ob `BASE_PRICE` in dieser Datei noch verwendet wird; falls nicht, Import entfernen — `noUnusedLocals`.)

- [ ] **Step 6: Typecheck + Build**

Run: `cd Frontend && bunx tsc --noEmit 2>&1 | grep "checkout-page" ; bun run build`
Expected: Keine Fehler mit `checkout-page` im Pfad; Build erfolgreich.

- [ ] **Step 7: Commit**

```bash
git add Frontend/src/pages/checkout/checkout-page.tsx
git commit -m "feat(checkout): Sonderartikel per Code einlösen, Stepper + Zeilenpreis, Zähler nur Pizzas"
```

---

### Task 8: Bestätigungsseite — Sonderartikel-Positionen

**Files:**
- Modify: `Frontend/src/pages/confirmation/confirmation-page.tsx`

**Interfaces:**
- Consumes: `isSpecialItem`, `itemLineTotal`, `pizzaQuantity` (Task 3)

- [ ] **Step 1: Imports anpassen**

Ersetze Zeile 8:

```ts
import { formatPrice } from "@/lib/pricing";
import { isSpecialItem, itemLineTotal, pizzaQuantity } from "@/lib/cart-items";
```

(`BASE_PRICE`/`cartQuantity` aus dem pricing-Import entfernen.)

- [ ] **Step 2: „N Pizzen"-Zeile auf pizzaQuantity umstellen**

Ersetze Zeile 44 (innerhalb `<p>`):

```tsx
            {pizzaQuantity(order.items)} Pizza{pizzaQuantity(order.items) !== 1 ? "en" : ""} werden vorbereitet.
```

- [ ] **Step 3: Positionsliste Pizza vs. Sonderartikel**

Ersetze die Items-Map (Zeile 78-92) durch:

```tsx
            {order.items.map((item, i) => (
              <div key={item.cartId}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 shrink-0 flex items-center justify-center">
                    {isSpecialItem(item)
                      ? <span className="text-xl">{item.emoji}</span>
                      : <PizzaSVG selected={item.ingredientIds} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{(isSpecialItem(item) ? item.name : item.pizzaName)}{item.quantity > 1 ? ` × ${item.quantity}` : ""}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {isSpecialItem(item)
                        ? "Sonderartikel"
                        : [sauceName(item.sauceId), ...item.ingredientIds.map(ingName)].filter(Boolean).join(", ") || "Käse & Sauce"}
                    </p>
                  </div>
                  <span className="text-primary font-bold shrink-0">{formatPrice(itemLineTotal(item))}</span>
                </div>
                {i < order.items.length - 1 && <Separator className="mt-3" />}
              </div>
            ))}
```

- [ ] **Step 4: Typecheck**

Run: `cd Frontend && bunx tsc --noEmit 2>&1 | grep "confirmation-page"`
Expected: Keine Ausgabe (keine Fehler).

- [ ] **Step 5: Commit**

```bash
git add Frontend/src/pages/confirmation/confirmation-page.tsx
git commit -m "feat(confirmation): Sonderartikel-Positionen (Emoji + lineTotal)"
```

---

### Task 9: Öffentliche Status-Seite + `describeItem` — Sonderartikel

**Files:**
- Modify: `Frontend/src/lib/public-order.ts`
- Modify: `Frontend/src/pages/status/order-status-page.tsx`
- Modify: `Frontend/src/lib/__tests__/public-order.test.ts`

**Interfaces:**
- Consumes: `isSpecialItem`, `itemTitle`, `itemLineTotal` (Task 3)
- Produces: `describeItem` behandelt Specials (liefert `"Sonderartikel"`).

- [ ] **Step 1: Failing test für describeItem mit Special**

In `Frontend/src/lib/__tests__/public-order.test.ts` ergänzen (Import `describeItem`/`expect` sind dort vorhanden; `SpecialCartItem`-Import ergänzen):

```ts
import type { SpecialCartItem } from "@/types";

it("describeItem: Sonderartikel liefert 'Sonderartikel'", () => {
  const special = { cartId: "s", kind: "special", specialItemId: "it", code: "C", name: "S", emoji: "🌿", tiers: [], quantity: 1, lineTotal: 6 } as SpecialCartItem;
  expect(describeItem(special, {})).toBe("Sonderartikel");
});
```

- [ ] **Step 2: Test laufen lassen (Fehlschlag)**

Run: `cd Frontend && bun test public-order`
Expected: FAIL — `describeItem` liest `item.ingredientIds` (bei Special `undefined`) → wirft oder liefert nicht `"Sonderartikel"`.

- [ ] **Step 3: describeItem guardet Specials**

In `Frontend/src/lib/public-order.ts` (Zeile 1-11) ersetzen:

```ts
import type { CartItem, PublicOrderStatus } from "@/types";
import { isSpecialItem } from "@/lib/cart-items";

export function describeItem(item: CartItem, labels: Record<string, string>): string {
  if (isSpecialItem(item)) return "Sonderartikel";
  const parts = [
    item.sauceId ? labels[item.sauceId] : undefined,
    ...item.ingredientIds.map((id) => labels[id]),
  ].filter(Boolean);
  return parts.join(", ") || "Käse & Sauce";
}
```

(`rowToPublicStatus` darunter bleibt unverändert.)

- [ ] **Step 4: Test laufen lassen (Erfolg)**

Run: `cd Frontend && bun test public-order`
Expected: PASS.

- [ ] **Step 5: Status-Seite — Titel/Emoji/lineTotal**

In `Frontend/src/pages/status/order-status-page.tsx`:

(a) Zeile 7: Import:

```ts
import { formatPrice } from "@/lib/pricing";
import { isSpecialItem, itemTitle, itemLineTotal } from "@/lib/cart-items";
```

(`BASE_PRICE` aus dem pricing-Import entfernen.) `isSpecialItem` wird zwar nicht direkt referenziert, wenn `itemTitle`/`itemLineTotal`/`describeItem` alles kapseln — importiere nur, was du nutzt (`itemTitle`, `itemLineTotal`).

(b) Items-Map (Zeile 67-78) ersetzen:

```tsx
            {status.items.map((item, i) => (
              <div key={item.cartId ?? i}>
                <div className="flex justify-between items-start gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{itemTitle(item)}{item.quantity > 1 ? ` × ${item.quantity}` : ""}</p>
                    <p className="text-xs text-muted-foreground truncate">{describeItem(item, status.labels)}</p>
                  </div>
                  <span className="text-primary font-bold shrink-0">{formatPrice(itemLineTotal(item))}</span>
                </div>
                {i < status.items.length - 1 && <Separator className="mt-3" />}
              </div>
            ))}
```

- [ ] **Step 6: Typecheck + Tests**

Run: `cd Frontend && bunx tsc --noEmit 2>&1 | grep "order-status-page\|public-order" ; bun test public-order`
Expected: Keine Typfehler; Tests PASS.

- [ ] **Step 7: Commit**

```bash
git add Frontend/src/lib/public-order.ts Frontend/src/pages/status/order-status-page.tsx Frontend/src/lib/__tests__/public-order.test.ts
git commit -m "feat(status): Sonderartikel auf öffentlicher Status-Seite; describeItem guardet Specials"
```

---

### Task 10: „Meine Bestellungen"-Modal + Karten — Sonderartikel + Reorder schließt Specials aus

**Files:**
- Modify: `Frontend/src/components/orders/order-qr-modal.tsx`
- Modify: `Frontend/src/pages/orders/my-orders-page.tsx`

**Interfaces:**
- Consumes: `isSpecialItem`, `itemTitle`, `itemLineTotal` (Task 3); `describeItem` (bestehend)

- [ ] **Step 1: Modal — Reorder überspringt Sonderartikel**

In `order-qr-modal.tsx` `reorder` (Zeile ~27-33) ersetzen:

```tsx
  const reorder = () => {
    order.items.forEach((item) => {
      if (item.kind === "special") return; // Sonderartikel brauchen Code/Grant → nicht mit-reordern
      addToCart(item.pizzaName, item.ingredientIds, item.sauceId, item.quantity ?? 1);
    });
    onClose();
    navigate("/warenkorb");
  };
```

- [ ] **Step 2: Modal — Imports + Positionsdarstellung**

(a) Import-Zeilen (Zeile 7-8-Bereich) ersetzen:

```ts
import { formatPrice } from "@/lib/pricing";
import { isSpecialItem, itemTitle, itemLineTotal } from "@/lib/cart-items";
```

(`BASE_PRICE` aus dem pricing-Import entfernen.)

(b) Items-Map (Zeile ~90-104) ersetzen:

```tsx
          {order.items.map((item, i) => (
            <div key={item.cartId ?? i}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 shrink-0 flex items-center justify-center">
                  {isSpecialItem(item)
                    ? <span className="text-xl">{item.emoji}</span>
                    : <PizzaSVG selected={item.ingredientIds} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">{itemTitle(item)}{item.quantity > 1 ? ` × ${item.quantity}` : ""}</p>
                  <p className="text-xs text-muted-foreground truncate">{describeItem(item, labels)}</p>
                </div>
                <span className="text-primary font-bold shrink-0">{formatPrice(itemLineTotal(item))}</span>
              </div>
              {i < order.items.length - 1 && <Separator className="mt-3" />}
            </div>
          ))}
```

- [ ] **Step 3: „Erneut bestellen"-Button ausblenden, wenn keine Pizza übrig**

Ersetze den Reorder-Button (letzte Zeilen des Modals) durch:

```tsx
        {order.items.some((it) => it.kind !== "special") && (
          <Button className="w-full gap-2" onClick={reorder}>
            <RotateCcw size={15} /> Erneut bestellen
          </Button>
        )}
```

- [ ] **Step 4: My-Orders-Karten — Sonderartikel-Icon statt PizzaSVG**

In `my-orders-page.tsx` die Item-Vorschau (Zeile 51-53) ersetzen:

```tsx
                    {o.items.map((item, i) => (
                      <div key={item.cartId ?? i} className="w-8 h-8 flex items-center justify-center">
                        {item.kind === "special"
                          ? <span className="text-lg">{item.emoji}</span>
                          : <PizzaSVG selected={item.ingredientIds} />}
                      </div>
                    ))}
```

(Diskretion nach Abholung passiert bereits in `getMyOrders` via `redactPickedUpSpecials` — Task 6.)

- [ ] **Step 5: Typecheck + Build**

Run: `cd Frontend && bunx tsc --noEmit 2>&1 | grep "order-qr-modal\|my-orders-page" ; bun run build`
Expected: Keine Typfehler in beiden Dateien; Build ok.

- [ ] **Step 6: Commit**

```bash
git add Frontend/src/components/orders/order-qr-modal.tsx Frontend/src/pages/orders/my-orders-page.tsx
git commit -m "feat(my-orders): Sonderartikel in Modal/Karten; Reorder schließt Specials aus"
```

---

### Task 11: Admin-Bestellansicht — Sonderartikel-Positionen

**Files:**
- Modify: `Frontend/src/pages/admin/orders-page.tsx`

**Interfaces:**
- Consumes: `pizzaQuantity`, `isSpecialItem` (Task 3)

- [ ] **Step 1: Imports + Zeile mit Sonderartikel-Hinweis**

(a) Zeile 7: Import:

```ts
import { formatPrice } from "@/lib/pricing";
import { pizzaQuantity, isSpecialItem } from "@/lib/cart-items";
```

(`cartQuantity` aus dem pricing-Import entfernen.)

(b) Meta-Zeile (Zeile 55-57) ersetzen:

```tsx
                      <p className="text-xs text-muted-foreground">
                        {o.serviceMode === "dinein" ? "Vor Ort" : "Abholung"} · {o.pickupDate} · {o.pickupTime} Uhr · {pizzaQuantity(o.items)} Pizza{pizzaQuantity(o.items) !== 1 ? "en" : ""} · {formatPrice(o.total)}
                      </p>
                      {o.items.some(isSpecialItem) && (
                        <p className="text-xs text-primary/80">
                          {o.items.filter(isSpecialItem).map((it) => `${it.emoji} ${it.name}${it.quantity > 1 ? ` × ${it.quantity}` : ""}`).join(", ")}
                        </p>
                      )}
```

- [ ] **Step 2: Typecheck (nur diese Datei)**

Run: `cd Frontend && bunx tsc --noEmit 2>&1 | grep "admin/orders-page"`
Expected: Keine Ausgabe.

- [ ] **Step 3: Voller Typecheck — jetzt komplett grün**

Run: `cd Frontend && bunx tsc --noEmit`
Expected: KEINE Fehler (alle Anzeige-Stellen aus Task 1-Step-3 sind behoben).

- [ ] **Step 4: Commit**

```bash
git add Frontend/src/pages/admin/orders-page.tsx
git commit -m "feat(admin-orders): Sonderartikel-Positionen; Pizzazähler ohne Specials"
```

---

### Task 12: Admin-Seite „Sonderartikel" (Items + Freischaltungen + Staffeln) — Phase 2

**Files:**
- Create: `Frontend/src/pages/admin/special-items-page.tsx`
- Modify: `Frontend/src/router.tsx`
- Modify: `Frontend/src/components/layout/admin-shell.tsx`

**Interfaces:**
- Consumes: `getSpecialItems`, `saveSpecialItem`, `deleteSpecialItem`, `getGrants`, `saveGrant`, `deleteGrant`, `getProfiles` (Task 6 / bestehend); `SpecialItem`, `SpecialGrant`, `User`, `Tier` (Task 1); `priceForQty` (Task 2)

- [ ] **Step 1: Route registrieren**

In `Frontend/src/router.tsx`:

(a) Import nach Zeile 24:

```ts
import SpecialItemsPage from "@/pages/admin/special-items-page";
```

(b) Child-Route nach Zeile 54 (`gutscheine`):

```tsx
      { path: "sonderartikel", element: <SpecialItemsPage /> },
```

- [ ] **Step 2: Nav-Tab ergänzen**

In `Frontend/src/components/layout/admin-shell.tsx`:

(a) Zeile 4: `Star` zum lucide-Import hinzufügen:

```ts
import { BarChart2, Calendar, Clock, Timer, Package, Droplet, Tag, Users, ChefHat, LogOut, Store, User, ClipboardList, MessageSquare, Star } from "lucide-react";
```

(b) NAV-Array nach der `gutscheine`-Zeile (Zeile 20) ergänzen:

```ts
  { to: "/admin/sonderartikel",   icon: Star,      label: "Sonderartikel"  },
```

- [ ] **Step 3: Admin-Seite anlegen**

`Frontend/src/pages/admin/special-items-page.tsx`:

```tsx
import type React from "react";
import { useEffect, useState, useCallback } from "react";
import { Plus, X, Star, Trash2 } from "lucide-react";
import {
  getSpecialItems, saveSpecialItem, deleteSpecialItem,
  getGrants, saveGrant, deleteGrant, getProfiles,
} from "@/lib/data/store";
import { useAsync } from "@/hooks/use-async";
import { priceForQty } from "@/lib/special-pricing";
import { formatPrice } from "@/lib/pricing";
import type { SpecialItem, SpecialGrant, User, Tier } from "@/types";
import { AsyncBoundary } from "@/components/common/async-boundary";
import { SelectInput } from "@/components/common/select-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const newId = () => crypto.randomUUID();
const EMPTY_ITEM = { code: "", name: "", emoji: "⭐" };

export default function SpecialItemsPage(): React.ReactElement {
  const { data, loading, error } = useAsync(getSpecialItems);
  const { data: profiles } = useAsync(getProfiles);
  const [items, setItems] = useState<SpecialItem[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_ITEM);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => { if (data) setItems(data); }, [data]);

  const addItem = async () => {
    if (!items) return;
    if (!form.code.trim() || !form.name.trim()) return;
    const item: SpecialItem = { id: newId(), code: form.code.trim(), name: form.name.trim(), emoji: form.emoji.trim() || "⭐", active: true };
    await saveSpecialItem(item);
    setItems([...items, item]);
    setForm(EMPTY_ITEM);
    setShowForm(false);
  };
  const toggleItem = async (it: SpecialItem) => {
    const next = { ...it, active: !it.active };
    await saveSpecialItem(next);
    setItems((items ?? []).map((x) => (x.id === it.id ? next : x)));
  };
  const removeItem = async (id: string) => {
    await deleteSpecialItem(id);
    setItems((items ?? []).filter((x) => x.id !== id));
    if (expanded === id) setExpanded(null);
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-lg flex items-center gap-2"><Star size={16} className="text-primary" /> Sonderartikel</h2>
        <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={() => setShowForm(!showForm)}>
          <Plus size={12} /> Neuer Artikel
        </Button>
      </div>

      {showForm && (
        <Card className="border-primary/20">
          <CardHeader><CardTitle className="text-sm">Neuen Sonderartikel</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5 col-span-1">
                <Label>Emoji</Label>
                <Input value={form.emoji} onChange={(e) => setForm((f) => ({ ...f, emoji: e.target.value }))} />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Name</Label>
                <Input placeholder="VIP-Artikel" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Code (Einlösung im Gutscheinfeld)</Label>
              <Input placeholder="weed420" className="font-mono" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} />
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={addItem}><Plus size={13} /> Erstellen</Button>
              <Button variant="ghost" onClick={() => setShowForm(false)}>Abbrechen</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <AsyncBoundary loading={loading} error={error} data={items}
        empty={<p className="text-sm text-muted-foreground text-center py-8">Noch keine Sonderartikel.</p>}>
        {(list: SpecialItem[]) => (
          <div className="space-y-3">
            {list.map((it) => (
              <Card key={it.id} className={it.active ? "" : "opacity-45"}>
                <CardContent className="pt-4 pb-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xl">{it.emoji}</span>
                        <span className="font-bold">{it.name}</span>
                        <Badge variant={it.active ? "success" : "secondary"}>{it.active ? "Aktiv" : "Inaktiv"}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 font-mono">{it.code}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Switch checked={it.active} onCheckedChange={() => toggleItem(it)} />
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => removeItem(it.id)}>
                        <X size={12} />
                      </Button>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="text-xs" onClick={() => setExpanded(expanded === it.id ? null : it.id)}>
                    {expanded === it.id ? "Freischaltungen ausblenden" : "Freischaltungen verwalten"}
                  </Button>
                  {expanded === it.id && <GrantsEditor itemId={it.id} profiles={profiles ?? []} />}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </AsyncBoundary>
    </div>
  );
}

// ── Freischaltungen je Item (Nutzer + Staffeln) ──
function GrantsEditor({ itemId, profiles }: { itemId: string; profiles: User[] }): React.ReactElement {
  const load = useCallback(() => getGrants(itemId), [itemId]);
  const { data, loading, reload } = useAsync(load);
  const [grants, setGrants] = useState<SpecialGrant[]>([]);
  const [userId, setUserId] = useState("");

  useEffect(() => { if (data) setGrants(data); }, [data]);

  const customers = profiles.filter((p) => p.role === "customer");
  const nameOf = (id: string) => {
    const p = profiles.find((x) => x.id === id);
    return p ? `${p.firstName} ${p.lastName} (${p.email})`.trim() : id;
  };

  const addGrant = async () => {
    if (!userId || grants.some((g) => g.userId === userId)) return;
    const grant: SpecialGrant = { id: crypto.randomUUID(), itemId, userId, tiers: [{ min_qty: 1, unit_price: 0 }], active: true };
    await saveGrant(grant);
    setUserId("");
    reload();
  };
  const persist = async (g: SpecialGrant) => { await saveGrant(g); setGrants((cur) => cur.map((x) => (x.id === g.id ? g : x))); };
  const removeGrant = async (id: string) => { await deleteGrant(id); setGrants((cur) => cur.filter((x) => x.id !== id)); };

  const setTier = (g: SpecialGrant, idx: number, patch: Partial<Tier>) => {
    const tiers = g.tiers.map((t, i) => (i === idx ? { ...t, ...patch } : t));
    void persist({ ...g, tiers });
  };
  const addTier = (g: SpecialGrant) => void persist({ ...g, tiers: [...g.tiers, { min_qty: 1, unit_price: 0 }] });
  const removeTier = (g: SpecialGrant, idx: number) => void persist({ ...g, tiers: g.tiers.filter((_, i) => i !== idx) });

  if (loading) return <p className="text-xs text-muted-foreground">Lädt…</p>;

  return (
    <div className="space-y-3 border-t border-border pt-3">
      <div className="flex gap-2">
        <SelectInput value={userId} onChange={setUserId} placeholder="Kunde wählen…"
          options={customers.filter((c) => !grants.some((g) => g.userId === c.id)).map((c) => ({ value: c.id, label: `${c.firstName} ${c.lastName} (${c.email})` }))} />
        <Button size="sm" className="shrink-0" onClick={addGrant}>Freischalten</Button>
      </div>
      {grants.length === 0 && <p className="text-xs text-muted-foreground">Noch niemand freigeschaltet.</p>}
      {grants.map((g) => (
        <Card key={g.id} className="bg-muted/30">
          <CardContent className="py-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold">{nameOf(g.userId)}</span>
              <div className="flex items-center gap-1.5">
                <Switch checked={g.active} onCheckedChange={() => void persist({ ...g, active: !g.active })} />
                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => removeGrant(g.id)}>
                  <Trash2 size={12} />
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px]">Staffeln (ab Menge → Stückpreis €)</Label>
              {g.tiers.map((t, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input type="number" min="1" className="h-8 w-20" value={t.min_qty}
                    onChange={(e) => setTier(g, idx, { min_qty: parseInt(e.target.value, 10) || 1 })} />
                  <span className="text-xs text-muted-foreground">→</span>
                  <Input type="number" min="0" step="0.5" className="h-8 w-24" value={t.unit_price}
                    onChange={(e) => setTier(g, idx, { unit_price: parseFloat(e.target.value) || 0 })} />
                  <span className="text-xs text-muted-foreground">€/Stk</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => removeTier(g, idx)}>
                    <X size={11} />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => addTier(g)}>
                <Plus size={11} /> Stufe
              </Button>
              <p className="text-[11px] text-muted-foreground">Beispiel 3 Stück: {formatPrice(priceForQty(g.tiers, 3))}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Typecheck + Build**

Run: `cd Frontend && bunx tsc --noEmit ; bun run build`
Expected: KEINE Typfehler; Build erfolgreich.

- [ ] **Step 5: Commit**

```bash
git add Frontend/src/pages/admin/special-items-page.tsx Frontend/src/router.tsx Frontend/src/components/layout/admin-shell.tsx
git commit -m "feat(admin): Sonderartikel-Verwaltung (Items + Freischaltungen + Staffeln)"
```

---

### Task 13: Dashboard — Sonderartikel aus Aggregation ausschließen (Phase 3, TDD)

**Files:**
- Modify: `Frontend/src/lib/dashboard.ts`
- Modify: `Frontend/src/lib/__tests__/dashboard.test.ts`

**Interfaces:**
- Consumes: bestehende `computeDashboard`-Signatur; Special-Items im jsonb tragen `kind:"special"`.

- [ ] **Step 1: Failing test — Special zählt nicht bei Pizza/Zutat, aber im Umsatz**

In `Frontend/src/lib/__tests__/dashboard.test.ts` ergänzen:

```ts
it("Sonderartikel: nicht in Pizza-/Zutaten-Zählung, aber Umsatz zählt", () => {
  const stats = computeDashboard([
    { total: 30, status: "eingegangen", items: [
      { pizzaName: "Margherita", ingredientIds: ["cheese"], quantity: 2 },
      { kind: "special", pizzaName: "", ingredientIds: [], quantity: 3 } as any,
    ] },
  ], { cheese: "Käse" });
  expect(stats.totalRevenue).toBe(30);          // Umsatz via order.total unverändert
  expect(stats.topPizzas).toEqual([{ day: "Margherita", n: 2 }]); // Special nicht als Pizza
  expect(stats.topIngredients).toEqual([{ name: "Käse", v: 2 }]); // Special-Menge nicht auf Zutaten
});
```

- [ ] **Step 2: Test laufen lassen (Fehlschlag)**

Run: `cd Frontend && bun test dashboard`
Expected: FAIL — Special-`pizzaName:""` erzeugt einen Pizza-Eintrag / verfälscht Zählung.

- [ ] **Step 3: `kind:"special"` in der Schleife überspringen + Typ erweitern**

In `Frontend/src/lib/dashboard.ts`:

(a) `DashboardOrder.items`-Typ (Zeile 5) erweitern:

```ts
  items: { pizzaName?: string; ingredientIds?: string[]; quantity?: number; kind?: string }[];
```

(b) In der Aggregations-Schleife (Zeile 28-34) das innere Item überspringen:

```ts
  for (const o of active) {
    for (const it of o.items) {
      if (it.kind === "special") continue;
      const qty = it.quantity ?? 1;
      pizzaCounts[it.pizzaName ?? "?"] = (pizzaCounts[it.pizzaName ?? "?"] ?? 0) + qty;
      for (const id of it.ingredientIds ?? []) ingCounts[id] = (ingCounts[id] ?? 0) + qty;
    }
  }
```

- [ ] **Step 4: Test laufen lassen (Erfolg)**

Run: `cd Frontend && bun test dashboard`
Expected: PASS (alle Dashboard-Tests grün).

- [ ] **Step 5: Commit**

```bash
git add Frontend/src/lib/dashboard.ts Frontend/src/lib/__tests__/dashboard.test.ts
git commit -m "feat(dashboard): Sonderartikel aus Pizza-/Zutaten-Aggregation ausschließen (Umsatz unverändert)"
```

---

### Task 14: WhatsApp-Digest — Sonderartikel nicht als Pizza/Teig/Zutat; eigene Zeile (Phase 3, TDD)

**Files:**
- Modify: `Frontend/src/lib/digest.ts`
- Modify: `Frontend/src/lib/__tests__/digest.test.ts`
- Modify: `supabase/functions/daily-digest/index.ts` (Deno-Copy synchron halten)

**Interfaces:**
- Consumes: bestehende `formatDigest`/`formatPrepList`-Signaturen; Items tragen optional `kind`/`name`/`emoji`.

- [ ] **Step 1: Failing tests — Digest/PrepList ignorieren Specials**

In `Frontend/src/lib/__tests__/digest.test.ts` ergänzen:

```ts
it("formatDigest: Sonderartikel zählt nicht als Pizza, erscheint als eigene Zeile", () => {
  const msg = formatDigest([{
    pickupDate: "2026-07-16", pickupTime: "18:00", customerName: "Max", customerPhone: "0170",
    items: [{ pizzaName: "Margherita", quantity: 1 }, { pizzaName: "", quantity: 2, kind: "special", name: "VIP", emoji: "🌿" } as any],
    total: 22, serviceMode: "takeaway", notes: "",
  }], "Do, 16.07.");
  expect(msg).toContain("1 Pizza");          // nur die echte Pizza gezählt
  expect(msg).toContain("Sonderartikel: 2× VIP");
});

it("formatPrepList: Sonderartikel erzeugt keinen Teig/keine Zutaten", () => {
  const msg = formatPrepList([{ items: [{ ingredientIds: [], quantity: 3, kind: "special" } as any] }], {}, {}, "Do, 16.07.");
  expect(msg).toBe(""); // keine Pizza → leere Vorbereitungsliste
});
```

- [ ] **Step 2: Tests laufen lassen (Fehlschlag)**

Run: `cd Frontend && bun test digest`
Expected: FAIL — Specials werden aktuell als Pizza/Teig gezählt.

- [ ] **Step 3: `digest.ts` anpassen**

In `Frontend/src/lib/digest.ts`:

(a) `DigestOrder.items`-Typ (Zeile 9) erweitern:

```ts
  items: { pizzaName: string; quantity?: number; kind?: string; name?: string; emoji?: string }[];
```

(b) `formatDigest`-Block (Zeile 32-43) — Pizzas und Specials trennen:

```ts
  const blocks = orders.map((o) => {
    const pizzas = o.items.filter((it) => it.kind !== "special");
    const specials = o.items.filter((it) => it.kind === "special");
    const pizzaCount = pizzas.reduce((s, it) => s + (it.quantity ?? 1), 0);
    const pizzaLabel = `${pizzaCount} ${pizzaCount === 1 ? "Pizza" : "Pizzen"}`;
    const service = o.serviceMode === "dinein" ? "Vor Ort" : "Abholen";
    const lines = [
      `${o.pickupTime} · ${o.customerName} · ${o.customerPhone}`,
      `  ${pizzaLabel} · ${euro(o.total)} · ${service}`,
      ...pizzas.map((it) => `  • ${it.pizzaName}${(it.quantity ?? 1) > 1 ? ` × ${it.quantity}` : ""}`),
      ...specials.map((it) => `  ★ Sonderartikel: ${it.quantity ?? 1}× ${it.name ?? "?"}`),
    ];
    if (o.notes.trim()) lines.push(`  Notiz: ${o.notes.trim()}`);
    return lines.join("\n");
  });
```

(c) `PrepItem`-Typ (Zeile 48) erweitern:

```ts
export interface PrepItem { ingredientIds?: string[]; sauceId?: string; quantity?: number; kind?: string }
```

In der `formatPrepList`-Schleife (Zeile 64-71) am Anfang überspringen und danach Leer-Prüfung ergänzen:

```ts
  for (const o of orders) {
    for (const it of o.items) {
      if (it.kind === "special") continue;
      const qty = it.quantity ?? 1;
      doughCount += qty;
      for (const id of it.ingredientIds ?? []) ing[id] = (ing[id] ?? 0) + qty;
      if (it.sauceId) sau[it.sauceId] = (sau[it.sauceId] ?? 0) + qty;
    }
  }
  if (doughCount === 0) return ""; // nur Sonderartikel → keine Vorbereitung nötig
```

- [ ] **Step 4: Tests laufen lassen (Erfolg)**

Run: `cd Frontend && bun test digest`
Expected: PASS (alle Digest-Tests grün).

- [ ] **Step 5: Deno-Copy in der Edge Function spiegeln**

In `supabase/functions/daily-digest/index.ts` dieselben Änderungen anwenden (Datei ist eine Deno-Copy von `digest.ts`):
- `DigestOrder.items`/`PrepItem` um `kind`/`name`/`emoji` erweitern (Zeile 11, 14).
- `formatDigest` (ab Zeile 21): Pizzas/Specials trennen wie in Step 3b (`★ Sonderartikel: N× name`).
- `formatPrepList` (ab Zeile 42): `if (it.kind === "special") continue;` + nach der Schleife `if (doughCount === 0) return "";`.
- Prep-Abfrage-Block: `doughCount` (Zeile 148) auf Pizzas beschränken:

```ts
    const doughCount = prepOrders.reduce((s, o) => s + o.items.filter((it: any) => it?.kind !== "special").length, 0);
```

- [ ] **Step 6: Commit**

```bash
git add Frontend/src/lib/digest.ts Frontend/src/lib/__tests__/digest.test.ts supabase/functions/daily-digest/index.ts
git commit -m "feat(digest): Sonderartikel nicht als Pizza/Teig/Zutat; eigene Digest-Zeile (Frontend + Deno-Copy)"
```

---

### Task 15: Doku, Changelog, TODO, Memory

**Files:**
- Create: `Doku/Pizza/Features/Sonderartikel-VIP.md` (aus `Doku/Pizza/Templates/_feature.md`)
- Modify: `Doku/Pizza/Changelog.md`
- Modify: `Doku/Pizza/TODO.md`

**Interfaces:** keine (Dokumentation).

- [ ] **Step 1: Feature-Doku aus Template anlegen**

Kopiere `Doku/Pizza/Templates/_feature.md` nach `Doku/Pizza/Features/Sonderartikel-VIP.md` und fülle: Zweck (versteckte, kontogebunden freischaltbare Menü-Items mit pro-Kunde-Preis + Staffeln), Datenmodell (`special_items`/`special_item_grants`, Migration 0012), Einlöse-RPC `unlock_special_item`, serverautoritativer `validate_order`, Diskretion nach Abholung, Admin-Seite `/admin/sonderartikel`, betroffene Anzeige-Stellen, Tests (`priceForQty`, `cart-items`, `order-discretion`, dashboard/digest), Betreiber-Schritte (db push 0012 + daily-digest deploy).

- [ ] **Step 2: Changelog-Eintrag (aus `_changelog-entry.md`)**

In `Doku/Pizza/Changelog.md` oben ergänzen: „Sonderartikel/VIP — versteckte Items per Code, kontogebundene Freischaltung mit Staffelpreisen, serverseitig autoritativ (Migration 0012); Admin-Verwaltung; Diskretion nach Abholung; Dashboard/Digest schließen Specials aus."

- [ ] **Step 3: TODO aktualisieren**

In `Doku/Pizza/TODO.md` die Zeile „versteckter Gutschein → verstecktes Warenkorb-Item" (P2, Ideenstatus) auf **erledigt (2026-07-16)** setzen mit Verweis auf Migration 0012 + Admin-Seite; Betreiber-Schritte notieren.

- [ ] **Step 4: Commit**

```bash
git add Doku/Pizza/
git commit -m "docs: Sonderartikel/VIP dokumentiert (Feature-Seite, Changelog, TODO)"
```

- [ ] **Step 5: Memory nach dem Merge aktualisieren (Hinweis)**

Nach dem Merge nach `main`: `idea-backlog.md` (Idee #5) und `roadmap-next-steps.md` in der Projekt-Memory auf „GEBAUT & gemergt (2026-07-16)" aktualisieren (außerhalb des Repos, kein Commit).

---

## Betreiber-Ausrollung (nach Merge nach `main`)

1. `bunx supabase db push` — spielt `0012_special_items.sql` ein (**vor** dem Frontend-Deploy; `createOrder` schreibt danach Special-Positionen, die der neue Trigger prüft).
2. `bunx supabase functions deploy daily-digest --use-api --project-ref gvszyvgbbsmlulhqiakp` — Digest-Deno-Copy mit Special-Logik.
3. Frontend-Deploy läuft automatisch (Vercel Auto-Deploy auf `main`).
4. Smoke-Test: Admin legt Sonderartikel + Freischaltung (Staffel mit `min_qty:1`) für einen Testkunden an → Kunde löst Code im Gutscheinfeld ein → bestellt → Preis stimmt serverseitig → nach `abgeholt` verschwindet der Sonderartikel kundenseitig.
```

