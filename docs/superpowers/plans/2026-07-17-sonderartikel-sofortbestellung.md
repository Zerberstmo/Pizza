# Sonderartikel: Sofort-Bestellung + Sofort-WhatsApp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eine Bestellung aus **ausschließlich** Sonderartikeln umgeht alle Abhol-Beschränkungen (Datum/Zeit = jetzt, ein Klick), und **jede** Bestellung mit mindestens einem Sonderartikel löst binnen Sekunden eine WhatsApp an den Betreiber aus.

**Architecture:** Die eine Bedingung, die alles steuert, ist „keine einzige Pizza im Warenkorb" — Frontend (`pizzaQuantity(cart) === 0`) und Datenbank (`pizza_qty = 0` in `validate_order`) leiten sie **unabhängig voneinander** aus den Positionen ab; der Client behauptet nichts, was der Server glauben müsste. Migration `0013` ergänzt `orders.special_notified_at`, ersetzt `validate_order` (Slot-Block wird bei `pizza_qty = 0` übersprungen) und hängt einen AFTER-INSERT-Trigger an, der via `pg_net` die neue Edge Function `notify-special-order` ruft; ein 5-Minuten-Cron ruft dieselbe Function als Sicherheitsnetz. Der Nachrichtentext entsteht in einer reinen, getesteten Funktion `formatSpecialAlert` mit Deno-Kopie — dieselbe Sync-Disziplin wie `digest.ts` ↔ `daily-digest`.

**Tech Stack:** TypeScript/React/Vite, Tailwind + shadcn/ui, **Bun** (Package-Manager + `bun:test`), Supabase (Postgres/RLS/Trigger/`pg_net`/`pg_cron`, Edge Functions in Deno), CallMeBot HTTP-API.

**Spec:** `docs/superpowers/specs/2026-07-17-sonderartikel-sofortbestellung-design.md` (freigegeben)

## Global Constraints

- **Server autoritativ:** `validate_order` überschreibt weiterhin `subtotal`/`discount`/`total` und prüft den Grant. Die Sofort-Bestellung lockert **ausschließlich** den Abhol-Slot-Block — Preis und Zugang bleiben unangetastet.
- **Bleibt immer geprüft** (auch bei `pizza_qty = 0`): Leere-Bestellung-Prüfung, Grant-/Zugangsprüfung, Staffel-Preisberechnung, Voucher-Logik, `service_mode in ('dinein','takeaway')`.
- **Entfällt nur bei `pizza_qty = 0`:** Vorlaufzeit, Wochentag, Öffnungszeiten, Service-Modus-**Verfügbarkeit** (`app_config.service`).
- **Benachrichtigung darf die Bestellung nie scheitern lassen:** Der Trigger fängt eigene Fehler ab (`exception when others then return new`). Schlägt etwas fehl, holt der Cron es nach.
- **Senden, DANN markieren** (nicht „claimen, dann senden"): Ein Claim vor dem Versand würde bei einem Sendefehler den Retry verhindern. Doppelzustellung ist der bewusst akzeptierte, bessere Fehler.
- **Keine Secrets im Git:** Function-URL und Service-Role-Key liegen als `app.settings.notify_url` / `app.settings.notify_key`, die der Betreiber einmalig per SQL setzt. Migrationen enthalten nur `current_setting(..., true)`. Fehlt die Einstellung, überspringt der Trigger still.
- **Zeitzone:** Alle Datums-/Zeitableitungen laufen über **Europe/Berlin** (IANA-Zone, DST-sicher) — der Browser des Kunden kann in einer anderen Zone stehen.
- **Migration heißt `0013_special_instant_order.sql`** (nächste freie Nummer nach `0012_special_items.sql`).
- **Sync-Disziplin:** `Frontend/src/lib/special-alert.ts` ↔ `supabase/functions/notify-special-order/index.ts` (Deno-Copy). Bei Änderungen beide anfassen.
- **Bewusst akzeptiert:** Freigeschaltete Kunden können rund um die Uhr bestellen; die WhatsApp kann nachts eintreffen. Eine Ruhezeit ist **nicht** Teil dieses Plans (YAGNI).
- **`orders.id` ist `text`** (z. B. `#42`, aus `genId()`), nicht uuid — der Trigger reicht sie als `order_id` durch.

## File Structure

| Datei | Verantwortung |
|---|---|
| `Frontend/src/lib/berlin-time.ts` (neu) | Rein: „jetzt" → `{ date, time }` in Europe/Berlin. Einzige Zeitzonen-Ableitung des Checkouts. |
| `Frontend/src/lib/special-alert.ts` (neu) | Rein: Bestelldaten → WhatsApp-Text. Keine IO, keine Zeitzone (Uhrzeit kommt fertig rein). |
| `Frontend/src/pages/checkout/checkout-page.tsx` | Blendet Datum/Zeit aus und setzt sie auf „jetzt", wenn keine Pizza im Warenkorb liegt. |
| `supabase/migrations/0013_special_instant_order.sql` (neu) | Spalte `special_notified_at`, neuer `validate_order`, Benachrichtigungs-Trigger. |
| `supabase/functions/notify-special-order/index.ts` (neu) | Trigger- **und** Cron-Einstieg; liest `notify_config`, sendet via CallMeBot, markiert. Enthält die Deno-Copy von `formatSpecialAlert`. |

---

### Task 1: Reine Berlin-Zeit-Ableitung `berlinDateTime` (TDD)

**Files:**
- Create: `Frontend/src/lib/berlin-time.ts`
- Test: `Frontend/src/lib/__tests__/berlin-time.test.ts`

**Interfaces:**
- Produces: `berlinDateTime(now: Date): { date: string; time: string }` — `date` als `"YYYY-MM-DD"`, `time` als `"HH:MM"`, beides in Europe/Berlin. Wird von Task 3 (Checkout) konsumiert.

- [ ] **Step 1: Failing test schreiben**

`Frontend/src/lib/__tests__/berlin-time.test.ts`:

```ts
import { describe, it, expect } from "bun:test";
import { berlinDateTime } from "@/lib/berlin-time";

describe("berlinDateTime", () => {
  it("Sommerzeit: UTC+2", () => {
    // 2026-07-17 19:42 UTC = 21:42 Berlin (CEST)
    expect(berlinDateTime(new Date("2026-07-17T19:42:00Z"))).toEqual({ date: "2026-07-17", time: "21:42" });
  });
  it("Winterzeit: UTC+1", () => {
    // 2026-01-15 23:30 UTC = 2026-01-16 00:30 Berlin (CET) — Datum kippt mit
    expect(berlinDateTime(new Date("2026-01-15T23:30:00Z"))).toEqual({ date: "2026-01-16", time: "00:30" });
  });
  it("Mitternacht wird 00:00, nicht 24:00", () => {
    expect(berlinDateTime(new Date("2026-07-16T22:00:00Z")).time).toBe("00:00");
  });
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag prüfen**

Run: `cd "C:/Users/Anwender/Desktop/Website/Pizza/Frontend" && bun test berlin-time`
Expected: FAIL mit "Cannot find module '@/lib/berlin-time'".

- [ ] **Step 3: Minimale Implementierung**

`Frontend/src/lib/berlin-time.ts`:

```ts
// Datum/Uhrzeit in Europe/Berlin (DST-sicher über die IANA-Zone). Der Browser des Kunden kann in
// einer anderen Zone stehen — die Bestellung gehört aber immer in die Zeit des Ladens.
// hourCycle "h23" statt hour12:false: sonst liefern manche Locales "24" statt "00" für Mitternacht.
export function berlinDateTime(now: Date): { date: string; time: string } {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Berlin",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    })
      .formatToParts(now)
      .map((x) => [x.type, x.value]),
  );
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}
```

- [ ] **Step 4: Test laufen lassen, Erfolg prüfen**

Run: `cd "C:/Users/Anwender/Desktop/Website/Pizza/Frontend" && bun test berlin-time`
Expected: PASS (3 Assertions grün).

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/Anwender/Desktop/Website/Pizza"
git add Frontend/src/lib/berlin-time.ts Frontend/src/lib/__tests__/berlin-time.test.ts
git commit -m "feat(time): reine Berlin-Zeit-Ableitung berlinDateTime (DST-sicher)"
```

