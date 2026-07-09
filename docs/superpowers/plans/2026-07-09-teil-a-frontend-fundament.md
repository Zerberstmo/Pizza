# Teil-A — Frontend-Fundament Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Baue die Figma-Make-Vorlage als saubere, testbare React-App in `Frontend/` neu auf — Feature-Parität, Mock-Datenschicht (Naht für Teil-B/Supabase), Admin-konfigurierbare Bestell-Vorlaufzeit (Default 3 Tage).

**Architecture:** Reine Logik (Preis, Gutschein, Slots) und die async Datenschicht (`lib/data/`) sind vom UI entkoppelt und über Vitest getestet. Seiten laufen über `react-router`; Daten kommen ausschließlich über async Funktionen aus `lib/data/store.ts`, die in A gegen `localStorage`+Seed und in Teil-B gegen Supabase implementiert werden — die UI bleibt unverändert. Präsentations-Bausteine (shadcn-Primitives, Pizza-SVG, Charts) werden 1:1 aus der Vorlage portiert.

**Tech Stack:** Bun, Vite 6, React 18, TypeScript, Tailwind v4 (`@tailwindcss/vite`), shadcn/ui (Radix), react-router 7, Motion, lucide-react, Vitest + @testing-library/react, Playwright.

## Global Constraints

- **Package-Manager: ausschließlich Bun.** Kein `npm`/`pnpm install`. Keine `pnpm-workspace.yaml`.
- **Unit/Component-Tests laufen über den Bun-nativen Runner** (`bun:test`-API) mit **happy-dom** (Preload) + `@testing-library/react`. Befehl: `bun test src`. E2E: `bun run test:e2e` (Playwright). (Vitest läuft nicht unter Bun-on-Windows — siehe SETUP/ADR-0004.)
- **Kein MUI / Emotion:** `@mui/*`, `@emotion/*` werden nicht installiert.
- **Dateinamen `kebab-case`, Komponenten-Bezeichner `PascalCase`** (z. B. `pizza-card.tsx` → `PizzaCard`).
- **Alle Daten laufen über `lib/data/store.ts`** (async). Seiten importieren keine Seed-Konstanten direkt.
- **Basispreis = 10,00 € pro Pizza**, fester Preis. Preisformat deutsch: `10,00 €` (Komma, Leerzeichen vor €).
- **Vite Dev-Port 5173.** Alias `@` → `Frontend/src`.
- **Referenzquelle** für Port-Aufgaben: `Frontend vorlage/src/app/App.tsx` (1871 Zeilen). Zeilenangaben in den Tasks beziehen sich auf diese Datei.
- Umgebungssprache der UI ist Deutsch (Texte 1:1 aus der Vorlage übernehmen).

---

## Dateistruktur (Ziel)

```
Frontend/
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json · tsconfig.node.json
├── vitest.config.ts
├── vitest.setup.ts
├── playwright.config.ts
└── src/
    ├── main.tsx · app.tsx
    ├── router.tsx
    ├── types/index.ts
    ├── lib/
    │   ├── utils.ts
    │   ├── pricing.ts
    │   ├── slots.ts
    │   └── data/{seed.ts, store.ts}
    ├── hooks/{use-async.ts, use-cart.tsx}
    ├── components/
    │   ├── ui/…            (shadcn-Primitives aus Vorlage)
    │   ├── pizza/{pizza-svg.tsx, toppings.tsx, pizza-card.tsx}
    │   ├── common/{qr-code.tsx, select-input.tsx, bar-chart.tsx, donut-chart.tsx, async-boundary.tsx}
    │   └── layout/{bottom-nav.tsx, admin-shell.tsx}
    └── pages/
        ├── menu/menu-page.tsx
        ├── configurator/configurator-page.tsx
        ├── checkout/checkout-page.tsx
        ├── confirmation/confirmation-page.tsx
        └── admin/{login,dashboard,days,hours,lead-time,ingredients,vouchers}-page.tsx
tests/ (Playwright)
└── e2e/order.spec.ts
```

---

### Task 1: Projekt-Scaffold & Tooling

**Files:**
- Create: `Frontend/package.json`, `Frontend/vite.config.ts`, `Frontend/tsconfig.json`, `Frontend/tsconfig.node.json`, `Frontend/index.html`, `Frontend/vitest.config.ts`, `Frontend/vitest.setup.ts`, `Frontend/playwright.config.ts`
- Create: `Frontend/src/main.tsx`, `Frontend/src/app.tsx`, `Frontend/src/lib/utils.ts`
- Create: `Frontend/src/styles/{fonts.css,theme.css,tailwind.css,index.css}` (aus Vorlage kopiert)
- Create: `Frontend/src/lib/__tests__/smoke.test.ts`

**Interfaces:**
- Produces: lauffähiges Vite/React-Projekt; `cn()` in `lib/utils.ts`; Test-Runner Vitest + Playwright konfiguriert.

- [ ] **Step 1: `Frontend/package.json` anlegen** (MUI/Emotion entfernt, nur real genutzte Deps; Bun-Scripts)

```json
{
  "name": "pizza-frontend",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "bun test src",
    "test:watch": "bun test src --watch",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "@radix-ui/react-scroll-area": "1.2.3",
    "@radix-ui/react-separator": "1.1.2",
    "@radix-ui/react-slot": "1.1.2",
    "@radix-ui/react-switch": "1.1.3",
    "@radix-ui/react-tabs": "1.1.3",
    "class-variance-authority": "0.7.1",
    "clsx": "2.1.1",
    "lucide-react": "0.487.0",
    "motion": "12.23.24",
    "react": "18.3.1",
    "react-dom": "18.3.1",
    "react-router": "7.13.0",
    "tailwind-merge": "3.2.0"
  },
  "devDependencies": {
    "@happy-dom/global-registrator": "15.7.4",
    "@playwright/test": "1.48.0",
    "@tailwindcss/vite": "4.1.12",
    "@testing-library/react": "16.0.1",
    "@types/bun": "latest",
    "@types/node": "22.7.4",
    "@types/react": "18.3.12",
    "@types/react-dom": "18.3.1",
    "@vitejs/plugin-react": "4.7.0",
    "tailwindcss": "4.1.12",
    "tw-animate-css": "1.3.8",
    "typescript": "5.6.3",
    "vite": "6.3.5"
  }
}
```
> Hinweise: Test-Runner ist **`bun test`** (Bun-nativ, `bun:test`-API) mit **happy-dom** statt Vitest/jsdom (Vitest startet nicht unter Bun-on-Windows). `@types/node` ist nötig, damit `vite.config.ts` typcheckt. Weitere Radix-Primitives (dialog, select, label, progress …) werden bei Bedarf in den Port-Tasks nachinstalliert (`bun add …`).

- [ ] **Step 2: Styles aus der Vorlage kopieren**

Kopiere unverändert:
`Frontend vorlage/src/styles/fonts.css` → `Frontend/src/styles/fonts.css`
`Frontend vorlage/src/styles/theme.css` → `Frontend/src/styles/theme.css`
`Frontend vorlage/src/styles/tailwind.css` → `Frontend/src/styles/tailwind.css`
`Frontend vorlage/src/styles/index.css` → `Frontend/src/styles/index.css`

- [ ] **Step 3: `vite.config.ts` (bereinigt — kein figma-asset-resolver)**

```ts
import { defineConfig } from "vite";
import path from "path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  server: { port: 5173 },
});
```

