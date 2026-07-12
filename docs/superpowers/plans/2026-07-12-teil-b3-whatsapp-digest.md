# Teil-B3 — Täglicher WhatsApp-Bestell-Digest — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Der Betreiber erhält täglich 18 Uhr (Europe/Berlin) eine WhatsApp mit allen heute abzuholenden Bestellungen; Empfänger + CallMeBot-Key + An/Aus sind in der Admin-Seite editierbar.

**Architecture:** `pg_cron` triggert stündlich eine Edge Function `daily-digest` (Deno), die per Stunden-Gate (DST-sicher) genau um 18 Uhr Berlin die heutigen Abholungen lädt, über eine reine TS-Funktion `formatDigest` formatiert und an CallMeBot schickt. Empfänger/Key liegen in einer admin-only Tabelle `notify_config`. Die reine Formatier-/Filter-Logik lebt in `Frontend/src/lib/digest.ts` und ist mit bun:test getestet; die Edge Function spiegelt sie (Deno-Copy).

**Tech Stack:** Supabase (Postgres/plpgsql, pg_cron, pg_net, Edge Functions/Deno), CallMeBot (HTTP-GET → WhatsApp), Bun, Vite, React 18, TS. Tests: bun:test.

## Global Constraints

- **Umgebung erreicht Supabase/CallMeBot NICHT.** Jeder Task verifiziert NUR `cd Frontend && bun run build` (Typecheck) + `cd Frontend && bun test src` (Tests grün). SQL (Migration), Edge Function und `cron.schedule` werden geschrieben, **NICHT ausgeführt**. Kein Task braucht laufendes Supabase für grün.
- Bun. Build/Test immer aus `Frontend/`.
- **Digest-Zeit:** 18 Uhr **Europe/Berlin**, fest (nicht konfigurierbar). Kein Per-Bestellung-Push.
- **Digest-Inhalt:** alle `orders` mit `pickup_date = heute` (Berlin), sortiert nach `pickup_time`. **0 Bestellungen → kein Versand**, aber `last_digest_date` wird gesetzt.
- **`notify_config`:** admin-only RLS (`is_admin()`), **kein öffentliches Lesen** (API-Key darf nicht an Clients leaken). Edge Function liest per `service_role`.
- **Geldformat:** wie `formatPrice` in `lib/pricing.ts` → `` `${n.toFixed(2).replace(".", ",")} €` `` (z. B. „20,00 €").
- **Referenz-Spec:** `docs/superpowers/specs/2026-07-12-teil-b3-whatsapp-digest-design.md`.
- Doku-Task (Task 6) läuft am Ende; Build muss nach jedem Task grün bleiben. Implementer NICHT Fable.

---

## Dateistruktur (Ziel)

```
Frontend/src/lib/digest.ts                         (N) reine Logik: DigestOrder, filterTodaysPickups, formatDigest
Frontend/src/lib/__tests__/digest.test.ts          (N) bun:test für digest.ts
supabase/migrations/0006_digest.sql                (N) orders +customer_name/+customer_phone; notify_config + RLS
Frontend/src/types/index.ts                        (M) NotifyConfig-Interface
Frontend/src/lib/data/store.ts                     (M) createOrder-Insert + getNotifyConfig/saveNotifyConfig
Frontend/src/pages/admin/notifications-page.tsx    (N) Admin-Abschnitt „Benachrichtigungen"
Frontend/src/router.tsx                            (M) Route /admin/benachrichtigungen
Frontend/src/components/layout/admin-shell.tsx     (M) Nav-Eintrag
supabase/functions/daily-digest/index.ts           (N) Edge Function (Deno)
Doku/Pizza/... , ADR-0003, Changelog/README/TODO   (M) Doku (Task 6)
```

---

### Task 1: Reine Digest-Logik + Tests (`digest.ts`)

**Files:**
- Create: `Frontend/src/lib/digest.ts`
- Test: `Frontend/src/lib/__tests__/digest.test.ts`

**Interfaces:**
- Produces:
  - `interface DigestOrder { pickupDate: string; pickupTime: string; customerName: string; customerPhone: string; items: { pizzaName: string }[]; total: number; serviceMode: "dinein" | "takeaway"; notes: string; }`
  - `filterTodaysPickups(orders: DigestOrder[], todayIso: string): DigestOrder[]` — nur `pickupDate === todayIso`, aufsteigend nach `pickupTime`.
  - `formatDigest(orders: DigestOrder[], dateLabel: string): string` — deutscher Nachrichtentext; leeres Array → `""`.

> Rein & deterministisch (kein `Date`/`Intl`): `dateLabel` und `todayIso` kommen von außen (die Edge Function berechnet sie in Berlin-Zeit). Deshalb hier voll testbar.

- [ ] **Step 1: Failing Tests schreiben** (`Frontend/src/lib/__tests__/digest.test.ts`)

```ts
import { describe, it, expect } from "bun:test";
import { filterTodaysPickups, formatDigest, type DigestOrder } from "@/lib/digest";

const mk = (o: Partial<DigestOrder>): DigestOrder => ({
  pickupDate: "2026-07-12", pickupTime: "17:30", customerName: "Max Mustermann",
  customerPhone: "+49 170 1234567", items: [{ pizzaName: "Margherita" }], total: 10,
  serviceMode: "takeaway", notes: "", ...o,
});

describe("filterTodaysPickups", () => {
  it("behält nur heutige Abholungen und sortiert nach Uhrzeit", () => {
    const orders = [
      mk({ pickupDate: "2026-07-13", pickupTime: "12:00" }),
      mk({ pickupDate: "2026-07-12", pickupTime: "18:00" }),
      mk({ pickupDate: "2026-07-12", pickupTime: "17:30" }),
    ];
    const out = filterTodaysPickups(orders, "2026-07-12");
    expect(out.map((o) => o.pickupTime)).toEqual(["17:30", "18:00"]);
  });
  it("leeres Ergebnis wenn nichts für heute", () => {
    expect(filterTodaysPickups([mk({ pickupDate: "2026-07-13" })], "2026-07-12")).toEqual([]);
  });
});

describe("formatDigest", () => {
  it("leeres Array → leerer String (Signal: nicht senden)", () => {
    expect(formatDigest([], "Sa 12.07.")).toBe("");
  });
  it("Kopf mit Anzahl (Plural) und Summe", () => {
    const msg = formatDigest([mk({ total: 20 }), mk({ total: 10, pickupTime: "18:00" })], "Sa 12.07.");
    expect(msg).toContain("🍕 Abholungen heute, Sa 12.07.");
    expect(msg).toContain("2 Bestellungen · gesamt 30,00 €");
  });
  it("Einzahl bei genau einer Bestellung / einer Pizza", () => {
    const msg = formatDigest([mk({})], "Sa 12.07.");
    expect(msg).toContain("1 Bestellung · gesamt 10,00 €");
    expect(msg).toContain("1 Pizza · 10,00 € · Abholen");
  });
  it("Bestellblock: Zeit·Name·Telefon, Pizzenliste, Service-Label", () => {
    const msg = formatDigest([mk({
      pickupTime: "18:00", customerName: "Lisa Meyer", customerPhone: "+49 151 2345678",
      items: [{ pizzaName: "Funghi" }, { pizzaName: "Salami" }], total: 20, serviceMode: "dinein",
    })], "Sa 12.07.");
    expect(msg).toContain("18:00 · Lisa Meyer · +49 151 2345678");
    expect(msg).toContain("2 Pizzen · 20,00 € · Vor Ort");
    expect(msg).toContain("• Funghi");
    expect(msg).toContain("• Salami");
  });
  it("Notiz nur wenn vorhanden", () => {
    expect(formatDigest([mk({ notes: "extra scharf" })], "Sa 12.07.")).toContain("Notiz: extra scharf");
    expect(formatDigest([mk({ notes: "" })], "Sa 12.07.")).not.toContain("Notiz:");
  });
});
```

- [ ] **Step 2: Tests laufen lassen → FAIL**

Run: `cd Frontend && bun test src/lib/__tests__/digest.test.ts`
Expected: FAIL („Cannot find module '@/lib/digest'" bzw. Export fehlt).

- [ ] **Step 3: `digest.ts` implementieren** (`Frontend/src/lib/digest.ts`)

```ts
// Reine Digest-Logik (Teil-B3). Deterministisch: dateLabel/todayIso kommen von außen,
// damit hier ohne Date/Intl (und damit voll testbar). Die Edge Function spiegelt formatDigest (Deno-Copy).

export interface DigestOrder {
  pickupDate: string;   // "YYYY-MM-DD"
  pickupTime: string;   // "HH:MM"
  customerName: string;
  customerPhone: string;
  items: { pizzaName: string }[];
  total: number;
  serviceMode: "dinein" | "takeaway";
  notes: string;
}

// Geldformat gespiegelt von lib/pricing.ts formatPrice (digest.ts bleibt standalone für die Deno-Copy).
function euro(n: number): string {
  return `${n.toFixed(2).replace(".", ",")} €`;
}

export function filterTodaysPickups(orders: DigestOrder[], todayIso: string): DigestOrder[] {
  return orders
    .filter((o) => o.pickupDate === todayIso)
    .sort((a, b) => a.pickupTime.localeCompare(b.pickupTime));
}

export function formatDigest(orders: DigestOrder[], dateLabel: string): string {
  if (orders.length === 0) return "";
  const sum = orders.reduce((s, o) => s + o.total, 0);
  const countLabel = `${orders.length} ${orders.length === 1 ? "Bestellung" : "Bestellungen"}`;
  const header = `🍕 Abholungen heute, ${dateLabel}\n${countLabel} · gesamt ${euro(sum)}`;

  const blocks = orders.map((o) => {
    const pizzaCount = o.items.length;
    const pizzaLabel = `${pizzaCount} ${pizzaCount === 1 ? "Pizza" : "Pizzen"}`;
    const service = o.serviceMode === "dinein" ? "Vor Ort" : "Abholen";
    const lines = [
      `${o.pickupTime} · ${o.customerName} · ${o.customerPhone}`,
      `  ${pizzaLabel} · ${euro(o.total)} · ${service}`,
      ...o.items.map((it) => `  • ${it.pizzaName}`),
    ];
    if (o.notes.trim()) lines.push(`  Notiz: ${o.notes.trim()}`);
    return lines.join("\n");
  });

  return `${header}\n\n${blocks.join("\n\n")}`;
}
```

- [ ] **Step 4: Tests laufen lassen → PASS**

Run: `cd Frontend && bun test src/lib/__tests__/digest.test.ts`
Expected: alle grün.

- [ ] **Step 5: Voller Build + Suite grün**

Run: `cd Frontend && bun run build && bun test src`
Expected: Build grün; alle Tests grün.

- [ ] **Step 6: Commit**

```bash
git add Frontend/src/lib/digest.ts Frontend/src/lib/__tests__/digest.test.ts
git commit -m "feat(b3): reine Digest-Logik (formatDigest/filterTodaysPickups) mit Tests"
```

---

### Task 2: Migration `0006_digest.sql`

**Files:**
- Create: `supabase/migrations/0006_digest.sql`

> Reines SQL; berührt den Frontend-Build nicht. Nicht hier ausführbar — Review = SQL-Korrektheit + RLS.

- [ ] **Step 1: Migration schreiben** (`supabase/migrations/0006_digest.sql`)

```sql
-- Teil-B3: Kundendaten in orders (für Digest) + admin-only notify_config.

-- 1) Kundendaten in orders (bisher nicht gespeichert). Default '' hält Bestandszeilen gültig.
alter table public.orders add column if not exists customer_name  text not null default '';
alter table public.orders add column if not exists customer_phone text not null default '';

-- 2) Benachrichtigungs-Config (Single-Row). API-Key NICHT öffentlich lesbar.
create table if not exists public.notify_config (
  id                int primary key default 1 check (id = 1),
  recipient_phone   text not null default '',
  callmebot_apikey  text not null default '',
  enabled           boolean not null default false,
  last_digest_date  date
);
insert into public.notify_config (id) values (1) on conflict do nothing;

alter table public.notify_config enable row level security;
drop policy if exists notify_admin_all on public.notify_config;
create policy notify_admin_all on public.notify_config
  for all using (public.is_admin()) with check (public.is_admin());
```

- [ ] **Step 2: Build → grün** (Sanity — SQL berührt den Build nicht)

Run: `cd Frontend && bun run build`
Expected: unverändert grün.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0006_digest.sql
git commit -m "feat(b3): Migration 0006 — orders-Kundendaten + notify_config (admin-only RLS)"
```

---

### Task 3: Store — Insert-Erweiterung + notify-config-Funktionen

**Files:**
- Modify: `Frontend/src/types/index.ts`
- Modify: `Frontend/src/lib/data/store.ts`

**Interfaces:**
- Consumes: `Customer` (`{ firstName; lastName; phone }`), `supabase`.
- Produces:
  - `interface NotifyConfig { recipientPhone: string; callmebotApikey: string; enabled: boolean; }`
  - `getNotifyConfig(): Promise<NotifyConfig>`
  - `saveNotifyConfig(cfg: NotifyConfig): Promise<void>`

- [ ] **Step 1: `NotifyConfig`-Typ ergänzen** (`Frontend/src/types/index.ts`, ans Ende anfügen)

```ts
export interface NotifyConfig {
  recipientPhone: string;
  callmebotApikey: string;
  enabled: boolean;
}
```

- [ ] **Step 2: createOrder-Insert um Kundendaten erweitern** (`Frontend/src/lib/data/store.ts`)

Im `supabase.from("orders").insert({ ... })`-Objekt in `createOrder` die zwei Felder ergänzen (die restlichen Felder bleiben unverändert):

```ts
  const { error } = await supabase.from("orders").insert({
    id: order.id, user_id: sess.user?.id ?? null, items: order.items,
    subtotal: order.subtotal, discount: order.discount, total: order.total,
    free_ingredient: order.freeIngredient ?? null, service_mode: order.serviceMode,
    pickup_date: order.pickupDate, pickup_time: order.pickupTime, notes: order.notes,
    voucher_code: order.voucherCode ?? null, status: "eingegangen",
    customer_name: `${input.customer.firstName} ${input.customer.lastName}`.trim(),
    customer_phone: input.customer.phone,
  });
```

- [ ] **Step 3: `NotifyConfig` importieren + Store-Funktionen anhängen** (`Frontend/src/lib/data/store.ts`)

Den Typ-Import (Zeile 1) um `NotifyConfig` erweitern:

```ts
import type { AppConfig, IngredientItem, NewOrder, NotifyConfig, OrderData, OrderRow, OrderStatus, PizzaTemplate, VoucherDef, Sauce, User } from "@/types";
```

Am Dateiende die Funktionen ergänzen (RLS lässt nur Admins zu; die Funktionen setzen das nicht durch — die DB tut es):

```ts
// ── Benachrichtigungs-Config (B3, nur Admins per RLS) ──
export async function getNotifyConfig(): Promise<NotifyConfig> {
  const { data, error } = await supabase.from("notify_config").select("*").eq("id", 1).single();
  if (error) throw error;
  return { recipientPhone: data.recipient_phone, callmebotApikey: data.callmebot_apikey, enabled: data.enabled };
}
export async function saveNotifyConfig(cfg: NotifyConfig): Promise<void> {
  const { error } = await supabase.from("notify_config").upsert({
    id: 1, recipient_phone: cfg.recipientPhone, callmebot_apikey: cfg.callmebotApikey, enabled: cfg.enabled,
  });
  if (error) throw error;
}
```

> `last_digest_date` wird bewusst NICHT geschrieben (server-verwaltet durch die Edge Function). Der Upsert lässt die Spalte unangetastet.

- [ ] **Step 4: Build + Suite grün**

Run: `cd Frontend && bun run build && bun test src`
Expected: Build grün; Tests unverändert grün.

- [ ] **Step 5: Commit**

```bash
git add Frontend/src/types/index.ts Frontend/src/lib/data/store.ts
git commit -m "feat(b3): orders-Insert mit Kundendaten + get/saveNotifyConfig"
```

---

### Task 4: Admin-Seite „Benachrichtigungen"

**Files:**
- Create: `Frontend/src/pages/admin/notifications-page.tsx`
- Modify: `Frontend/src/router.tsx`
- Modify: `Frontend/src/components/layout/admin-shell.tsx`

**Interfaces:**
- Consumes: `getNotifyConfig`, `saveNotifyConfig`, `NotifyConfig` (Task 3); `useAsync`; `AsyncBoundary`; `Button`, `Input`, `Switch`, `Card`, `CardContent`, `Separator`.

> Muster wie die anderen Admin-Config-Seiten (laden → lokale Kopie → speichern mit „Gespeichert"-Flash), hier inline mit eigenem State (nicht `useConfigEditor`, da das an `AppConfig` hängt).

- [ ] **Step 1: Seite schreiben** (`Frontend/src/pages/admin/notifications-page.tsx`)

```tsx
import type React from "react";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { getNotifyConfig, saveNotifyConfig } from "@/lib/data/store";
import { useAsync } from "@/hooks/use-async";
import type { NotifyConfig } from "@/types";
import { AsyncBoundary } from "@/components/common/async-boundary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";

// Admin: WhatsApp-Digest-Empfänger (Teil-B3). Nummer + CallMeBot-API-Key + An/Aus; persistiert via saveNotifyConfig.
export default function NotificationsPage(): React.ReactElement {
  const { data, loading, error } = useAsync(getNotifyConfig);
  const [cfg, setCfg] = useState<NotifyConfig | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => { if (data) setCfg(data); }, [data]);

  const save = async () => {
    if (!cfg) return;
    await saveNotifyConfig(cfg);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  return (
    <div className="p-4 space-y-4">
      <div>
        <h2 className="font-bold text-lg">Benachrichtigungen</h2>
        <p className="text-sm text-muted-foreground mt-1">Täglich 18 Uhr eine WhatsApp mit allen heutigen Abholungen. Empfänger muss sich einmalig bei CallMeBot registrieren (liefert den API-Key).</p>
      </div>
      <AsyncBoundary loading={loading} error={error} data={cfg}>
        {(c: NotifyConfig) => (
          <>
            <Card>
              <CardContent className="py-0">
                <div className="flex items-center justify-between py-4">
                  <div>
                    <p className="font-semibold text-sm">Digest aktiv</p>
                    <p className={"text-xs mt-0.5 " + (c.enabled ? "text-green-400" : "text-muted-foreground")}>{c.enabled ? "Wird gesendet" : "Pausiert"}</p>
                  </div>
                  <Switch checked={c.enabled} onCheckedChange={(v) => setCfg({ ...c, enabled: v })} />
                </div>
                <Separator />
                <div className="space-y-1.5 py-4">
                  <Label htmlFor="phone">Empfänger-Nummer (WhatsApp)</Label>
                  <Input id="phone" type="tel" placeholder="+49170..." value={c.recipientPhone}
                    onChange={(e) => setCfg({ ...c, recipientPhone: e.target.value })} />
                </div>
                <Separator />
                <div className="space-y-1.5 py-4">
                  <Label htmlFor="key">CallMeBot API-Key</Label>
                  <Input id="key" value={c.callmebotApikey}
                    onChange={(e) => setCfg({ ...c, callmebotApikey: e.target.value })} />
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

- [ ] **Step 2: Route registrieren** (`Frontend/src/router.tsx`)

Import bei den anderen Admin-Page-Imports ergänzen (nahe `import ServicePage ...`):

```tsx
import NotificationsPage from "@/pages/admin/notifications-page";
```

Und in den Admin-`children` (nach der `nutzer`-Zeile) einfügen:

```tsx
      { path: "benachrichtigungen", element: <NotificationsPage /> },
```

- [ ] **Step 3: Nav-Eintrag** (`Frontend/src/components/layout/admin-shell.tsx`)

`MessageSquare` in den lucide-Import aufnehmen:

```tsx
import { BarChart2, Calendar, Clock, Timer, Package, Droplet, Tag, Users, ChefHat, LogOut, Store, User, ClipboardList, MessageSquare } from "lucide-react";
```

Und ans Ende des `NAV`-Arrays (nach `nutzer`) einfügen:

```tsx
  { to: "/admin/benachrichtigungen", icon: MessageSquare, label: "Benachrichtigungen" },
```

- [ ] **Step 4: Build + Suite grün**

Run: `cd Frontend && bun run build && bun test src`
Expected: Build grün; Tests unverändert grün.

- [ ] **Step 5: Commit**

```bash
git add Frontend/src/pages/admin/notifications-page.tsx Frontend/src/router.tsx Frontend/src/components/layout/admin-shell.tsx
git commit -m "feat(b3): Admin-Seite Benachrichtigungen (Empfänger/API-Key/An-Aus)"
```

---

### Task 5: Edge Function `daily-digest`

**Files:**
- Create: `supabase/functions/daily-digest/index.ts`

> Deno; berührt den Frontend-Build nicht, hier nicht ausführbar. Review = Logik (Stunden-Gate/DST, Idempotenz, 0-Bestellungen, CallMeBot-Aufruf). Die `formatDigest`-Logik ist eine Deno-Copy der getesteten `digest.ts` — bei Änderungen dort synchron halten.

- [ ] **Step 1: Function schreiben** (`supabase/functions/daily-digest/index.ts`)

```ts
// Supabase Edge Function (Teil-B3): täglicher WhatsApp-Digest via CallMeBot.
// Von pg_cron stündlich getriggert; sendet nur um 18 Uhr Europe/Berlin.
// formatDigest ist eine Copy von Frontend/src/lib/digest.ts (dort getestet) — synchron halten.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface DigestOrder {
  pickupTime: string; customerName: string; customerPhone: string;
  items: { pizzaName: string }[]; total: number;
  serviceMode: "dinein" | "takeaway"; notes: string;
}

function euro(n: number): string {
  return `${n.toFixed(2).replace(".", ",")} €`;
}

function formatDigest(orders: DigestOrder[], dateLabel: string): string {
  if (orders.length === 0) return "";
  const sum = orders.reduce((s, o) => s + o.total, 0);
  const countLabel = `${orders.length} ${orders.length === 1 ? "Bestellung" : "Bestellungen"}`;
  const header = `🍕 Abholungen heute, ${dateLabel}\n${countLabel} · gesamt ${euro(sum)}`;
  const blocks = orders.map((o) => {
    const pc = o.items.length;
    const pizzaLabel = `${pc} ${pc === 1 ? "Pizza" : "Pizzen"}`;
    const service = o.serviceMode === "dinein" ? "Vor Ort" : "Abholen";
    const lines = [
      `${o.pickupTime} · ${o.customerName} · ${o.customerPhone}`,
      `  ${pizzaLabel} · ${euro(o.total)} · ${service}`,
      ...o.items.map((it) => `  • ${it.pizzaName}`),
    ];
    if (o.notes.trim()) lines.push(`  Notiz: ${o.notes.trim()}`);
    return lines.join("\n");
  });
  return `${header}\n\n${blocks.join("\n\n")}`;
}

// Berlin-Datum/Stunde/Label aus "jetzt" ableiten (DST-sicher via IANA-Zeitzone).
function berlinNow(now: Date): { todayIso: string; hour: number; dateLabel: string } {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", hour12: false,
    }).formatToParts(now).map((x) => [x.type, x.value]),
  );
  const wd = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", weekday: "short" }).format(now);
  return {
    todayIso: `${p.year}-${p.month}-${p.day}`,
    hour: parseInt(p.hour, 10),
    dateLabel: `${wd} ${p.day}.${p.month}.`,
  };
}

Deno.serve(async () => {
  const db = createClient(SUPABASE_URL, SERVICE_ROLE);

  // 1) Config lesen; ohne Empfänger/Key oder disabled → nichts tun.
  const { data: cfg, error: cfgErr } = await db.from("notify_config").select("*").eq("id", 1).single();
  if (cfgErr) return new Response(`config error: ${cfgErr.message}`, { status: 500 });
  if (!cfg || !cfg.enabled || !cfg.recipient_phone || !cfg.callmebot_apikey) {
    return new Response("skip: disabled/unconfigured");
  }

  // 2) Stunden-Gate (nur 18 Uhr Berlin).
  const { todayIso, hour, dateLabel } = berlinNow(new Date());
  if (hour !== 18) return new Response("skip: not 18:00 Berlin");

  // 3) Idempotenz: heute schon gesendet?
  if (cfg.last_digest_date === todayIso) return new Response("skip: already sent today");

  // 4) Heutige Abholungen laden.
  const { data: rows, error } = await db.from("orders").select("*").eq("pickup_date", todayIso);
  if (error) return new Response(`db error: ${error.message}`, { status: 500 });

  const orders: DigestOrder[] = (rows ?? [])
    .map((r) => ({
      pickupTime: r.pickup_time, customerName: r.customer_name, customerPhone: r.customer_phone,
      items: r.items ?? [], total: Number(r.total),
      serviceMode: r.service_mode, notes: r.notes ?? "",
    }))
    .sort((a, b) => a.pickupTime.localeCompare(b.pickupTime));

  // 5) 0 Bestellungen → nicht senden, aber Datum markieren (kein Retry).
  if (orders.length === 0) {
    await db.from("notify_config").update({ last_digest_date: todayIso }).eq("id", 1);
    return new Response("skip: no pickups today");
  }

  // 6) Senden. Bei CallMeBot-Fehler last_digest_date NICHT setzen → nächster Lauf (bis 18:59) versucht erneut.
  const message = formatDigest(orders, dateLabel);
  const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(cfg.recipient_phone)}`
    + `&text=${encodeURIComponent(message)}&apikey=${encodeURIComponent(cfg.callmebot_apikey)}`;
  let res: Response;
  try {
    res = await fetch(url);
  } catch (e) {
    return new Response(`callmebot fetch failed: ${e}`, { status: 502 });
  }
  if (!res.ok) return new Response(`callmebot error: ${res.status}`, { status: 502 });

  const { error: markErr } = await db.from("notify_config").update({ last_digest_date: todayIso }).eq("id", 1);
  if (markErr) return new Response(`sent but mark failed: ${markErr.message}`, { status: 500 });
  return new Response(`sent: ${orders.length} Bestellungen`);
});
```

- [ ] **Step 2: Build → grün** (Sanity — Edge Function berührt den Build nicht)

Run: `cd Frontend && bun run build`
Expected: unverändert grün.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/daily-digest/index.ts
git commit -m "feat(b3): Edge Function daily-digest (18-Uhr-Gate, Idempotenz, CallMeBot)"
```

---

### Task 6: Doku & Verifikation

**Files:**
- Modify: `Doku/Pizza/SETUP-Supabase.md`, `Doku/Pizza/Entscheidungen/ADR-0003-whatsapp-callmebot.md`, `Doku/Pizza/Changelog.md`, `Doku/Pizza/TODO.md`, `Frontend/README.md`

> Doku wird gebündelt am Ende gemacht (siehe SDD-Ledger). Dieser Task fasst den B3-Doku-Teil.

- [ ] **Step 1: Gesamt-Verifikation**

Run: `cd Frontend && bun run build && bun test src`
Expected: Build grün; alle Tests grün.

- [ ] **Step 2: ADR-0003 umschreiben**

`Doku/Pizza/Entscheidungen/ADR-0003-whatsapp-callmebot.md`: von „Push pro Bestellung" auf **täglichen 18-Uhr-Digest** ändern. Problem/Entscheidung/Auswirkungen anpassen: CallMeBot bleibt, aber aufgerufen aus Edge Function `daily-digest` (von pg_cron stündlich getriggert, Stunden-Gate 18 Uhr Berlin), Empfänger/Key in `notify_config` (admin-editierbar), nicht mehr beim Insert. Ein Satz zum Warum (weniger Nachrichten, Betreiber wollte 18-Uhr-Sammelnachricht).

- [ ] **Step 3: SETUP — Migration 0006, Extensions, cron.schedule**

`Doku/Pizza/SETUP-Supabase.md`: ergänzen:
1. `0006_digest.sql` in die Migrations-Liste (nach 0005).
2. Extensions aktivieren: `pg_cron`, `pg_net`.
3. Edge Function `daily-digest` deployen; Env `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` sind Standard.
4. Cron-Job anlegen (Platzhalter `<PROJECT>`/`<SERVICE_ROLE_KEY>` durch echte Werte ersetzen):

```sql
select cron.schedule('daily-digest-hourly', '0 * * * *', $$
  select net.http_post(
    url := 'https://<PROJECT>.functions.supabase.co/daily-digest',
    headers := jsonb_build_object('Authorization', 'Bearer <SERVICE_ROLE_KEY>')
  );
$$);
```
5. CallMeBot: Empfänger registriert sich einmalig (WhatsApp an CallMeBot-Nummer → API-Key), dann Nummer + Key in Admin → Benachrichtigungen eintragen und „Digest aktiv" einschalten.

- [ ] **Step 4: Changelog + README + TODO**

`Doku/Pizza/Changelog.md` (oben, 2026-07-12): „Teil-B3: täglicher WhatsApp-Digest — pg_cron→Edge Function `daily-digest` schickt 18 Uhr (Berlin) alle heutigen Abholungen an CallMeBot; Empfänger/Key/An-Aus admin-editierbar (`notify_config`, admin-only RLS); Kundendaten (Name/Telefon) neu in `orders` (Migration 0006). Reine Logik (`formatDigest`) getestet; Edge/Migration/cron führt der Betreiber aus."
`Frontend/README.md`: Supabase-Abschnitt um „Täglicher Bestell-Digest (Edge Function `daily-digest`, Migration 0006, Admin → Benachrichtigungen)" ergänzen.
`Doku/Pizza/TODO.md`: „Teil-B3 (WhatsApp-Digest) — erledigt"; Betreiber-Setup-Punkt um „Migration 0006, Extensions pg_cron/pg_net, Edge Function daily-digest deployen, cron.schedule, CallMeBot-Empfänger in Admin eintragen" ergänzen.

- [ ] **Step 5: Commit**

```bash
git add Doku/ Frontend/README.md
git commit -m "docs(b3): ADR-0003 (Digest), SETUP (0006/cron), Changelog/README/TODO"
```

---

## Self-Review (durchgeführt)

- **Spec-Abdeckung:** reine Logik `formatDigest`/`filterTodaysPickups` + Tests → T1; Migration (orders-Kundendaten + `notify_config` + admin-only RLS) → T2; Store-Insert + `getNotifyConfig`/`saveNotifyConfig` + `NotifyConfig`-Typ → T3; Admin-Maske (Empfänger/Key/An-Aus) + Route + Nav → T4; Edge Function (Stunden-Gate/DST, Idempotenz `last_digest_date`, 0-Bestellungen kein Versand, CallMeBot-GET, Fehler→kein Datum-Set) → T5; ADR-0003/SETUP/cron/Changelog/README/TODO → T6. Nicht-Ziele (keine konfigurierbare Zeit, kein Per-Bestellung-Push, keine Flow-/Preis-Änderung) eingehalten.
- **Grün ohne Supabase:** T1 rein testbar; T2/T5 (SQL/Deno) berühren den Vite-Build nicht; T3/T4 verifizieren `bun run build` + Tests; T6 nur Doku + Verifikation.
- **Typ-Konsistenz:** `NotifyConfig` (camelCase) in T3 definiert, in T3/T4 identisch genutzt; DB-Spalten `recipient_phone/callmebot_apikey/enabled/last_digest_date` in T2 angelegt und in T3-Store + T5-Edge identisch referenziert; `DigestOrder`-Felder in T1 definiert und in T5 (Deno-Copy) feldgleich gemappt; Geldformat `euro()` = `formatPrice`-Spiegel in T1 und T5 identisch.
- **Platzhalter:** nur in der SETUP-Cron-Vorlage (`<PROJECT>`/`<SERVICE_ROLE_KEY>`) — bewusst, weil betreiberspezifisch; im Code keine.
- **Bekannte Duplizierung (bewusst):** `formatDigest`/`euro` existieren doppelt (getestete `digest.ts` + Deno-Copy in der Edge Function), weil Deno den `@/`-Alias-Graphen nicht importieren kann. Kommentar in beiden Dateien mahnt Synchronhaltung an.