---

### Task 2: Reiner Nachrichtentext `formatSpecialAlert` (TDD)

**Files:**
- Create: `Frontend/src/lib/special-alert.ts`
- Test: `Frontend/src/lib/__tests__/special-alert.test.ts`

**Interfaces:**
- Produces:
  - `interface AlertItem { kind?: string; name?: string; emoji?: string; pizzaName?: string; quantity?: number }`
  - `interface SpecialAlertOrder { id: string; createdTime: string; customerName: string; customerPhone: string; items: AlertItem[]; total: number; serviceMode: "dinein" | "takeaway"; notes: string }`
  - `formatSpecialAlert(o: SpecialAlertOrder): string`
- Task 5 spiegelt diese Funktion als Deno-Copy. **Kein** Produktiv-Importer im Frontend — wie `digest.ts` existiert sie hier, um testbar zu sein.

> **Warum `createdTime` von außen kommt:** Die Funktion bleibt so ohne `Date`/`Intl` rein und voll testbar. Die Zeitzonen-Ableitung passiert im Aufrufer (Task 5).

- [ ] **Step 1: Failing test schreiben**

`Frontend/src/lib/__tests__/special-alert.test.ts`:

```ts
import { describe, it, expect } from "bun:test";
import { formatSpecialAlert, type SpecialAlertOrder } from "@/lib/special-alert";

const mk = (o: Partial<SpecialAlertOrder>): SpecialAlertOrder => ({
  id: "#42", createdTime: "21:42", customerName: "Max Mustermann", customerPhone: "+49 170 1234567",
  items: [{ kind: "special", name: "VIP", emoji: "🌿", quantity: 2 }],
  total: 12, serviceMode: "takeaway", notes: "", ...o,
});

describe("formatSpecialAlert", () => {
  it("Kopf mit Nummer, Uhrzeit, Name, Telefon", () => {
    expect(formatSpecialAlert(mk({}))).toContain("#42 · 21:42 · Max Mustermann · +49 170 1234567");
  });
  it("Sonderartikel mit Emoji und Menge", () => {
    expect(formatSpecialAlert(mk({}))).toContain("🌿 VIP × 2");
  });
  it("Mischbestellung: Pizza wird zusätzlich gelistet", () => {
    const msg = formatSpecialAlert(mk({
      items: [
        { kind: "special", name: "VIP", emoji: "🌿", quantity: 2 },
        { pizzaName: "Margherita", quantity: 1 },
      ],
      total: 22,
    }));
    expect(msg).toContain("🌿 VIP × 2");
    expect(msg).toContain("• Margherita × 1");
    expect(msg).toContain("Gesamt 22,00 €");
  });
  it("Vor Ort statt Abholen", () => {
    expect(formatSpecialAlert(mk({ serviceMode: "dinein" }))).toContain("· Vor Ort");
  });
  it("Notiz nur wenn vorhanden", () => {
    expect(formatSpecialAlert(mk({ notes: "klingeln" }))).toContain("Notiz: klingeln");
    expect(formatSpecialAlert(mk({ notes: "" }))).not.toContain("Notiz:");
  });
  it("fehlende Menge zählt als 1", () => {
    expect(formatSpecialAlert(mk({ items: [{ kind: "special", name: "VIP", emoji: "🌿" }] }))).toContain("🌿 VIP × 1");
  });
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag prüfen**

Run: `cd "C:/Users/Anwender/Desktop/Website/Pizza/Frontend" && bun test special-alert`
Expected: FAIL mit "Cannot find module '@/lib/special-alert'".

- [ ] **Step 3: Minimale Implementierung**

`Frontend/src/lib/special-alert.ts`:

```ts
// Reiner Nachrichtentext für die Sofort-WhatsApp bei Sonderartikel-Bestellungen.
// Deterministisch: createdTime kommt fertig von außen, damit hier ohne Date/Intl (voll testbar).
// Die Edge Function supabase/functions/notify-special-order/index.ts spiegelt diese Funktion
// als Deno-Copy — bei Änderungen synchron halten!