- [ ] **Step 4: `tsconfig.json`, `tsconfig.node.json`, `index.html`, `main.tsx`, `app.tsx`, `lib/utils.ts`**

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020", "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"], "module": "ESNext",
    "skipLibCheck": true, "moduleResolution": "bundler",
    "allowImportingTsExtensions": true, "noEmit": true, "jsx": "react-jsx",
    "strict": true, "noUnusedLocals": true, "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".", "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```
`tsconfig.node.json`:
```json
{
  "compilerOptions": {
    "composite": true, "skipLibCheck": true, "module": "ESNext",
    "moduleResolution": "bundler", "allowSyntheticDefaultImports": true, "strict": true
  },
  "include": ["vite.config.ts", "vitest.config.ts"]
}
```
`index.html`:
```html
<!DOCTYPE html>
<html lang="de">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>Pizzeria — Bestellen</title>
    <meta name="description" content="Pizza vorbestellen und abholen." />
    <style>html, body { height: 100%; margin: 0; } #root { height: 100%; }</style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```
`src/lib/utils.ts`:
```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
```
`src/main.tsx`:
```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/index.css";
import App from "./app";

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");
createRoot(root).render(<StrictMode><App /></StrictMode>);
```
`src/app.tsx` (Platzhalter, wird in Task 7 zum Router):
```tsx
export default function App() {
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
      <h1 className="font-black text-2xl">🍕 Pizzeria</h1>
    </div>
  );
}
```

- [ ] **Step 5: Bun-Test + Playwright konfigurieren**

`bunfig.toml` (Preload registriert happy-dom + Cleanup vor jedem Testlauf):
```toml
[test]
preload = ["./test-setup.ts"]
```
`test-setup.ts`:
```ts
import { GlobalRegistrator } from "@happy-dom/global-registrator";
GlobalRegistrator.register();
import { afterEach } from "bun:test";
import { cleanup } from "@testing-library/react";
afterEach(() => cleanup());
```
> Hinweis: `@` (Vite-Alias) wird in Tests über `tsconfig`-`paths` aufgelöst (Bun liest `tsconfig.json`-`paths`). Keine separate Test-Config-Alias-Angabe nötig.

`playwright.config.ts`:
```ts
import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  use: { baseURL: "http://localhost:5173" },
  webServer: { command: "bun run dev", url: "http://localhost:5173", reuseExistingServer: true },
  projects: [{ name: "mobile", use: { ...devices["iPhone 13"] } }],
});
```
`src/lib/__tests__/smoke.test.ts`:
```ts
import { describe, it, expect } from "bun:test";
import { cn } from "@/lib/utils";
describe("scaffold", () => {
  it("cn merges classes", () => { expect(cn("a", "b")).toBe("a b"); });
});
```

- [ ] **Step 6: Installieren, verifizieren**

Run: `cd Frontend && bun install && bun run test && bun run build`
Expected: `bun install` ohne pnpm/npm; `bun test src`: 1 passed (happy-dom aktiv, Output pristine); `vite build` erzeugt `dist/` ohne Fehler.
Run: `bun run dev` → http://localhost:5173 zeigt „🍕 Pizzeria" auf dunklem Grund. Danach abbrechen.

- [ ] **Step 7: Commit**

```bash
git add Frontend/
git commit -m "feat(frontend): scaffold Vite/React/Tailwind mit Bun, Vitest, Playwright"
```

---

### Task 2: Domänentypen & Preis-/Gutschein-Logik

**Files:**
- Create: `Frontend/src/types/index.ts`
- Create: `Frontend/src/lib/pricing.ts`
- Test: `Frontend/src/lib/__tests__/pricing.test.ts`

**Interfaces:**
- Produces (types):
```ts
interface IngredientItem { id: string; name: string; emoji: string; category: string; available: boolean; description: string; }
interface PizzaTemplate { id: string; name: string; sub: string; desc: string; color: string; ingredientIds: string[]; }
interface VoucherDef { id: string; name: string; code: string; type: "percent" | "fixed" | "ingredient"; value: number; ingredientName?: string; expiresAt: string; active: boolean; maxUses: number; uses: number; }
interface Customer { firstName: string; lastName: string; phone: string; }
interface CartItem { cartId: string; pizzaName: string; ingredientIds: string[]; }
interface Hours { from: string; to: string; }
interface AppConfig { days: Record<string, boolean>; hours: Hours; leadTimeDays: number; }
interface NewOrder { items: CartItem[]; customer: Customer; notes: string; pickupDate: string; pickupTime: string; voucherCode?: string; }
interface OrderData { id: string; items: CartItem[]; subtotal: number; total: number; discount: number; freeIngredient?: string; customer: Customer; pickupDate: string; pickupTime: string; notes: string; voucherCode?: string; }
```
- Produces (pricing):
```ts
export const BASE_PRICE = 10.0;
export function formatPrice(n: number): string;
export function computeSubtotal(itemCount: number): number;
export function computeDiscount(subtotal: number, voucher: VoucherDef | null): number;
export function computeTotal(subtotal: number, discount: number): number;
export type VoucherResult = { ok: true; voucher: VoucherDef; message: string } | { ok: false; message: string };
export function validateVoucher(code: string, vouchers: VoucherDef[], now: Date): VoucherResult;
```

- [ ] **Step 1: `src/types/index.ts` schreiben** — die Interfaces aus dem Produces-Block oben, jeweils `export interface …`. (Quelle: `App.tsx:30-93`, plus `AppConfig`/`NewOrder` neu.)

- [ ] **Step 2: Failing test `pricing.test.ts`**

```ts
import { describe, it, expect } from "bun:test";
import { formatPrice, computeSubtotal, computeDiscount, computeTotal, validateVoucher } from "@/lib/pricing";
import type { VoucherDef } from "@/types";

const percent: VoucherDef = { id: "1", name: "P", code: "WELCOME10", type: "percent", value: 10, expiresAt: "2999-01-01", active: true, maxUses: 0, uses: 0 };
const fixed: VoucherDef   = { id: "2", name: "F", code: "PIZZA5",    type: "fixed",   value: 5,  expiresAt: "2999-01-01", active: true, maxUses: 0, uses: 0 };
const ingr: VoucherDef    = { id: "3", name: "W", code: "WEED420",   type: "ingredient", value: 0, ingredientName: "Weed", expiresAt: "2999-01-01", active: true, maxUses: 0, uses: 0 };

describe("pricing", () => {
  it("formats german price", () => expect(formatPrice(10)).toBe("10,00 €"));
  it("subtotal = 10€ * count", () => expect(computeSubtotal(3)).toBe(30));
  it("percent discount", () => expect(computeDiscount(20, percent)).toBe(2));
  it("fixed discount", () => expect(computeDiscount(20, fixed)).toBe(5));
  it("ingredient voucher => no money discount", () => expect(computeDiscount(20, ingr)).toBe(0));
  it("no voucher => 0", () => expect(computeDiscount(20, null)).toBe(0));
  it("total never below 0", () => expect(computeTotal(3, 5)).toBe(0));
  it("validateVoucher: unknown code", () => {
    const r = validateVoucher("NOPE", [percent], new Date("2025-01-01"));
    expect(r.ok).toBe(false);
  });
  it("validateVoucher: expired", () => {
    const exp = { ...percent, expiresAt: "2020-01-01" };
    expect(validateVoucher("WELCOME10", [exp], new Date("2025-01-01")).ok).toBe(false);
  });
  it("validateVoucher: valid percent", () => {
    const r = validateVoucher("WELCOME10", [percent], new Date("2025-01-01"));
    expect(r.ok).toBe(true);
  });
});
```

- [ ] **Step 3: Run → FAIL**