export interface AlertItem {
  kind?: string;      // "special" | undefined (fehlend = Pizza)
  name?: string;      // Sonderartikel
  emoji?: string;     // Sonderartikel
  pizzaName?: string; // Pizza
  quantity?: number;  // fehlend = 1
}

export interface SpecialAlertOrder {
  id: string;
  createdTime: string; // "HH:MM" in Europe/Berlin
  customerName: string;
  customerPhone: string;
  items: AlertItem[];
  total: number;
  serviceMode: "dinein" | "takeaway";
  notes: string;
}

// Geldformat gespiegelt von lib/pricing.ts formatPrice (special-alert.ts bleibt standalone für die Deno-Copy).
function euro(n: number): string {
  return `${n.toFixed(2).replace(".", ",")} €`;
}

export function formatSpecialAlert(o: SpecialAlertOrder): string {
  const specials = o.items.filter((it) => it.kind === "special");
  const pizzas = o.items.filter((it) => it.kind !== "special");
  const service = o.serviceMode === "dinein" ? "Vor Ort" : "Abholen";
  const lines = [
    "⭐ Sonderartikel-Bestellung",
    `${o.id} · ${o.createdTime} · ${o.customerName} · ${o.customerPhone}`,
    ...specials.map((it) => `  ${it.emoji ?? "⭐"} ${it.name ?? "?"} × ${it.quantity ?? 1}`),
    ...pizzas.map((it) => `  • ${it.pizzaName ?? "?"} × ${it.quantity ?? 1}`),
    `Gesamt ${euro(o.total)} · ${service}`,
  ];
  if (o.notes.trim()) lines.push(`Notiz: ${o.notes.trim()}`);
  return lines.join("\n");
}
```

- [ ] **Step 4: Test laufen lassen, Erfolg prüfen**

Run: `cd "C:/Users/Anwender/Desktop/Website/Pizza/Frontend" && bun test special-alert`
Expected: PASS (6 Assertions grün).

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/Anwender/Desktop/Website/Pizza"
git add Frontend/src/lib/special-alert.ts Frontend/src/lib/__tests__/special-alert.test.ts
git commit -m "feat(notify): reiner Nachrichtentext formatSpecialAlert (bun:test)"
```

---

### Task 3: Checkout — Sofort-Bestellung bei reinem Sonderartikel-Warenkorb

**Files:**
- Modify: `Frontend/src/lib/cart-items.ts`
- Modify: `Frontend/src/pages/checkout/checkout-page.tsx`
- Test: `Frontend/src/lib/__tests__/cart-items.test.ts`

**Interfaces:**
- Consumes: `berlinDateTime` (Task 1); `pizzaQuantity`, `isSpecialItem` (bestehend, `@/lib/cart-items`).
- Produces in `@/lib/cart-items`: `isSpecialsOnly(items: CartItem[]): boolean` — die zentrale Bedingung als reiner, getesteter Helfer.

> **Warum `isSpecialsOnly` ein eigener Helfer ist:** Das ist laut Architektur *die* Bedingung, die alles steuert, und das TS-Gegenstück zu `pizza_qty = 0` in `validate_order`. Als Ausdruck mitten in der Komponente wäre sie nicht testbar — genau die Regel, die es zu sichern gilt.

> **Zwei Fallstricke, die beim Lesen der Datei aufgefallen sind — nicht wegkürzen:**
> 1. Header (Zeile 143) und Bestell-Button (Zeile 357) beschriften sich mit `pizzaQuantity(cart)`. Bei reinem Sonderartikel-Warenkorb stünde dort „0 Pizzen abholen".
> 2. `serviceMode` wird nur gesetzt, wenn `availableServiceModes(config)` etwas liefert (Zeile 61). Sind beide Modi aus, bliebe er `""` → `canOrder` false → die Sofort-Bestellung wäre clientseitig blockiert, obwohl der Server sie erlaubt. Darum der `takeaway`-Fallback.

- [ ] **Step 1: Failing test für `isSpecialsOnly` schreiben**

In `Frontend/src/lib/__tests__/cart-items.test.ts` den Import erweitern und den Testblock anfügen. Der Import in Zeile 2 wird zu:

```ts
import { isSpecialItem, itemTitle, itemLineTotal, pizzaQuantity, specialsTotal, cartSubtotal, isSpecialsOnly } from "@/lib/cart-items";
```

Am Dateiende anfügen (`pizza`/`special`/`cart` sind oben in der Datei bereits definiert):

```ts
describe("isSpecialsOnly", () => {
  it("nur Sonderartikel => true", () => expect(isSpecialsOnly([special])).toBe(true));
  it("gemischt => false", () => expect(isSpecialsOnly(cart)).toBe(false));
  it("nur Pizza => false", () => expect(isSpecialsOnly([pizza])).toBe(false));
  it("leerer Warenkorb => false (nicht bestellbar, nicht 'sofort')", () => expect(isSpecialsOnly([])).toBe(false));
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag prüfen**

Run: `cd "C:/Users/Anwender/Desktop/Website/Pizza/Frontend" && bun test cart-items`
Expected: FAIL — `isSpecialsOnly is not a function` (bzw. TS-Fehler beim Import).

- [ ] **Step 3: `isSpecialsOnly` in cart-items.ts ergänzen**

Am Ende von `Frontend/src/lib/cart-items.ts` anfügen:

```ts
// Reine Sonderartikel-Bestellung: keine einzige Pizza im (nicht leeren) Warenkorb.
// TS-Gegenstück zu `pizza_qty = 0` in validate_order (0013) — beide Seiten leiten das
// unabhängig voneinander aus den Positionen ab, der Client behauptet es nicht.
// Leerer Warenkorb => false: der ist gar nicht bestellbar.
export function isSpecialsOnly(items: CartItem[]): boolean {
  return items.length > 0 && pizzaQuantity(items) === 0;
}
```

- [ ] **Step 4: Test laufen lassen, Erfolg prüfen**

Run: `cd "C:/Users/Anwender/Desktop/Website/Pizza/Frontend" && bun test cart-items`
Expected: PASS (bestehende 6 + 4 neue Assertions grün).

- [ ] **Step 5: Imports im Checkout ergänzen**

In `Frontend/src/pages/checkout/checkout-page.tsx` Zeile 12 ersetzen:

```ts
import { isSpecialItem, itemLineTotal, cartSubtotal, pizzaQuantity, isSpecialsOnly } from "@/lib/cart-items";
import { berlinDateTime } from "@/lib/berlin-time";
```

- [ ] **Step 6: `specialsOnly` ableiten + Service-Modus-Fallback**

Ersetze Zeile 61:

```ts
  if (modes.length > 0 && !serviceMode) setServiceMode(modes[0]);
```

durch:

```ts
  const specialsOnly = isSpecialsOnly(cart);

  if (modes.length > 0 && !serviceMode) setServiceMode(modes[0]);
  // Sonderartikel umgehen die Service-Verfügbarkeit (0013). Ohne Fallback bliebe serviceMode ""
  // und canOrder false, obwohl der Server die Bestellung annähme.
  else if (specialsOnly && !serviceMode) setServiceMode("takeaway");
```

- [ ] **Step 7: `canOrder` — Datum/Zeit nur für Pizza-Bestellungen verlangen**

Ersetze Zeile 67-69:

```ts
  const canOrder =
    customer.firstName.trim() && customer.lastName.trim() && customer.phone.trim() &&
    pickupDate && pickupTime && cart.length > 0 && !!serviceMode;
```

durch:

```ts
  const canOrder =
    customer.firstName.trim() && customer.lastName.trim() && customer.phone.trim() &&
    (specialsOnly || (pickupDate && pickupTime)) && cart.length > 0 && !!serviceMode;
```

- [ ] **Step 8: `placeOrder` — Datum/Zeit auf „jetzt" setzen**

Ersetze Zeile 100-119 (`placeOrder`) durch:

```ts
  const placeOrder = async () => {
    if (!canOrder || !serviceMode) return;
    if (!specialsOnly && (noDates || noService)) return;
    setOrderError("");
    // Sonderartikel: Abholung sofort — Datum/Zeit in Berlin, nicht in der Zone des Browsers.
    const now = specialsOnly ? berlinDateTime(new Date()) : null;
    try {
      const order = await createOrder({
        items: cart,
        customer,
        notes,
        pickupDate: now ? now.date : pickupDate,
        pickupTime: now ? now.time : pickupTime,
        voucherCode: appliedVoucher?.code,
        serviceMode,
      });
      clearCart();
      navigate("/bestaetigung", { state: order });
    } catch {
      // Serverseitige Validierung (Trigger validate_order) kann ablehnen → saubere Meldung statt Absturz
      setOrderError("Bestellung konnte nicht angenommen werden — bitte Angaben prüfen.");
    }
  };
```

- [ ] **Step 9: Header-Beschriftung**

Ersetze Zeile 143:

```tsx
          <p className="text-xs text-muted-foreground">{pizzaQuantity(cart)} Pizza{pizzaQuantity(cart) !== 1 ? "en" : ""}</p>
```

durch:

```tsx
          <p className="text-xs text-muted-foreground">
            {specialsOnly ? "Sonderartikel" : `${pizzaQuantity(cart)} Pizza${pizzaQuantity(cart) !== 1 ? "en" : ""}`}
          </p>