Run: `cd Frontend && bun test src/lib/__tests__/pricing.test.ts`
Expected: FAIL („does not provide an export named …").

- [ ] **Step 4: `src/lib/pricing.ts` implementieren** (Logik 1:1 aus `App.tsx:99,188,1743-1773`)

```ts
import type { VoucherDef } from "@/types";

export const BASE_PRICE = 10.0;

export function formatPrice(n: number): string {
  return `${n.toFixed(2).replace(".", ",")} €`;
}
export function computeSubtotal(itemCount: number): number {
  return BASE_PRICE * itemCount;
}
export function computeDiscount(subtotal: number, voucher: VoucherDef | null): number {
  if (!voucher || voucher.type === "ingredient") return 0;
  return voucher.type === "percent" ? (subtotal * voucher.value) / 100 : voucher.value;
}
export function computeTotal(subtotal: number, discount: number): number {
  return Math.max(0, subtotal - discount);
}

export type VoucherResult =
  | { ok: true; voucher: VoucherDef; message: string }
  | { ok: false; message: string };

export function validateVoucher(code: string, vouchers: VoucherDef[], now: Date): VoucherResult {
  const found = vouchers.find((v) => v.code === code && v.active);
  if (!found) return { ok: false, message: "Ungültiger Code." };
  if (new Date(found.expiresAt) < now) return { ok: false, message: "Gutschein abgelaufen." };
  const message = found.type === "ingredient"
    ? `Sonderzutat: ${found.ingredientName} 🎁`
    : "Erfolgreich eingelöst!";
  return { ok: true, voucher: found, message };
}
```

- [ ] **Step 5: Run → PASS**

Run: `cd Frontend && bun test src/lib/__tests__/pricing.test.ts`
Expected: PASS (alle grün).

- [ ] **Step 6: Commit**

```bash
git add Frontend/src/types Frontend/src/lib/pricing.ts Frontend/src/lib/__tests__/pricing.test.ts
git commit -m "feat(frontend): Domänentypen + getestete Preis-/Gutschein-Logik"
```

---

### Task 3: Slot-/Vorlaufzeit-Logik

**Files:**
- Create: `Frontend/src/lib/slots.ts`
- Test: `Frontend/src/lib/__tests__/slots.test.ts`

**Interfaces:**
- Consumes: `AppConfig`, `Hours` aus `@/types`.
- Produces:
```ts
export const DAYS_OF_WEEK: readonly string[]; // Mo..So
export const JS_DAY_MAP: Record<number, string>;
export function getSelectableDates(config: AppConfig, today: Date): string[]; // ISO yyyy-mm-dd
export function getAvailableTimes(hours: Hours): string[];
export function formatDateLabel(dateStr: string): string;
export function isSlotAllowed(dateStr: string, time: string, config: AppConfig, now: Date): boolean;
```

- [ ] **Step 1: Failing test `slots.test.ts`** (Kern: Vorlaufzeit + erlaubte Tage)

```ts
import { describe, it, expect } from "bun:test";
import { getSelectableDates, getAvailableTimes, isSlotAllowed } from "@/lib/slots";
import type { AppConfig } from "@/types";

const allDays = { Montag: true, Dienstag: true, Mittwoch: true, Donnerstag: true, Freitag: true, Samstag: true, Sonntag: true };
const cfg = (leadTimeDays: number, days = allDays): AppConfig => ({ days, hours: { from: "11:00", to: "12:00" }, leadTimeDays });

describe("slots", () => {
  it("lead time 3: earliest date is today+3", () => {
    const today = new Date("2026-07-09T10:00:00"); // Do
    const dates = getSelectableDates(cfg(3), today);
    expect(dates[0]).toBe("2026-07-12"); // So
  });
  it("lead time 0: earliest date is today", () => {
    const today = new Date("2026-07-09T10:00:00");
    expect(getSelectableDates(cfg(0), today)[0]).toBe("2026-07-09");
  });
  it("skips disabled weekdays after lead time", () => {
    const days = { ...allDays, Sonntag: false, Montag: false };
    const today = new Date("2026-07-09T10:00:00"); // Do → +3 = So(disabled) → Mo(disabled) → Di 14.
    expect(getSelectableDates(cfg(3, days), today)[0]).toBe("2026-07-14");
  });
  it("times in 15-min steps inclusive", () => {
    expect(getAvailableTimes({ from: "11:00", to: "11:30" })).toEqual(["11:00", "11:15", "11:30"]);
  });
  it("isSlotAllowed rejects date before lead time", () => {
    const now = new Date("2026-07-09T10:00:00");
    expect(isSlotAllowed("2026-07-10", "11:00", cfg(3), now)).toBe(false);
    expect(isSlotAllowed("2026-07-12", "11:00", cfg(3), now)).toBe(true);
  });
});
```

- [ ] **Step 2: Run → FAIL** — Run: `cd Frontend && bun test src/lib/__tests__/slots.test.ts` — Expected: FAIL.

- [ ] **Step 3: `src/lib/slots.ts` implementieren** (erweitert `App.tsx:174-243` um `leadTimeDays`)

```ts
import type { AppConfig, Hours } from "@/types";

export const DAYS_OF_WEEK = ["Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag","Sonntag"] as const;
export const JS_DAY_MAP: Record<number, string> = { 0:"Sonntag",1:"Montag",2:"Dienstag",3:"Mittwoch",4:"Donnerstag",5:"Freitag",6:"Samstag" };

function toISO(d: Date): string { return d.toISOString().split("T")[0]; }

export function getSelectableDates(config: AppConfig, today: Date): string[] {
  const dates: string[] = [];
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + config.leadTimeDays);
  for (let i = 0; i < 90 && dates.length < 30; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    if (config.days[JS_DAY_MAP[d.getDay()]]) dates.push(toISO(d));
  }
  return dates;
}

export function getAvailableTimes(hours: Hours): string[] {
  const [fh, fm] = hours.from.split(":").map(Number);
  const [th, tm] = hours.to.split(":").map(Number);
  const start = fh * 60 + fm, end = th * 60 + tm;
  const slots: string[] = [];
  for (let m = start; m <= end; m += 15) {
    slots.push(`${String(Math.floor(m/60)).padStart(2,"0")}:${String(m%60).padStart(2,"0")}`);
  }
  return slots;
}

export function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const days = ["So","Mo","Di","Mi","Do","Fr","Sa"];
  const dd = String(d.getDate()).padStart(2,"0");
  const mm = String(d.getMonth()+1).padStart(2,"0");
  return `${days[d.getDay()]}, ${dd}.${mm}.${d.getFullYear()}`;
}

export function isSlotAllowed(dateStr: string, time: string, config: AppConfig, now: Date): boolean {
  return getSelectableDates(config, now).includes(dateStr)
    && getAvailableTimes(config.hours).includes(time);
}
```

- [ ] **Step 4: Run → PASS** — Run: `cd Frontend && bun test src/lib/__tests__/slots.test.ts` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add Frontend/src/lib/slots.ts Frontend/src/lib/__tests__/slots.test.ts
git commit -m "feat(frontend): Slot-/Vorlaufzeit-Logik (admin-konfigurierbar) mit Tests"
```

---

### Task 4: Seed-Daten & async Datenschicht (localStorage-Naht)

**Files:**
- Create: `Frontend/src/lib/data/seed.ts`
- Create: `Frontend/src/lib/data/store.ts`
- Test: `Frontend/src/lib/data/__tests__/store.test.ts`

**Interfaces:**
- Consumes: Typen aus `@/types`.
- Produces (`store.ts`) — **die Naht, die Teil-B ersetzt**:
```ts
export function getMenu(): Promise<PizzaTemplate[]>;
export function getIngredients(): Promise<IngredientItem[]>;
export function getVouchers(): Promise<VoucherDef[]>;
export function getConfig(): Promise<AppConfig>;
export function getDashboardStats(): Promise<{ week: { day: string; n: number }[]; toppings: { name: string; v: number }[] }>;
export function createOrder(input: NewOrder): Promise<OrderData>;
export function saveIngredients(list: IngredientItem[]): Promise<void>;
export function saveVouchers(list: VoucherDef[]): Promise<void>;
export function saveConfig(config: AppConfig): Promise<void>;
export function verifyAdminPassword(pw: string): Promise<boolean>; // TEIL-B TODO: echte Auth
```

- [ ] **Step 1: `seed.ts` schreiben** — Konstanten 1:1 aus `App.tsx` kopieren:
`INGREDIENTS_DEFAULT` (`:102-131`), `CATEGORIES` (`:132`), `TEMPLATES` (`:134-166`), `VOUCHERS_INIT` (`:167-173`), Dashboard-Mocks `WEEK_DATA` (`:177-180`) → als `{day,n}[]`, `PIE_DATA`/`PIE_COLORS` (`:181-182`) → `toppings`. Zusätzlich:
```ts
export const DEFAULT_CONFIG = {
  days: { Montag: true, Dienstag: true, Mittwoch: false, Donnerstag: true, Freitag: true, Samstag: true, Sonntag: false },
  hours: { from: "11:00", to: "21:00" },
  leadTimeDays: 3,
} as const;
export const ADMIN_PASSWORD = "pizza"; // TEIL-B TODO: durch Supabase-Auth ersetzen
```

- [ ] **Step 2: Failing test `store.test.ts`**

```ts
import { describe, it, expect, beforeEach } from "bun:test";
import { getIngredients, saveConfig, getConfig, createOrder } from "@/lib/data/store";

beforeEach(() => localStorage.clear());

describe("data store", () => {
  it("getIngredients returns seed by default", async () => {
    expect((await getIngredients()).length).toBeGreaterThan(0);
  });
  it("saveConfig persists and getConfig reads back", async () => {
    await saveConfig({ days: { Montag: true }, hours: { from: "10:00", to: "12:00" }, leadTimeDays: 5 });
    expect((await getConfig()).leadTimeDays).toBe(5);
  });
  it("createOrder returns order with id and computed totals", async () => {
    const order = await createOrder({
      items: [{ cartId: "a", pizzaName: "Margherita", ingredientIds: [] }],
      customer: { firstName: "Max", lastName: "M", phone: "1" },
      notes: "", pickupDate: "2026-07-12", pickupTime: "18:00",
    });
    expect(order.id).toMatch(/^#/);
    expect(order.total).toBe(10);
  });
});
```

- [ ] **Step 3: Run → FAIL** — Run: `cd Frontend && bun test src/lib/data/__tests__/store.test.ts` — Expected: FAIL.

- [ ] **Step 4: `store.ts` implementieren** (localStorage + künstliches Delay + Preislogik aus Task 2)

```ts
import type { AppConfig, IngredientItem, NewOrder, OrderData, PizzaTemplate, VoucherDef } from "@/types";
import { INGREDIENTS_DEFAULT, TEMPLATES, VOUCHERS_INIT, DEFAULT_CONFIG, ADMIN_PASSWORD, WEEK_DATA, PIE_DATA } from "./seed";
import { computeSubtotal, computeDiscount, computeTotal, validateVoucher } from "@/lib/pricing";

const delay = <T>(v: T): Promise<T> => new Promise((r) => setTimeout(() => r(v), 120));
function read<T>(key: string, fallback: T): T {
  const raw = localStorage.getItem(key);
  return raw ? (JSON.parse(raw) as T) : fallback;
}
function write<T>(key: string, val: T): void { localStorage.setItem(key, JSON.stringify(val)); }

const genId = () => `#${Math.floor(10000 + Math.random() * 90000)}`;

export const getMenu = () => delay(TEMPLATES.slice(0, 4) as PizzaTemplate[]);
export const getIngredients = () => delay(read<IngredientItem[]>("pizza-ingredients", INGREDIENTS_DEFAULT));
export const getVouchers = () => delay(read<VoucherDef[]>("pizza-vouchers", VOUCHERS_INIT));
export const getConfig = () => delay(read<AppConfig>("pizza-config", DEFAULT_CONFIG));
export const getDashboardStats = () => delay({ week: WEEK_DATA, toppings: PIE_DATA });

export const saveIngredients = (list: IngredientItem[]) => delay(write("pizza-ingredients", list));
export const saveVouchers = (list: VoucherDef[]) => delay(write("pizza-vouchers", list));
export const saveConfig = (config: AppConfig) => delay(write("pizza-config", config));

export async function createOrder(input: NewOrder): Promise<OrderData> {
  const vouchers = read<VoucherDef[]>("pizza-vouchers", VOUCHERS_INIT);
  const applied = input.voucherCode
    ? (() => { const r = validateVoucher(input.voucherCode!, vouchers, new Date()); return r.ok ? r.voucher : null; })()
    : null;
  const subtotal = computeSubtotal(input.items.length);
  const discount = computeDiscount(subtotal, applied);
  const order: OrderData = {
    id: genId(), items: input.items, subtotal, discount, total: computeTotal(subtotal, discount),
    freeIngredient: applied?.type === "ingredient" ? applied.ingredientName : undefined,
    customer: input.customer, notes: input.notes,
    pickupDate: input.pickupDate, pickupTime: input.pickupTime, voucherCode: applied?.code,
  };
  const orders = read<OrderData[]>("pizza-orders", []);
  write("pizza-orders", [order, ...orders]); // TEIL-B: → Supabase insert + Realtime + WhatsApp
  return delay(order);
}

export const verifyAdminPassword = (pw: string) => delay(pw === ADMIN_PASSWORD);
```

- [ ] **Step 5: Run → PASS** — Run: `cd Frontend && bun test src/lib/data/__tests__/store.test.ts` — Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add Frontend/src/lib/data
git commit -m "feat(frontend): async Datenschicht (localStorage-Naht) + Seed, mit Tests"
```

---

### Task 5: Hooks — `useAsync` & `useCart`

**Files:**
- Create: `Frontend/src/hooks/use-async.ts`
- Create: `Frontend/src/hooks/use-cart.tsx`
- Test: `Frontend/src/hooks/__tests__/use-cart.test.tsx`

**Interfaces:**
- Produces:
```ts
export function useAsync<T>(fn: () => Promise<T>, deps?: unknown[]): { data: T | null; loading: boolean; error: Error | null; reload: () => void };
export function CartProvider({ children }: { children: React.ReactNode }): JSX.Element;
export function useCart(): { cart: CartItem[]; addToCart(pizzaName: string, ingredientIds: string[]): void; removeFromCart(cartId: string): void; clearCart(): void; count: number };
```

- [ ] **Step 1: `use-async.ts` implementieren**

```ts
import { useCallback, useEffect, useState } from "react";

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const run = useCallback(() => {
    let active = true;
    setLoading(true); setError(null);
    fn().then((d) => active && (setData(d), setLoading(false)))
        .catch((e) => active && (setError(e as Error), setLoading(false)));
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => run(), [run]);
  return { data, loading, error, reload: run };
}
```

- [ ] **Step 2: Failing test `use-cart.test.tsx`**

```tsx
import { describe, it, expect, beforeEach } from "bun:test";
import { renderHook, act } from "@testing-library/react";
import { CartProvider, useCart } from "@/hooks/use-cart";

const wrapper = ({ children }: { children: React.ReactNode }) => <CartProvider>{children}</CartProvider>;
beforeEach(() => localStorage.clear());

describe("useCart", () => {
  it("adds and counts items", () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.addToCart("Margherita", ["mozzarella"]));
    expect(result.current.count).toBe(1);
  });
  it("removes items", () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.addToCart("Salami", []));
    const id = result.current.cart[0].cartId;
    act(() => result.current.removeFromCart(id));
    expect(result.current.count).toBe(0);
  });
  it("persists to localStorage", () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.addToCart("Hawaii", []));
    expect(localStorage.getItem("pizza-cart")).toContain("Hawaii");
  });
});
```

- [ ] **Step 3: Run → FAIL** — Run: `cd Frontend && bun test src/hooks/__tests__/use-cart.test.tsx` — Expected: FAIL.

- [ ] **Step 4: `use-cart.tsx` implementieren**

```tsx
import { createContext, useContext, useEffect, useState } from "react";
import type { CartItem } from "@/types";

const uid = () => Math.random().toString(36).slice(2, 9);
const KEY = "pizza-cart";

interface CartContextValue {
  cart: CartItem[];
  addToCart(pizzaName: string, ingredientIds: string[]): void;
  removeFromCart(cartId: string): void;
  clearCart(): void;
  count: number;
}
const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>(() => {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  });
  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(cart)); }, [cart]);

  const addToCart = (pizzaName: string, ingredientIds: string[]) =>
    setCart((p) => [...p, { cartId: uid(), pizzaName, ingredientIds }]);
  const removeFromCart = (cartId: string) => setCart((p) => p.filter((x) => x.cartId !== cartId));
  const clearCart = () => setCart([]);

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, clearCart, count: cart.length }}>
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

- [ ] **Step 5: Run → PASS** — Run: `cd Frontend && bun test src/hooks/__tests__/use-cart.test.tsx` — Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add Frontend/src/hooks
git commit -m "feat(frontend): useAsync + useCart (localStorage-persistent) mit Tests"
```

---

### Task 6: Präsentations-Bausteine portieren (UI-Primitives, Pizza-SVG, Common)

**Files:**
- Create: `Frontend/src/components/ui/*` (nur benötigte shadcn-Primitives)
- Create: `Frontend/src/components/pizza/{toppings.tsx, pizza-svg.tsx, pizza-card.tsx}`
- Create: `Frontend/src/components/common/{qr-code.tsx, select-input.tsx, bar-chart.tsx, donut-chart.tsx, async-boundary.tsx}`
- Test: `Frontend/src/components/__tests__/pizza-svg.test.tsx`

**Interfaces:**
- Produces: `PizzaSVG`, `QrCode`, `SelectInput`, `SvgBarChart`, `SvgDonutChart`, `AsyncBoundary`, shadcn-Komponenten (`Button`, `Card…`, `Input`, `Label`, `Switch`, `Separator`, `Tabs`, `Badge`, `ScrollArea`, `Textarea`, `Progress`).
- Consumes: `cn` aus `@/lib/utils`.

- [ ] **Step 1: shadcn-Primitives kopieren** — aus `Frontend vorlage/src/components/ui/` (11 Dateien: `button, card, badge, input, label, switch, separator, tabs, progress, textarea, scroll-area`) nach `Frontend/src/components/ui/`. Importpfad `@/lib/utils` beibehalten. Fehlende Radix-Deps ergänzen: `bun add @radix-ui/react-label`.

- [ ] **Step 2: Pizza-SVG portieren** — nach `components/pizza/`:
  - `toppings.tsx`: `TP`, `TOPPING_COLORS`, `ToppingDot`, alle `*T`-Renderer, `RENDERERS`, `TOPPING_POSITIONS`, `getToppingPositions` (`App.tsx:269-371`).
  - `pizza-svg.tsx`: `PizzaSVG` (`App.tsx:373-401`), importiert aus `./toppings`.
  - `pizza-card.tsx`: **neu**, kapselt die Menü-Kachel aus `HomePage` (`App.tsx:541-643`, der `MENU.map`-Kachelteil) als `<PizzaCard template={…} onAdd={…} />`.

- [ ] **Step 3: Common-Komponenten portieren** — nach `components/common/`:
  - `qr-code.tsx`: `QRCode` → als `QrCode` exportieren (`App.tsx:403-431`).
  - `select-input.tsx`: `SelectInput` (`App.tsx:433-465`).
  - `bar-chart.tsx` / `donut-chart.tsx`: `SvgBarChart` / `SvgDonutChart` (`App.tsx:1230-1305`).
  - `async-boundary.tsx`: **neu** — vereinheitlichte Lade-/Fehler-/Leer-Zustände:
```tsx
export function AsyncBoundary<T>({ loading, error, data, empty, children }: {
  loading: boolean; error: Error | null; data: T | null;
  empty?: React.ReactNode; children: (data: T) => React.ReactNode;
}) {
  if (loading) return <div className="flex items-center justify-center py-16 text-muted-foreground">Lädt…</div>;
  if (error)   return <div className="flex flex-col items-center justify-center py-16 text-center text-destructive">Etwas ist schiefgelaufen.</div>;
  if (!data || (Array.isArray(data) && data.length === 0)) return <>{empty ?? null}</>;
  return <>{children(data)}</>;
}
```

- [ ] **Step 4: Smoke-Test `pizza-svg.test.tsx`**

```tsx
import { describe, it, expect } from "bun:test";
import { render } from "@testing-library/react";
import { PizzaSVG } from "@/components/pizza/pizza-svg";

describe("PizzaSVG", () => {
  it("renders an svg without crashing", () => {
    const { container } = render(<PizzaSVG selected={["salami", "mozzarella"]} />);
    expect(container.querySelector("svg")).not.toBeNull();
  });
});
```

- [ ] **Step 5: Run → PASS + build** — Run: `cd Frontend && bun test src/components/__tests__/pizza-svg.test.tsx && bun run build` — Expected: Test PASS, Build ohne TS-Fehler.

- [ ] **Step 6: Commit**

```bash
git add Frontend/src/components
git commit -m "feat(frontend): UI-Primitives, Pizza-SVG, Charts & AsyncBoundary portiert"
```

---

### Task 7: Layout & Routing-Gerüst

**Files:**
- Create: `Frontend/src/components/layout/{bottom-nav.tsx, admin-shell.tsx}`
- Create: `Frontend/src/router.tsx`
- Modify: `Frontend/src/app.tsx`
- Create: leere Seiten-Stubs unter `Frontend/src/pages/**` (jede exportiert `export default function XPage(){ return <div className="p-4">X</div>; }`)

**Interfaces:**
- Consumes: `useCart` (für Warenkorb-Badge), react-router.
- Produces: Routen `/`, `/konfigurator`, `/warenkorb`, `/bestaetigung`, `/admin`, `/admin/dashboard`, `/admin/tage`, `/admin/oeffnungszeiten`, `/admin/vorlaufzeit`, `/admin/zutaten`, `/admin/gutscheine`.

- [ ] **Step 1: `BottomNav` portieren** (`App.tsx:467-523`) — statt `view`/`setView` jetzt `NavLink` aus `react-router` (aktiver Zustand via `NavLink`-`isActive`); Warenkorb-Badge aus `useCart().count`. Tabs: Speisekarte `/`, Eigene Pizza `/konfigurator`, Warenkorb `/warenkorb`, Admin `/admin`.

- [ ] **Step 2: `AdminShell` portieren** (`App.tsx:1179-1228`) — Navigation via `NavLink` auf die `/admin/*`-Routen; `onLogout` navigiert nach `/`. Als Layout-Route mit `<Outlet />`.

- [ ] **Step 3: `router.tsx` + `app.tsx`**

```tsx
// router.tsx
import { createBrowserRouter } from "react-router";
import MenuPage from "@/pages/menu/menu-page";
import ConfiguratorPage from "@/pages/configurator/configurator-page";
import CheckoutPage from "@/pages/checkout/checkout-page";
import ConfirmationPage from "@/pages/confirmation/confirmation-page";
import AdminLoginPage from "@/pages/admin/login-page";
import AdminLayout from "@/components/layout/admin-shell";
import DashboardPage from "@/pages/admin/dashboard-page";
import DaysPage from "@/pages/admin/days-page";
import HoursPage from "@/pages/admin/hours-page";
import LeadTimePage from "@/pages/admin/lead-time-page";
import IngredientsPage from "@/pages/admin/ingredients-page";
import VouchersPage from "@/pages/admin/vouchers-page";
import AppLayout from "@/components/layout/app-layout"; // enthält <Outlet/> + <BottomNav/>

export const router = createBrowserRouter([
  { element: <AppLayout />, children: [
    { path: "/", element: <MenuPage /> },
    { path: "/konfigurator", element: <ConfiguratorPage /> },
    { path: "/warenkorb", element: <CheckoutPage /> },
    { path: "/bestaetigung", element: <ConfirmationPage /> },
  ]},
  { path: "/admin", element: <AdminLoginPage /> },
  { path: "/admin", element: <AdminLayout />, children: [
    { path: "dashboard", element: <DashboardPage /> },
    { path: "tage", element: <DaysPage /> },
    { path: "oeffnungszeiten", element: <HoursPage /> },
    { path: "vorlaufzeit", element: <LeadTimePage /> },
    { path: "zutaten", element: <IngredientsPage /> },
    { path: "gutscheine", element: <VouchersPage /> },
  ]},
]);
```
```tsx
// app.tsx
import { RouterProvider } from "react-router";
import { CartProvider } from "@/hooks/use-cart";
import { router } from "@/router";
export default function App() {
  return (
    <CartProvider>
      <div className="min-h-screen bg-background text-foreground max-w-lg mx-auto relative" style={{ fontFamily: "'DM Sans', sans-serif" }}>
        <RouterProvider router={router} />
      </div>
    </CartProvider>
  );
}
```
Zusätzlich `components/layout/app-layout.tsx`: rendert `<Outlet/>` + `<BottomNav/>` (BottomNav nur auf Kundenrouten).

- [ ] **Step 4: Alle Seiten-Stubs anlegen** (Pfade siehe router.tsx-Imports). Jeder Stub minimal, damit der Router baut.

- [ ] **Step 5: Verifizieren** — Run: `cd Frontend && bun run build && bun run dev`. Manuell: Bottom-Nav wechselt zwischen `/`, `/konfigurator`, `/warenkorb`; `/admin` zeigt Login-Stub; `/admin/dashboard` zeigt Shell + Stub. Abbrechen.

- [ ] **Step 6: Commit**

```bash
git add Frontend/src
git commit -m "feat(frontend): Routing-Gerüst, BottomNav & AdminShell mit react-router"
```

---

### Task 8: Speisekarte (Menu-Page)

**Files:**
- Modify: `Frontend/src/pages/menu/menu-page.tsx`

**Interfaces:**
- Consumes: `getMenu` (store), `useAsync`, `useCart`, `PizzaCard`, `AsyncBoundary`.

- [ ] **Step 1: `HomePage` portieren** (`App.tsx:541-643`) nach `menu-page.tsx`. Ersetze:
  - Menü-Quelle: `useAsync(getMenu)` statt `MENU`-Konstante; in `AsyncBoundary` wrappen (Loading „Lädt…", leer = Hinweis).
  - „In den Warenkorb": `useCart().addToCart(template.name, template.ingredientIds)`; danach optional `sonner`-Toast (falls nicht installiert: dezenter Inline-Hinweis, kein neues Package nötig).
  - „Zum Warenkorb": `useNavigate()("/warenkorb")`.
  - Kacheln über `PizzaCard` rendern.

- [ ] **Step 2: Verifizieren** — Run: `cd Frontend && bun run dev`. Manuell: Speisekarte lädt 4 Pizzen; Klick legt in Warenkorb (Badge zählt hoch, bleibt nach Reload → localStorage). Abbrechen.

- [ ] **Step 3: Commit**

```bash
git add Frontend/src/pages/menu
git commit -m "feat(frontend): Speisekarte mit async Menü + Warenkorb-Anbindung"
```

---

### Task 9: Konfigurator (Configurator-Page)

**Files:**
- Modify: `Frontend/src/pages/configurator/configurator-page.tsx`

**Interfaces:**
- Consumes: `getIngredients` (store), `useAsync`, `useCart`, `PizzaSVG`, `getRecs`.

- [ ] **Step 1: `getRecs` nach `lib/pricing.ts`-Nachbar `lib/recommendations.ts` verschieben** — reine Funktion aus `App.tsx:196-207` (`export function getRecs(selected: string[])`).

- [ ] **Step 2: `ConfiguratorPage` portieren** (`App.tsx:645-775`) — Ersetze:
  - Zutaten-Quelle: `useAsync(getIngredients)` + `AsyncBoundary`; nur `available`-Zutaten aktiv, deaktivierte grau (wie Vorlage).
  - lokaler `selected`-State via `useState<string[]>([])` + `toggle`.
  - „+ Warenkorb": `useCart().addToCart("Eigene Pizza", selected)` (nur wenn `selected.length > 0`), danach `selected` leeren und zu `/warenkorb` navigieren.
  - Live-Vorschau über `PizzaSVG selected={selected}`.

- [ ] **Step 3: Verifizieren** — Run: `cd Frontend && bun run dev`. Manuell: Zutaten togglebar, Vorschau aktualisiert, „In den Warenkorb" erhöht Badge. Abbrechen.

- [ ] **Step 4: Commit**

```bash
git add Frontend/src/pages/configurator Frontend/src/lib/recommendations.ts
git commit -m "feat(frontend): Konfigurator mit async Zutaten + Live-Vorschau"
```

---

### Task 10: Warenkorb/Checkout (Checkout-Page)

**Files:**
- Modify: `Frontend/src/pages/checkout/checkout-page.tsx`

**Interfaces:**
- Consumes: `useCart`, `getIngredients`, `getVouchers`, `getConfig`, `createOrder` (store); `computeSubtotal/Discount/Total`, `formatPrice`, `validateVoucher` (pricing); `getSelectableDates`, `getAvailableTimes`, `formatDateLabel` (slots); `SelectInput`, `PizzaSVG`, `AsyncBoundary`.
- Produces: nach erfolgreicher Bestellung Navigation zu `/bestaetigung` mit `OrderData` via `navigate("/bestaetigung", { state: order })`.

- [ ] **Step 1: `CheckoutPage` portieren** (`App.tsx:777-1025`) mit neuer Verdrahtung:
  - `cart` aus `useCart()`; leerer Warenkorb → Empty-State (Vorlage `:815-824`).
  - Config laden: `useAsync(getConfig)`; **Datumsoptionen = `getSelectableDates(config, new Date())`** (⇒ Vorlaufzeit greift), Zeiten = `getAvailableTimes(config.hours)`.
  - Zutatennamen: `useAsync(getIngredients)` für die Anzeige.
  - Gutschein: lokaler State; `applyVoucher` ruft `validateVoucher(code, await getVouchers(), new Date())`; Nachricht wie Vorlage.
  - Preise: `computeSubtotal(cart.length)`, `computeDiscount`, `computeTotal`, Anzeige via `formatPrice`.
  - `canOrder`-Bedingung wie Vorlage (`:807-808`).
  - „Jetzt bestellen": `const order = await createOrder({ items: cart, customer, notes, pickupDate, pickupTime, voucherCode })`; dann `clearCart()`; `navigate("/bestaetigung", { state: order })`.

- [ ] **Step 2: Verifizieren** — Run: `cd Frontend && bun run dev`. Manuell: früheste wählbare Datumsoption liegt **≥ 3 Tage** in der Zukunft; Gutschein `WELCOME10` reduziert Summe; Bestellung führt zur Bestätigung. Abbrechen.

- [ ] **Step 3: Commit**

```bash
git add Frontend/src/pages/checkout
git commit -m "feat(frontend): Checkout mit Vorlaufzeit-Slots, Gutschein & Bestellung"
```

---

### Task 11: Bestätigung (Confirmation-Page)

**Files:**
- Modify: `Frontend/src/pages/confirmation/confirmation-page.tsx`

**Interfaces:**
- Consumes: `useLocation().state` (OrderData), `QrCode`, `getIngredients`, `formatPrice`.

- [ ] **Step 1: `ConfirmationPage` portieren** (`App.tsx:1026-1126`):
  - Order aus `useLocation().state as OrderData | null`; falls `null` → Redirect `/` (`<Navigate to="/" replace />`).
  - QR-Inhalt = Bestellnummer/Order-JSON wie Vorlage; `QrCode data={order.id}`.
  - Zutatennamen via `useAsync(getIngredients)`.
  - „Neue Bestellung" → `navigate("/")`.

- [ ] **Step 2: Verifizieren** — Run: `cd Frontend && bun run dev`. Manuell: nach Bestellung erscheinen Bestellnummer + QR; direkter Aufruf von `/bestaetigung` ohne State leitet nach `/`. Abbrechen.

- [ ] **Step 3: Commit**

```bash
git add Frontend/src/pages/confirmation
git commit -m "feat(frontend): Bestätigungsseite mit QR-Code"
```

---

### Task 12: Admin-Login & Config-Zugang

**Files:**
- Modify: `Frontend/src/pages/admin/login-page.tsx`
- Create: `Frontend/src/hooks/use-admin-auth.ts`

**Interfaces:**
- Consumes: `verifyAdminPassword` (store).
- Produces: `useAdminAuth(): { isAdmin: boolean; login(pw): Promise<boolean>; logout(): void }` (Session in `sessionStorage`).

- [ ] **Step 1: `use-admin-auth.ts`** — hält `isAdmin` (init aus `sessionStorage.getItem("pizza-admin")`); `login(pw)` ruft `verifyAdminPassword`, bei Erfolg setzt Flag; `logout()` löscht Flag. **Kommentar: TEIL-B TODO — echte Supabase-Auth.**

- [ ] **Step 2: `AdminLoginPage` portieren** (`App.tsx:1127-1178`): Passwortfeld + Show-Toggle + Fehleranzeige; bei Erfolg `navigate("/admin/dashboard")`. Guard: `AdminLayout` (Task 7) prüft `useAdminAuth().isAdmin`, sonst `<Navigate to="/admin" replace />`.

- [ ] **Step 3: Verifizieren** — Run: `cd Frontend && bun run dev`. Manuell: falsches Passwort → Fehler; `pizza` → Dashboard; direkter Aufruf `/admin/zutaten` ohne Login → Login. Abbrechen.

- [ ] **Step 4: Commit**

```bash
git add Frontend/src/pages/admin/login-page.tsx Frontend/src/hooks/use-admin-auth.ts Frontend/src/components/layout/admin-shell.tsx
git commit -m "feat(frontend): Admin-Login + Session-Guard (Mock-Auth, TEIL-B TODO)"
```

---

### Task 13: Admin-Dashboard

**Files:**
- Modify: `Frontend/src/pages/admin/dashboard-page.tsx`

**Interfaces:**
- Consumes: `getDashboardStats` (store), `useAsync`, `SvgBarChart`, `SvgDonutChart`, `AsyncBoundary`.

- [ ] **Step 1: `AdminDashboard` portieren** (`App.tsx:1307-1361`): Kennzahlen + Charts; Datenquelle `useAsync(getDashboardStats)` statt `WEEK_DATA`/`PIE_DATA`-Konstanten; `week` → `SvgBarChart`, `toppings` → `SvgDonutChart` mit `PIE_COLORS`.

- [ ] **Step 2: Verifizieren** — Run: `cd Frontend && bun run dev` → `/admin/dashboard` zeigt Charts. Abbrechen.

- [ ] **Step 3: Commit**

```bash
git add Frontend/src/pages/admin/dashboard-page.tsx
git commit -m "feat(frontend): Admin-Dashboard mit async Kennzahlen & Charts"
```

---

### Task 14: Admin — Tage, Öffnungszeiten & Vorlaufzeit

**Files:**
- Modify: `Frontend/src/pages/admin/{days,hours,lead-time}-page.tsx`

**Interfaces:**
- Consumes: `getConfig`, `saveConfig` (store), `useAsync`, `Switch`, `SelectInput`.

- [ ] **Step 1: `DaysPage` portieren** (`App.tsx:1362-1397`): lädt `config` via `useAsync(getConfig)`; Wochentag-Switches ändern `config.days`; „Speichern" ruft `saveConfig(next)`.

- [ ] **Step 2: `HoursPage` portieren** (`App.tsx:1398-1432`): `from`/`to` via `SelectInput` (15-Min-Raster oder Stundenauswahl wie Vorlage); Speichern → `saveConfig`.

- [ ] **Step 3: `LeadTimePage` (neu)**: Zahl-Eingabe/Select `Vorlaufzeit in Tagen` (0–14, Default aus `config.leadTimeDays`), kurze Erklärung („Frühester Abholtag = heute + Vorlaufzeit"); Speichern → `saveConfig({ ...config, leadTimeDays })`. In `AdminShell`-Nav (Task 7) ist `/admin/vorlaufzeit` bereits verlinkt.

- [ ] **Step 4: Verifizieren** — Run: `cd Frontend && bun run dev`. Manuell: Vorlaufzeit auf 5 setzen + speichern → im Checkout ist die früheste Datumsoption 5 Tage entfernt (localStorage-persistent). Abbrechen.

- [ ] **Step 5: Commit**

```bash
git add Frontend/src/pages/admin/days-page.tsx Frontend/src/pages/admin/hours-page.tsx Frontend/src/pages/admin/lead-time-page.tsx
git commit -m "feat(frontend): Admin Tage/Öffnungszeiten + neue Vorlaufzeit-Einstellung"
```

---

### Task 15: Admin — Zutatenverwaltung

**Files:**
- Modify: `Frontend/src/pages/admin/ingredients-page.tsx`

**Interfaces:**
- Consumes: `getIngredients`, `saveIngredients` (store), `useAsync`.

- [ ] **Step 1: `AdminIngredientsPage` portieren** (`App.tsx:1433-1540`): Laden via `useAsync(getIngredients)`; aktivieren/deaktivieren, löschen, „Neue Zutat" (Emoji, Name, Kategorie, Beschreibung). Jede Mutation aktualisiert lokalen State **und** persistiert via `saveIngredients(next)`.

- [ ] **Step 2: Verifizieren** — Run: `cd Frontend && bun run dev`. Manuell: neue Zutat anlegen → erscheint im Konfigurator (nach Reload, da persistent). Deaktivieren → im Konfigurator grau. Abbrechen.

- [ ] **Step 3: Commit**

```bash
git add Frontend/src/pages/admin/ingredients-page.tsx
git commit -m "feat(frontend): Admin-Zutatenverwaltung (persistent)"
```

---

### Task 16: Admin — Gutscheinverwaltung

**Files:**
- Modify: `Frontend/src/pages/admin/vouchers-page.tsx`

**Interfaces:**
- Consumes: `getVouchers`, `saveVouchers` (store), `useAsync`.

- [ ] **Step 1: `AdminVouchersPage` portieren** (`App.tsx:1541-1711`): Laden via `useAsync(getVouchers)`; erstellen (Name, Code, Typ percent/fixed/ingredient, Wert, Ablaufdatum, maxUses), aktivieren/deaktivieren, löschen. Mutationen persistieren via `saveVouchers(next)`.

- [ ] **Step 2: Verifizieren** — Run: `cd Frontend && bun run dev`. Manuell: neuen Prozent-Gutschein anlegen → im Checkout einlösbar; deaktivierten → abgelehnt. Abbrechen.

- [ ] **Step 3: Commit**

```bash
git add Frontend/src/pages/admin/vouchers-page.tsx
git commit -m "feat(frontend): Admin-Gutscheinverwaltung (persistent)"
```

---

### Task 17: E2E-Happy-Path (Playwright)

**Files:**
- Create: `Frontend/tests/e2e/order.spec.ts`

- [ ] **Step 1: Test schreiben** (Feature-Parität nach Refactor)

```ts
import { test, expect } from "@playwright/test";

test("Bestell-Happy-Path: Pizza → Warenkorb → bestellen → Bestätigung + QR", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  // erste Standard-Pizza in den Warenkorb
  await page.getByRole("button", { name: /warenkorb|hinzufügen|\+/i }).first().click();

  // zum Warenkorb
  await page.goto("/warenkorb");
  await page.getByLabel("Vorname").fill("Max");
  await page.getByLabel("Nachname").fill("Mustermann");
  await page.getByLabel("Telefon").fill("+49 170 1234567");

  // frühestes Datum + erste Zeit wählen (Selects), dann bestellen
  await page.locator("select").first().selectOption({ index: 1 });
  await page.locator("select").nth(1).selectOption({ index: 1 });
  await page.getByRole("button", { name: /jetzt bestellen/i }).click();

  // Bestätigung
  await expect(page.getByText(/#\d{5}/)).toBeVisible();
  await expect(page.locator("svg")).toBeVisible(); // QR
});
```
> Selektoren ggf. an die portierten Labels anpassen (aria-Label / `getByLabel`). Falls die Selects keine nativen `<select>` sind, `SelectInput` in Task 6 so lassen, dass es ein natives `<select>` rendert (tut es laut `App.tsx:433-465`).

- [ ] **Step 2: Playwright-Browser installieren & Test laufen lassen**

Run: `cd Frontend && bunx playwright install --with-deps chromium && bun run test:e2e`
Expected: 1 passed.

- [ ] **Step 3: Commit**

```bash
git add Frontend/tests
git commit -m "test(frontend): E2E-Happy-Path (Bestellung bis QR-Bestätigung)"
```

---

### Task 18: Aufräumen, README & Projekt-Doku

**Files:**
- Create: `Frontend/README.md`
- Modify: `Doku/Pizza/Changelog.md`, `Doku/Pizza/TODO.md`, `Doku/Pizza/Frontend/README.md`
- Create: `Doku/Pizza/Entscheidungen/ADR-0001-mobile-capacitor.md`, `ADR-0002-backend-supabase.md`, `ADR-0003-whatsapp-callmebot.md` (aus Template `_adr.md`)

- [ ] **Step 1: Gesamt-Verifikation**

Run: `cd Frontend && bun run build && bun run test && bun run test:e2e`
Expected: Build ok, Vitest alle grün, E2E grün.
Manuell (Feature-Parität-Check gegen `Frontend vorlage/README.md`): Speisekarte (4 Pizzen), Konfigurator, Warenkorb (mehrere Pizzen, entfernen), Gutschein (percent/fixed/ingredient), Vorlaufzeit ≥3 Tage, Admin (Dashboard, Tage, Öffnungszeiten, Vorlaufzeit, Zutaten, Gutscheine), QR-Bestätigung.

- [ ] **Step 2: Prüfen, dass keine Altlasten übrig sind** — kein `@mui`/`@emotion` in `Frontend/package.json`; keine `pnpm-workspace.yaml`; kein `figma:asset`-Import; kein `ADMIN_PASSWORD` außerhalb `seed.ts`.

Run: `cd Frontend && grep -rInE "mui|emotion|figma:asset" src package.json || echo "sauber"`
Expected: `sauber`.

- [ ] **Step 3: `Frontend/README.md`** — Kurz: Zweck, Bun-Befehle (`bun install|dev|build|test|test:e2e`), Ordnerstruktur, Hinweis „Daten aktuell Mock/localStorage → Teil-B Supabase", Vorlaufzeit-Einstellung.

- [ ] **Step 4: Projekt-Doku pflegen (CLAUDE.md-System)** — Templates aus `Doku/Pizza/Templates/` nutzen:
  - `Changelog.md`: Eintrag „Teil-A Frontend-Fundament umgesetzt".
  - `TODO.md`: Teil-B-Punkte (Supabase-Schema, echte Admin-Auth, WhatsApp via CallMeBot, Status-Workflow + Realtime, serverseitige Vorlauf-/Preis-Validierung, Telefon-Validierung) und Teil-C (Capacitor).
  - `Doku/Pizza/Frontend/README.md`: Seiten/Komponenten-Überblick.
  - ADRs anlegen: 0001 Capacitor (Mobile-Weg), 0002 Supabase (Backend), 0003 WhatsApp via CallMeBot, **0004 Bun-nativer Test-Runner statt Vitest** (Bun-on-Windows-Inkompatibilität).

- [ ] **Step 5: Commit**

```bash
git add Frontend/README.md Doku/
git commit -m "docs: Teil-A Doku, README, ADRs (Capacitor/Supabase/CallMeBot), Changelog & TODO"
```

---

## Self-Review (durchgeführt)

- **Spec-Abdeckung:** Ordnerstruktur → T1/T6/T7; Monolith-Mapping → T2–T16; Routing/useCart/Datenschicht-Naht → T4/T5/T7/T8–T16; Vorlaufzeit → T3+T10+T14; async States → T6 (AsyncBoundary) + Seiten; Warenkorb-Persistenz → T5; Bun/MUI-Bereinigung → T1+T18; Tests (Preis/Slots + E2E) → T2/T3/T17; DoD → T18. Keine offenen Spec-Punkte.
- **Platzhalter:** keine „TBD/TODO ohne Inhalt"; „TEIL-B TODO"-Marker sind bewusste, benannte Verweise.
- **Typ-Konsistenz:** `AppConfig`, `NewOrder`, `OrderData`, `VoucherDef`, `CartItem` einheitlich über `@/types`; Store-Signaturen (`getConfig/saveConfig/createOrder/getSelectableDates`) durchgängig identisch verwendet.