```

- [ ] **Step 10: Abhol-Karte — bei reiner Sonderartikel-Bestellung „sofort" statt Auswahl**

Ersetze den Inhalt der Abhol-`CardContent` (Zeile 246-271), also den Block von `{cfg.loading ? (` bis zum schließenden `)}` vor `</CardContent>`, durch:

```tsx
            {specialsOnly ? (
              <div className="bg-primary/8 border border-primary/20 rounded-xl px-4 py-3">
                <p className="text-sm text-primary font-semibold">Abholung sofort</p>
                <p className="text-xs text-muted-foreground mt-0.5">Kein Datum, keine Uhrzeit nötig.</p>
              </div>
            ) : cfg.loading ? (
              <p className="text-xs text-muted-foreground">Lädt…</p>
            ) : noService ? (
              <div className="bg-destructive/8 border border-destructive/20 rounded-xl px-4 py-3">
                <p className="text-sm text-destructive font-semibold">Aktuell kein Service verfügbar.</p>
                <p className="text-xs text-muted-foreground mt-0.5">Bitte zu einem späteren Zeitpunkt erneut versuchen.</p>
              </div>
            ) : noDates ? (
              <div className="bg-destructive/8 border border-destructive/20 rounded-xl px-4 py-3">
                <p className="text-sm text-destructive font-semibold">Aktuell keine Bestelltage verfügbar.</p>
                <p className="text-xs text-muted-foreground mt-0.5">Bitte zu einem späteren Zeitpunkt erneut versuchen.</p>
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5"><Calendar size={11} /> Datum</Label>
                  <SelectInput value={pickupDate} onChange={setPickupDate} options={dateOptions} placeholder="Tag wählen..." />
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5"><Clock size={11} /> Uhrzeit</Label>
                  {noTimes
                    ? <p className="text-xs text-destructive">Keine Zeiten verfügbar.</p>
                    : <SelectInput value={pickupTime} onChange={setPickupTime} options={timeOptions} placeholder="Uhrzeit wählen..." />}
                </div>
              </>
            )}
```

- [ ] **Step 11: Bestell-Button — Beschriftung und Sperre**

Ersetze Zeile 355-358:

```tsx
        <Button size="lg" className="w-full font-black text-base shadow-2xl shadow-primary/25"
          disabled={!canOrder || noDates || noService} onClick={placeOrder}>
          {pizzaQuantity(cart)} Pizza{pizzaQuantity(cart) !== 1 ? "en" : ""} {serviceMode === "dinein" ? "vor Ort" : "abholen"} — {formatPrice(total)}
        </Button>
```

durch:

```tsx
        <Button size="lg" className="w-full font-black text-base shadow-2xl shadow-primary/25"
          disabled={!canOrder || (!specialsOnly && (noDates || noService))} onClick={placeOrder}>
          {specialsOnly
            ? `Sofort bestellen — ${formatPrice(total)}`
            : `${pizzaQuantity(cart)} Pizza${pizzaQuantity(cart) !== 1 ? "en" : ""} ${serviceMode === "dinein" ? "vor Ort" : "abholen"} — ${formatPrice(total)}`}
        </Button>
```

- [ ] **Step 12: Typecheck + Build + volle Test-Suite**

Run: `cd "C:/Users/Anwender/Desktop/Website/Pizza/Frontend" && bunx tsc --noEmit && bun run build && bun test src`
Expected: Keine Typfehler; Build erfolgreich; alle Tests grün. (`Calendar`/`Clock` bleiben im Pizza-Zweig in Verwendung — der Import aus Zeile 5 bleibt also nötig.)

- [ ] **Step 13: Commit**

```bash
cd "C:/Users/Anwender/Desktop/Website/Pizza"
git add Frontend/src/lib/cart-items.ts Frontend/src/lib/__tests__/cart-items.test.ts Frontend/src/pages/checkout/checkout-page.tsx
git commit -m "feat(checkout): reine Sonderartikel-Bestellung ohne Datum/Zeit — Abholung sofort"
```

---

### Task 4: Migration 0013 — `special_notified_at`, `validate_order` ohne Slot-Block, Benachrichtigungs-Trigger

**Files:**
- Create: `supabase/migrations/0013_special_instant_order.sql`

**Interfaces:**
- Produces (DB): Spalte `orders.special_notified_at timestamptz`; ersetzte Funktion `public.validate_order()`; neue Funktion `public.notify_special_order()` + Trigger `notify_special_order_after_insert`.

> **Hinweis:** SQL ist in dieser Umgebung nicht ausführbar → kein automatischer Test. Sorgfältiges Review; der Betreiber spielt via `bunx supabase db push` ein. Der BEFORE-INSERT-Trigger aus `0005` bleibt bestehen — hier wird nur die Funktion `validate_order` ersetzt (`create or replace`).

- [ ] **Step 1: Migration-Datei anlegen — Spalte + neuer `validate_order`**

`supabase/migrations/0013_special_instant_order.sql`:

```sql
-- Sonderartikel: Sofort-Bestellung + Sofort-WhatsApp.
-- 1) Reine Sonderartikel-Bestellung (pizza_qty = 0) umgeht den Abhol-Slot-Block.
-- 2) AFTER-INSERT-Trigger meldet Bestellungen mit Sonderartikel sofort via pg_net.
-- Ersetzt validate_order aus 0012 (nur die Funktion; der Trigger aus 0005 bleibt).

-- Merker für die Sofort-Benachrichtigung. null = noch nicht zugestellt (Cron holt nach).
alter table public.orders add column if not exists special_notified_at timestamptz;

-- Preis serverseitig: 10€ * Σ(Pizza-Menge) + Σ(Sonderartikel-Zeilenpreise, über Grant+Staffel).
-- Sonderartikel ohne aktiven Grant für new.user_id -> Bestellung scheitert.
-- NEU ggü. 0012: liegt keine einzige Pizza in der Bestellung (pizza_qty = 0), entfällt der
-- komplette Abhol-Slot-Block (Vorlaufzeit/Wochentag/Öffnungszeiten/Service-Verfügbarkeit).
-- Preis, Zugang und Voucher-Logik bleiben in JEDEM Fall geprüft.
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

  -- Service-Modus bleibt IMMER auf gültige Werte begrenzt (auch bei reiner Special-Bestellung).
  if new.service_mode not in ('dinein', 'takeaway') then
    raise exception 'Ungültiger Service-Modus';
  end if;

  -- ── Abhol-Slot prüfen — entfällt komplett bei reiner Sonderartikel-Bestellung ──
  if pizza_qty > 0 then
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

    if new.service_mode = 'dinein' and not coalesce((cfg.service ->> 'dineIn')::boolean, false) then
      raise exception 'Service-Modus nicht verfügbar';
    end if;
    if new.service_mode = 'takeaway' and not coalesce((cfg.service ->> 'takeaway')::boolean, false) then
      raise exception 'Service-Modus nicht verfügbar';
    end if;
  end if;

  return new;
end; $$;
```

- [ ] **Step 2: Benachrichtigungs-Trigger anfügen**

Am Ende von `supabase/migrations/0013_special_instant_order.sql` anfügen:

```sql
-- Sofort-WhatsApp: feuert nur bei Bestellungen mit mindestens einem Sonderartikel.
-- Formatiert den Text NICHT selbst — das wäre eine dritte Kopie der Formatierungslogik.
-- Zugangsdaten kommen aus app.settings.* (vom Betreiber einmalig per SQL gesetzt, NICHT im Git).
-- Fehlt die Einstellung oder schlägt pg_net fehl: still überspringen — der Cron holt es nach.
-- WICHTIG: Diese Funktion darf die Bestellung niemals scheitern lassen.
create or replace function public.notify_special_order() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  has_special boolean;
  url text;
  key text;
begin
  select exists (
    select 1 from jsonb_array_elements(new.items) it where it->>'kind' = 'special'
  ) into has_special;
  if not has_special then
    return new;
  end if;

  url := current_setting('app.settings.notify_url', true);
  key := current_setting('app.settings.notify_key', true);
  if url is null or url = '' or key is null or key = '' then
    return new; -- nicht konfiguriert -> Sicherheitsnetz übernimmt
  end if;

  perform net.http_post(
    url     := url,
    headers := jsonb_build_object('Authorization', 'Bearer ' || key, 'Content-Type', 'application/json'),
    body    := jsonb_build_object('order_id', new.id)
  );
  return new;
exception when others then
  return new; -- eine fehlgeschlagene Benachrichtigung darf die Bestellung nie kippen
end; $$;

drop trigger if exists notify_special_order_after_insert on public.orders;
create trigger notify_special_order_after_insert
  after insert on public.orders
  for each row execute function public.notify_special_order();
```

- [ ] **Step 3: Review-Gate (statt Ausführung)**

Prüfe manuell:
- (a) Der Slot-Block steht **vollständig** innerhalb von `if pizza_qty > 0 then ... end if;` — inklusive `select ... into cfg` (sonst schlägt „Konfiguration fehlt" auch bei reiner Special-Bestellung zu).
- (b) Die `service_mode`-Whitelist steht **außerhalb** des Blocks (gilt immer), die Verfügbarkeits-Prüfungen (`cfg.service ->> ...`) **innerhalb**.
- (c) `validate_order` ist ansonsten Zeichen für Zeichen identisch zu 0012 — Preis, Grant-Lookup über `new.user_id` und Voucher-Logik dürfen sich nicht verändert haben.
- (d) Der Notify-Trigger ist `after insert` (nicht `before`) und hat einen `exception when others`-Zweig, der `new` zurückgibt.
- (e) Kein Klartext-Key und keine Projekt-URL in der Datei — nur `current_setting(..., true)`.

- [ ] **Step 4: Commit**

```bash
cd "C:/Users/Anwender/Desktop/Website/Pizza"
git add supabase/migrations/0013_special_instant_order.sql
git commit -m "feat(db): 0013 Sofort-Bestellung (Slot-Block nur bei Pizzen) + Notify-Trigger via pg_net"
```

---

### Task 5: Edge Function `notify-special-order`

**Files:**
- Create: `supabase/functions/notify-special-order/index.ts`

**Interfaces:**
- Consumes: `formatSpecialAlert` (Task 2) — als **Deno-Copy**, nicht als Import (Edge Functions haben keinen Zugriff auf `Frontend/src`).
- Konsumiert die bestehende Tabelle `notify_config` (`recipient_phone`, `callmebot_apikey`, `enabled`) aus Migration `0006` — **kein zweiter Satz Einstellungen**.
- Zwei Aufrufwege: Trigger mit `{ "order_id": "#42" }`; Cron ohne Payload.

- [ ] **Step 1: Function anlegen**

`supabase/functions/notify-special-order/index.ts`:

```ts
// Supabase Edge Function: Sofort-WhatsApp bei Bestellungen mit Sonderartikel.
// Zwei Aufrufwege:
//   1) DB-Trigger (pg_net) mit { "order_id": "#42" } -> genau diese Bestellung
//   2) pg_cron ohne Payload -> Sicherheitsnetz: alle Sonderartikel-Bestellungen der letzten 2 h,
//      die noch kein special_notified_at haben
// formatSpecialAlert ist eine Copy von Frontend/src/lib/special-alert.ts (dort getestet) — synchron halten!
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Zeitfenster des Sicherheitsnetzes: waren Benachrichtigungen länger aus und werden wieder
// eingeschaltet, soll kein Schwall alter Nachrichten rausgehen — Altes altert aus dem Fenster.
const RETRY_WINDOW_MS = 2 * 60 * 60 * 1000;

interface AlertItem {
  kind?: string; name?: string; emoji?: string; pizzaName?: string; quantity?: number;
}
interface SpecialAlertOrder {
  id: string; createdTime: string; customerName: string; customerPhone: string;
  items: AlertItem[]; total: number; serviceMode: "dinein" | "takeaway"; notes: string;
}

function euro(n: number): string {
  return `${n.toFixed(2).replace(".", ",")} €`;
}

// Copy von special-alert.ts formatSpecialAlert — synchron halten.
function formatSpecialAlert(o: SpecialAlertOrder): string {
  const specials = o.items.filter((it) => it.kind === "special");
  const pizzas = o.items.filter((it) => it.kind !== "special");
  const service = o.serviceMode === "dinein" ? "Vor Ort" : "Abholen";
  const lines = [
    "⭐ Sonderartikel-Bestellung",
    `${o.id} · ${o.createdTime} · ${o.customerName} · ${o.customerPhone}`,
    ...specials.map((it) => `  ${it.emoji ?? "⭐"} ${it.name ?? "?"} × ${it.quantity ?? 1}`),
    ...pizzas.map((it) => `  • ${it.pizzaName ?? "?"} × ${it.quantity ?? 1}`),
    `Gesamt ${euro(o.total)} · ${service}`,
  ];
  if (o.notes.trim()) lines.push(`Notiz: ${o.notes.trim()}`);
  return lines.join("\n");
}

// Uhrzeit "HH:MM" in Europe/Berlin (DST-sicher via IANA-Zone).
function berlinTime(iso: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(new Date(iso));
}

function callmebotUrl(phone: string, apikey: string, text: string): string {
  return `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(phone)}`
    + `&text=${encodeURIComponent(text)}&apikey=${encodeURIComponent(apikey)}`;
}

Deno.serve(async (req) => {
  const db = createClient(SUPABASE_URL, SERVICE_ROLE);

  // Config lesen; ohne Empfänger/Key oder disabled → nichts tun und NICHT markieren.
  const { data: cfg, error: cfgErr } = await db.from("notify_config").select("*").eq("id", 1).single();
  if (cfgErr) return new Response(`config error: ${cfgErr.message}`, { status: 500 });
  if (!cfg || !cfg.enabled || !cfg.recipient_phone || !cfg.callmebot_apikey) {
    return new Response("skip: disabled/unconfigured");
  }

  // Trigger schickt { order_id }, Cron ruft ohne Payload.
  let orderId: string | null = null;
  try {
    const body = await req.json();
    orderId = typeof body?.order_id === "string" ? body.order_id : null;
  } catch {
    orderId = null;
  }

  let q = db.from("orders").select("*").is("special_notified_at", null).neq("status", "storniert");
  q = orderId
    ? q.eq("id", orderId)
    : q.gte("created_at", new Date(Date.now() - RETRY_WINDOW_MS).toISOString());

  const { data: rows, error } = await q;
  if (error) return new Response(`db error: ${error.message}`, { status: 500 });

  const targets = (rows ?? []).filter((r) =>
    (r.items ?? []).some((it: AlertItem) => it.kind === "special")
  );
  if (targets.length === 0) return new Response("skip: nothing to notify");

  let sent = 0;
  for (const r of targets) {
    const msg = formatSpecialAlert({
      id: r.id, createdTime: berlinTime(r.created_at), customerName: r.customer_name,
      customerPhone: r.customer_phone, items: r.items ?? [], total: Number(r.total),
      serviceMode: r.service_mode, notes: r.notes ?? "",
    });
    let res: Response;
    try {
      res = await fetch(callmebotUrl(cfg.recipient_phone, cfg.callmebot_apikey, msg));
    } catch {
      continue; // nicht markieren -> Sicherheitsnetz holt es nach
    }
    if (!res.ok) continue; // dito
    // Senden, DANN markieren. Ein Claim vor dem Versand würde bei einem Sendefehler
    // die Bestellung als erledigt markieren und genau den Retry verhindern, den wir wollen.
    await db.from("orders").update({ special_notified_at: new Date().toISOString() }).eq("id", r.id);
    sent++;
  }
  return new Response(`sent: ${sent}/${targets.length}`);
});
```

- [ ] **Step 2: Sync-Gate (statt Ausführung)**

Deno-Code ist hier nicht ausführbar. Prüfe manuell Zeile für Zeile, dass `formatSpecialAlert` in `supabase/functions/notify-special-order/index.ts` **zeichengleich** zu `Frontend/src/lib/special-alert.ts` ist (bis auf das fehlende `export`). Abweichungen fallen sonst erst in der Produktion auf, weil nur die Deno-Copy wirklich läuft.

- [ ] **Step 3: Commit**

```bash
cd "C:/Users/Anwender/Desktop/Website/Pizza"
git add supabase/functions/notify-special-order/index.ts
git commit -m "feat(notify): Edge Function notify-special-order (Trigger + Cron-Sicherheitsnetz)"
```

---

### Task 6: Doku, Changelog, TODO

**Files:**
- Modify: `Doku/Pizza/Features/Sonderartikel-VIP.md`
- Modify: `Doku/Pizza/Changelog.md`
- Modify: `Doku/Pizza/TODO.md`

**Interfaces:** keine (Dokumentation).

- [ ] **Step 1: Feature-Doku erweitern**

In `Doku/Pizza/Features/Sonderartikel-VIP.md`:
- Im Abschnitt **Ablauf** nach Punkt 4 ergänzen, dass eine Bestellung ohne jede Pizza kein Datum/keine Uhrzeit verlangt („Abholung sofort") und der Betreiber sofort eine WhatsApp bekommt.
- Im Abschnitt **Technische Umsetzung** ergänzen: `lib/berlin-time.ts`, `lib/special-alert.ts`, Migration `0013` (Spalte `special_notified_at`, `validate_order` ohne Slot-Block bei `pizza_qty = 0`, Trigger `notify_special_order`), Edge Function `notify-special-order`.
- Unter **Fehlerfälle** die Tabelle aus dem Spec-Abschnitt „Fehlerverhalten" übernehmen (CallMeBot down → Cron holt nach; `pg_net`-Fehler → Bestellung bleibt gültig; `app.settings.*` fehlt → still überspringen; `enabled = false` → nicht senden, nicht markieren; storniert → nicht senden).
- Unter **Offene Punkte** den Eintrag zur Sofort-Bestellung entfernen (jetzt umgesetzt) und stattdessen notieren: Doppelzustellung ist bewusst nicht gesperrt; keine Ruhezeit (WhatsApp kann nachts kommen).

- [ ] **Step 2: Changelog-Eintrag**

In `Doku/Pizza/Changelog.md` unter dem bestehenden `## 2026-07-17`-Block als weiteren Stichpunkt ergänzen: „**Sonderartikel: Sofort-Bestellung + Sofort-WhatsApp** — eine Bestellung aus ausschließlich Sonderartikeln braucht kein Abholdatum und keine Uhrzeit mehr (Datum/Zeit = jetzt, Europe/Berlin) und umgeht Vorlaufzeit/Bestelltage/Öffnungszeiten/Service-Verfügbarkeit; Preis- und Zugangsprüfung bleiben unverändert serverautoritativ (Migration `0013`, Slot-Block nur noch bei `pizza_qty > 0`). Jede Bestellung mit mindestens einem Sonderartikel löst binnen Sekunden eine WhatsApp an den Betreiber aus: AFTER-INSERT-Trigger → `pg_net` → neue Edge Function `notify-special-order` → CallMeBot, plus 5-Minuten-Cron als Sicherheitsnetz (Fenster 2 h, Merker `orders.special_notified_at`). Der Trigger schluckt eigene Fehler — eine fehlgeschlagene Benachrichtigung kippt nie die Bestellung. Reine Helfer `berlinDateTime`/`formatSpecialAlert` mit bun:test getestet; die Edge Function spiegelt `formatSpecialAlert` als Deno-Copy. Betreiber: `db push` (0013), `functions deploy notify-special-order`, `app.settings.*` setzen, Cron anlegen."

- [ ] **Step 3: TODO aktualisieren**

In `Doku/Pizza/TODO.md` die Zeile „**Sonderartikel: Sofort-Bestellung + Sofort-WhatsApp**" (P2, offen) auf erledigt setzen — mit Verweis auf Migration `0013` und die Edge Function `notify-special-order`, plus den Betreiber-Schritten.

- [ ] **Step 4: Commit**

```bash
cd "C:/Users/Anwender/Desktop/Website/Pizza"
git add Doku/Pizza/
git commit -m "docs: Sofort-Bestellung + Sofort-WhatsApp dokumentiert"
```

---

## Betreiber-Ausrollung (nach Merge nach `main`, in dieser Reihenfolge)

1. `bunx supabase db push` — spielt `0013` ein (Spalte, `validate_order`, Notify-Trigger).
2. `bunx supabase functions deploy notify-special-order --use-api --project-ref gvszyvgbbsmlulhqiakp`
3. Einstellungen setzen (SQL-Editor, echte Werte einsetzen — **nicht** ins Git):
   ```sql
   alter database postgres set app.settings.notify_url = 'https://<PROJECT>.functions.supabase.co/notify-special-order';
   alter database postgres set app.settings.notify_key = '<SERVICE_ROLE_KEY>';
   ```
   Hinweis: `alter database ... set` greift erst für **neue** Verbindungen.
4. Cron-Sicherheitsnetz anlegen:
   ```sql
   select cron.schedule('special-alert-retry', '*/5 * * * *', $$
     select net.http_post(
       url := 'https://<PROJECT>.functions.supabase.co/notify-special-order',
       headers := jsonb_build_object('Authorization', 'Bearer <SERVICE_ROLE_KEY>')
     );
   $$);
   ```
5. Frontend-Deploy läuft automatisch (Vercel Auto-Deploy auf `main`).
6. Smoke-Test: Freigeschalteter Testkunde legt **nur** einen Sonderartikel in den Warenkorb → Checkout zeigt „Abholung sofort" ohne Datum/Zeit → „Sofort bestellen" geht durch → WhatsApp trifft binnen Sekunden ein → `select id, special_notified_at from orders order by created_at desc limit 1;` zeigt einen Zeitstempel.

## Nicht Teil dieses Plans

- **Ruhezeit** für nächtliche Benachrichtigungen (bewusst YAGNI, siehe Spec).
- **`min_qty:1`-Absicherung** im Admin-UI der Staffeln — eigenes Thema, steht als P3 in der TODO.
