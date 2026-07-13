# QR-Bestell-Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein echter, scanbarer QR-Code auf der Bestätigungsseite verlinkt auf eine öffentliche (ohne Login erreichbare) Bestell-Status-Seite, die nur freigegebene Felder zeigt.

**Architecture:** Neue Spalte `orders.public_token uuid` + SECURITY-DEFINER-RPC `get_order_status(token)`, die RLS kontrolliert umgeht und nur Whitelist-Felder (inkl. `labels`-Map für Zutaten-/Soßennamen) zurückgibt. Frontend: echter QR (`qrcode.react`), öffentliche Route `/bestellung/:token` außerhalb der Auth-Layouts, Status-Seite mit Auto-Refresh alle 20 s.

**Tech Stack:** TypeScript/React 18, Vite, react-router 7, Supabase (Postgres + RPC), Tailwind, `qrcode.react`, Tests via `bun:test`. Package-Manager: **Bun**.

## Global Constraints

- Package-Manager ist **Bun** (`bun add`, `bun run`, `bun test`) — kein npm/yarn.
- Tests laufen mit `bun:test` (`import { describe, it, expect } from "bun:test"`), Dateien unter `src/**/__tests__/*.test.ts`.
- **Öffentlich sichtbare Felder (Whitelist):** Bestellnummer, Status, `pickup_date`, `pickup_time`, `service_mode`, `items`, `total`, `created_at`, `labels`. **NIE** öffentlich: Name, Telefon, `notes`, `voucher_code`, `user_id`.
- `orders.id` ist `text` und **ratbar** → öffentliche Seite ausschließlich über `public_token` (uuid), nie über `id`.
- Diese Dev-Umgebung erreicht Supabase **nicht** — die Migration `0010` führt der Betreiber via `bunx supabase db push` aus. SQL wird daher per sorgfältigem Review verifiziert, nicht lokal ausgeführt.
- Doku-Grundregel (CLAUDE.md): implementierte Funktion muss dokumentiert werden.
- Bestehende Muster folgen: `security definer stable set search_path = public` (wie `is_admin`); Grants analog `0009_grants.sql`; snake_case in DB → camelCase im Mapper.

---

### Task 1: Migration `0010_public_token.sql` (DB-Schema + RPC)

**Files:**
- Create: `supabase/migrations/0010_public_token.sql`

**Interfaces:**
- Produces: Spalte `orders.public_token uuid` (unique); RPC `public.get_order_status(p_token uuid)` → Tabelle `(id text, status text, pickup_date text, pickup_time text, service_mode text, items jsonb, total numeric, created_at timestamptz, labels jsonb)`, ausführbar für `anon` + `authenticated`.

> **Hinweis:** Kein lokaler Testlauf möglich (kein DB-Zugriff). Verifikation = sorgfältiges SQL-Review in Schritt 2. Angewendet wird die Migration vom Betreiber (Task 7 dokumentiert das).

- [ ] **Step 1: Migration schreiben**

Create `supabase/migrations/0010_public_token.sql`:

```sql
-- QR-Bestell-Status: nicht-ratbarer Token + öffentliche, feld-begrenzte Lese-RPC.

-- 1) Token-Spalte. Default deckt auch bestehende Bestellungen ab.
alter table public.orders
  add column if not exists public_token uuid not null default gen_random_uuid();
create unique index if not exists orders_public_token_idx on public.orders(public_token);

-- 2) Öffentliche Status-RPC. SECURITY DEFINER umgeht RLS kontrolliert und gibt NUR
--    Whitelist-Felder zurück (kein Name/Telefon/notes/voucher_code/user_id).
--    labels = { ingredientId|sauceId -> Name }, nur für die in DIESER Bestellung
--    vorkommenden Zutaten/Soßen (öffnet NICHT die ganze Speisekarte für anon).
create or replace function public.get_order_status(p_token uuid)
returns table (
  id text, status text, pickup_date text, pickup_time text,
  service_mode text, items jsonb, total numeric, created_at timestamptz, labels jsonb
)
language sql security definer stable set search_path = public as $$
  with o as (
    select * from public.orders where public_token = p_token
  ),
  ing_ids as (
    select distinct ing.value as id
    from o,
         jsonb_array_elements(o.items) it,
         jsonb_array_elements_text(it->'ingredientIds') ing(value)
  ),
  sauce_ids as (
    select distinct (it->>'sauceId') as id
    from o, jsonb_array_elements(o.items) it
    where it->>'sauceId' is not null
  ),
  lbl as (
    select i.id, i.name from public.ingredients i where i.id in (select id from ing_ids)
    union
    select s.id, s.name from public.sauces s where s.id in (select id from sauce_ids)
  )
  select o.id, o.status, o.pickup_date, o.pickup_time,
         o.service_mode, o.items, o.total, o.created_at,
         coalesce((select jsonb_object_agg(lbl.id, lbl.name) from lbl), '{}'::jsonb) as labels
  from o;
$$;

-- 3) Ausführung für anonyme (nicht eingeloggte) Besucher + Eingeloggte freigeben.
grant execute on function public.get_order_status(uuid) to anon, authenticated;
```

- [ ] **Step 2: SQL-Review (statt Testlauf)**

Prüfe Punkt für Punkt:
- Spalte ist `not null default gen_random_uuid()` → bestehende Zeilen bekommen automatisch ein Token. ✅
- RPC-Rückgabe enthält **keine** verbotenen Felder (kein `notes`, `voucher_code`, `user_id`, Name, Telefon). ✅
- `jsonb_array_elements_text(it->'ingredientIds')` löst das verschachtelte String-Array je Item korrekt auf; `it->>'sauceId'` liefert Text oder wird per `is not null` gefiltert. ✅
- `security definer stable set search_path = public` gesetzt (Muster wie `is_admin`). ✅
- `grant execute … to anon, authenticated` vorhanden. ✅

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0010_public_token.sql
git commit -m "feat(db): Migration 0010 public_token + get_order_status-RPC (öffentlicher Bestell-Status)"
```

---

### Task 2: Typen + reine Helfer (`public-order.ts`)

**Files:**
- Modify: `Frontend/src/types/index.ts` (OrderData erweitern, PublicOrderStatus ergänzen)
- Create: `Frontend/src/lib/public-order.ts`
- Test: `Frontend/src/lib/__tests__/public-order.test.ts`

**Interfaces:**
- Consumes: `CartItem`, `OrderStatus`, `ServiceMode` aus `@/types`.
- Produces:
  - `OrderData.publicToken: string` (neues Pflichtfeld)
  - `interface PublicOrderStatus { id, status, pickupDate, pickupTime, serviceMode, items, total, createdAt, labels }`
  - `describeItem(item: CartItem, labels: Record<string,string>): string`
  - `rowToPublicStatus(row: any): PublicOrderStatus`

- [ ] **Step 1: Typen ergänzen**

In `Frontend/src/types/index.ts` das Interface `OrderData` um `publicToken` erweitern (nach `id`):

```ts
export interface OrderData {
  id: string;
  publicToken: string;
  items: CartItem[];
  subtotal: number;
  total: number;
  discount: number;
  freeIngredient?: string;
  customer: Customer;
  pickupDate: string;
  pickupTime: string;
  notes: string;
  voucherCode?: string;
  serviceMode: ServiceMode;
}
```

Und direkt nach dem `OrderRow`-Interface neu einfügen:

```ts
export interface PublicOrderStatus {
  id: string;
  status: OrderStatus;
  pickupDate: string;
  pickupTime: string;
  serviceMode: ServiceMode;
  items: CartItem[];
  total: number;
  createdAt: string;
  labels: Record<string, string>; // ingredientId|sauceId -> Name
}
```

- [ ] **Step 2: Failing test schreiben**

Create `Frontend/src/lib/__tests__/public-order.test.ts`:

```ts
import { describe, it, expect } from "bun:test";
import { describeItem, rowToPublicStatus } from "@/lib/public-order";
import type { CartItem } from "@/types";

const labels = { tomate: "Tomatensauce", salami: "Salami", champ: "Champignons" };

describe("describeItem", () => {
  it("verbindet Soße + Zutaten in Reihenfolge", () => {
    const item: CartItem = { cartId: "c1", pizzaName: "Salami", ingredientIds: ["salami", "champ"], sauceId: "tomate" };
    expect(describeItem(item, labels)).toBe("Tomatensauce, Salami, Champignons");
  });
  it("überspringt fehlende Labels", () => {
    const item: CartItem = { cartId: "c2", pizzaName: "X", ingredientIds: ["salami", "unbekannt"], sauceId: undefined };
    expect(describeItem(item, labels)).toBe("Salami");
  });
  it("leere Zutaten/keine Soße → Fallback", () => {
    const item: CartItem = { cartId: "c3", pizzaName: "Margherita", ingredientIds: [], sauceId: undefined };
    expect(describeItem(item, labels)).toBe("Käse & Sauce");
  });
});

describe("rowToPublicStatus", () => {
  it("mappt snake_case → camelCase und setzt Defaults", () => {
    const row = {
      id: "#42", status: "in_arbeit", pickup_date: "2026-07-14", pickup_time: "18:00",
      service_mode: "takeaway", items: [{ cartId: "c1", pizzaName: "Salami", ingredientIds: ["salami"], sauceId: "tomate" }],
      total: "20", created_at: "2026-07-13T10:00:00Z", labels: { salami: "Salami" },
    };
    const s = rowToPublicStatus(row);
    expect(s.id).toBe("#42");
    expect(s.status).toBe("in_arbeit");
    expect(s.pickupDate).toBe("2026-07-14");
    expect(s.serviceMode).toBe("takeaway");
    expect(s.total).toBe(20);
    expect(s.labels).toEqual({ salami: "Salami" });
    expect(s.items).toHaveLength(1);
  });
  it("fehlende items/labels → leere Defaults", () => {
    const s = rowToPublicStatus({ id: "#1", status: "eingegangen", pickup_date: "x", pickup_time: "y", service_mode: "takeaway", total: 0, created_at: "z" });
    expect(s.items).toEqual([]);
    expect(s.labels).toEqual({});
  });
});
```

- [ ] **Step 3: Test laufen lassen — muss fehlschlagen**

Run: `cd Frontend && bun test src/lib/__tests__/public-order.test.ts`
Expected: FAIL („Cannot find module '@/lib/public-order'" bzw. Export fehlt).

- [ ] **Step 4: Helfer implementieren**

Create `Frontend/src/lib/public-order.ts`:

```ts
import type { CartItem, PublicOrderStatus } from "@/types";

// Zutaten-/Soßennamen einer Bestellposition auflösen (Reihenfolge: Soße, dann Zutaten).
// labels = Map id->Name (aus der get_order_status-RPC). Fehlende Labels werden übersprungen.
export function describeItem(item: CartItem, labels: Record<string, string>): string {
  const parts = [
    item.sauceId ? labels[item.sauceId] : undefined,
    ...item.ingredientIds.map((id) => labels[id]),
  ].filter(Boolean);
  return parts.join(", ") || "Käse & Sauce";
}

// RPC-Row (snake_case) → PublicOrderStatus (camelCase).
export function rowToPublicStatus(row: any): PublicOrderStatus {
  return {
    id: row.id,
    status: row.status,
    pickupDate: row.pickup_date,
    pickupTime: row.pickup_time,
    serviceMode: row.service_mode,
    items: row.items ?? [],
    total: Number(row.total),
    createdAt: row.created_at,
    labels: row.labels ?? {},
  };
}
```

- [ ] **Step 5: Test laufen lassen — muss bestehen**

Run: `cd Frontend && bun test src/lib/__tests__/public-order.test.ts`
Expected: PASS (5 Tests grün).

- [ ] **Step 6: Commit**

```bash
git add Frontend/src/types/index.ts Frontend/src/lib/public-order.ts Frontend/src/lib/__tests__/public-order.test.ts
git commit -m "feat(orders): PublicOrderStatus-Typen + describeItem/rowToPublicStatus-Helfer"
```

---

### Task 3: Datenzugriff — `store.ts` (Token erzeugen + `getOrderStatus`)

**Files:**
- Modify: `Frontend/src/lib/data/store.ts` (createOrder ~68-93; neue Funktion + Import)

**Interfaces:**
- Consumes: `rowToPublicStatus` aus `@/lib/public-order`; `supabase` aus `@/lib/supabase`.
- Produces: `getOrderStatus(token: string): Promise<PublicOrderStatus | null>`; `createOrder` schreibt `public_token` und liefert `publicToken` in `OrderData`.

- [ ] **Step 1: Import ergänzen**

Oben in `Frontend/src/lib/data/store.ts` den bestehenden `@/types`-Import um `PublicOrderStatus` erweitern und den Helfer importieren. Nach der `supabase`-Import-Zeile einfügen:

```ts
import { rowToPublicStatus } from "@/lib/public-order";
```

Im bestehenden Typ-Import (`import type { ... } from "@/types";`) `PublicOrderStatus` mit aufnehmen.

- [ ] **Step 2: `createOrder` anpassen — Token erzeugen, mitschreiben, zurückgeben**

In `createOrder` (aktuell Zeilen ~76-90): Token vor dem `order`-Objekt erzeugen, ins Objekt und ins Insert aufnehmen.

Vor `const order: OrderData = {` einfügen:

```ts
  const publicToken = crypto.randomUUID();
```

Im `order`-Objektliteral `publicToken` ergänzen (direkt nach `id: order.id`-Zeile ist es das Feld `id`); konkret die erste Zeile des Literals zu:

```ts
    id: genId(), publicToken, items: input.items, subtotal, discount, total: computeTotal(subtotal, discount),
```

Im `supabase.from("orders").insert({ ... })` das Feld ergänzen (z. B. direkt nach `id: order.id,`):

```ts
    id: order.id, public_token: order.publicToken, user_id: sess.user?.id ?? null, items: order.items,
```

- [ ] **Step 3: `getOrderStatus` hinzufügen**

Nach `createOrder` (vor dem `// ── Nutzer/Profile`-Abschnitt) einfügen:

```ts
// Öffentlicher Bestell-Status über den nicht-ratbaren Token (RPC umgeht RLS feld-begrenzt).
export async function getOrderStatus(token: string): Promise<PublicOrderStatus | null> {
  const { data, error } = await supabase.rpc("get_order_status", { p_token: token });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row ? rowToPublicStatus(row) : null;
}
```

- [ ] **Step 4: Typecheck**

Run: `cd Frontend && bun run build`
Expected: Build erfolgreich (kein TS-Fehler; `OrderData.publicToken` ist überall gesetzt, da nur `store.ts` es konstruiert).

- [ ] **Step 5: Commit**

```bash
git add Frontend/src/lib/data/store.ts
git commit -m "feat(orders): createOrder erzeugt public_token; getOrderStatus-RPC-Aufruf"
```

---

### Task 4: Echter QR-Code (`qrcode.react`)

**Files:**
- Modify: `Frontend/package.json` (+ `bun.lock`) via `bun add`
- Modify: `Frontend/src/components/common/qr-code.tsx` (komplett ersetzen)

**Interfaces:**
- Produces: unveränderte Signatur `QrCode({ data }: { data: string })`, jetzt echter scanbarer QR.

- [ ] **Step 1: Dependency installieren**

Run: `cd Frontend && bun add qrcode.react`
Expected: `qrcode.react` erscheint in `package.json`-dependencies, `bun.lock` aktualisiert.

- [ ] **Step 2: Komponente ersetzen**

`Frontend/src/components/common/qr-code.tsx` komplett ersetzen durch:

```tsx
import type React from "react";
import { QRCodeSVG } from "qrcode.react";

// Echter, scanbarer QR-Code. `data` ist die zu kodierende URL.
export function QrCode({ data }: { data: string }): React.ReactElement {
  return (
    <QRCodeSVG
      value={data}
      size={256}
      level="M"
      bgColor="#ffffff"
      fgColor="#09090B"
      className="w-full h-full rounded-lg"
    />
  );
}
```

- [ ] **Step 3: Build prüfen**

Run: `cd Frontend && bun run build`
Expected: Build erfolgreich (Typen von `qrcode.react` aufgelöst).

- [ ] **Step 4: Commit**

```bash
git add Frontend/package.json Frontend/bun.lock Frontend/src/components/common/qr-code.tsx
git commit -m "feat(ui): echter scanbarer QR-Code via qrcode.react"
```

---

### Task 5: Bestätigungsseite kodiert Status-URL

**Files:**
- Modify: `Frontend/src/pages/confirmation/confirmation-page.tsx` (QR-Card ~53-58)

**Interfaces:**
- Consumes: `order.publicToken` aus `OrderData` (Task 2/3).

- [ ] **Step 1: Status-URL bauen und QR + Link setzen**

In `Frontend/src/pages/confirmation/confirmation-page.tsx` nach `if (!order) return <Navigate to="/" replace />;` die URL berechnen:

```tsx
  const statusUrl = `${window.location.origin}/bestellung/${order.publicToken}`;
```

Die QR-Card (aktuell Zeilen ~53-58) ersetzen durch:

```tsx
        <Card>
          <CardContent className="py-5 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3">QR-Code</p>
            <div className="w-36 h-36 mx-auto"><QrCode data={statusUrl} /></div>
            <a href={statusUrl} className="mt-3 inline-block text-xs text-primary underline underline-offset-2">
              Status verfolgen
            </a>
          </CardContent>
        </Card>
```

- [ ] **Step 2: Build prüfen**

Run: `cd Frontend && bun run build`
Expected: Build erfolgreich.

- [ ] **Step 3: Commit**

```bash
git add Frontend/src/pages/confirmation/confirmation-page.tsx
git commit -m "feat(confirmation): QR kodiert /bestellung/:token + Status-Link"
```

---

### Task 6: Öffentliche Status-Seite + Route

**Files:**
- Create: `Frontend/src/pages/status/order-status-page.tsx`
- Modify: `Frontend/src/router.tsx` (Import + öffentliche Route)

**Interfaces:**
- Consumes: `getOrderStatus` (Task 3), `describeItem` (Task 2), `OrderStatusBadge`, `isActive` aus `@/lib/order-status`, `formatPrice`, `formatDateLabel`.
- Produces: Default-Export `OrderStatusPage`; Route `/bestellung/:token` (öffentlich, außerhalb Auth-Layouts).

- [ ] **Step 1: Status-Seite erstellen**

Create `Frontend/src/pages/status/order-status-page.tsx`:

```tsx
import type React from "react";
import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router";
import { getOrderStatus } from "@/lib/data/store";
import { describeItem } from "@/lib/public-order";
import { isActive } from "@/lib/order-status";
import { formatPrice } from "@/lib/pricing";
import { formatDateLabel } from "@/lib/slots";
import { OrderStatusBadge } from "@/components/common/order-status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { PublicOrderStatus } from "@/types";

export default function OrderStatusPage(): React.ReactElement {
  const { token } = useParams<{ token: string }>();
  const [status, setStatus] = useState<PublicOrderStatus | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "notfound">("loading");

  const load = useCallback(async () => {
    if (!token) { setState("notfound"); return; }
    try {
      const s = await getOrderStatus(token);
      if (s) { setStatus(s); setState("ready"); }
      else setState("notfound");
    } catch {
      // Netzwerkfehler: letzten Stand behalten, stiller Retry beim nächsten Intervall.
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  // Auto-Refresh alle 20 s; stoppt bei Endstatus (abgeholt/storniert) und beim Unmount.
  useEffect(() => {
    if (status && !isActive(status.status)) return;
    const id = setInterval(() => { void load(); }, 20000);
    return () => clearInterval(id);
  }, [load, status]);

  if (state === "loading") {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">Lädt …</div>;
  }
  if (state === "notfound" || !status) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center gap-2">
        <h1 className="text-2xl font-black">Bestellung nicht gefunden</h1>
        <p className="text-muted-foreground text-sm">Der Link ist ungültig oder abgelaufen.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center space-y-2">
          <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em]">Bestellung</p>
          <p className="text-4xl font-black text-primary">{status.id}</p>
          <div><OrderStatusBadge status={status.status} /></div>
        </div>

        <Card>
          <CardContent className="py-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{status.serviceMode === "dinein" ? "Vor Ort" : "Abholung"}</span>
              <span className="font-semibold">{formatDateLabel(status.pickupDate)} · {status.pickupTime} Uhr</span>
            </div>
            <Separator />
            {status.items.map((item, i) => (
              <div key={item.cartId ?? i}>
                <div className="flex justify-between items-start gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{item.pizzaName}</p>
                    <p className="text-xs text-muted-foreground truncate">{describeItem(item, status.labels)}</p>
                  </div>
                  <span className="text-primary font-bold shrink-0">10 €</span>
                </div>
                {i < status.items.length - 1 && <Separator className="mt-3" />}
              </div>
            ))}
            <Separator />
            <div className="flex justify-between font-black">
              <span>Gesamt (bar)</span>
              <span className="text-primary">{formatPrice(status.total)}</span>
            </div>
          </CardContent>
        </Card>

        {status.status === "storniert" && (
          <p className="text-center text-sm text-destructive font-semibold">Diese Bestellung wurde storniert.</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Route registrieren (öffentlich)**

In `Frontend/src/router.tsx` den Import ergänzen (bei den übrigen Page-Imports):

```ts
import OrderStatusPage from "@/pages/status/order-status-page";
```

Und im `createBrowserRouter([ ... ])` **oben** bei den öffentlichen Routen (neben `/login`, `/passwort-reset`) hinzufügen:

```ts
  { path: "/bestellung/:token", element: <OrderStatusPage /> },
```

- [ ] **Step 3: Build prüfen**

Run: `cd Frontend && bun run build`
Expected: Build erfolgreich.

- [ ] **Step 4: Commit**

```bash
git add Frontend/src/pages/status/order-status-page.tsx Frontend/src/router.tsx
git commit -m "feat(status): öffentliche Bestell-Status-Seite + Route /bestellung/:token"
```

---

### Task 7: Dokumentation (CLAUDE.md-Grundregel)

**Files:**
- Create: `Doku/Pizza/Frontend/qr-bestell-status.md` (aus `Templates/_feature.md`)
- Create: `Doku/Pizza/Entscheidungen/ADR-0007-oeffentlicher-bestell-status-token.md` (aus `Templates/_adr.md`)
- Modify: `Doku/Pizza/Changelog.md` (neuer Eintrag oben unter `## 2026-07-13`)
- Modify: `Doku/Pizza/TODO.md` (QR-Zeile → erledigt)
- Modify: `Doku/Pizza/SETUP-Supabase.md` (Migrations-Liste um `0010` ergänzen)

- [ ] **Step 1: Feature-Seite**

Create `Doku/Pizza/Frontend/qr-bestell-status.md`:

```markdown
# Feature — Scanbarer QR → öffentliche Bestell-Status-Seite

- **Status:** fertig
- **Zweck:** Kunde scannt den QR auf der Bestätigung und verfolgt ohne Login den Bearbeitungsstand seiner Bestellung.

## Ablauf

Nach dem Bestellen zeigt die Bestätigung einen echten QR-Code, der auf
`https://<domain>/bestellung/<public_token>` verweist. Die öffentliche Seite zeigt Bestellnummer,
Status, Abholzeit, Pizza-Liste und Betrag und aktualisiert den Status alle 20 s automatisch
(stoppt bei „abgeholt"/„storniert").

## Technische Umsetzung

- **Frontend:** `components/common/qr-code.tsx` (jetzt `qrcode.react`), `pages/confirmation` kodiert
  die Status-URL, `pages/status/order-status-page.tsx` (öffentliche Route `/bestellung/:token`
  außerhalb der Auth-Layouts), Helfer `lib/public-order.ts` (`describeItem`, `rowToPublicStatus`).
- **Backend:** RPC `get_order_status(p_token uuid)` (SECURITY DEFINER), gibt nur Whitelist-Felder
  + `labels`-Map zurück; ausführbar für `anon`/`authenticated`.
- **Daten:** `orders.public_token uuid` (unique, Default `gen_random_uuid()`), Migration `0010`.

## Abhängigkeiten

`qrcode.react`; Supabase-RPC; `orders`-Tabelle; Menü-Tabellen `ingredients`/`sauces` (nur
serverseitig in der RPC für die Namensauflösung).

## Fehlerfälle

- Unbekannter/ungültiger Token → „Bestellung nicht gefunden".
- `storniert` → Storno-Hinweis, kein weiteres Polling. `abgeholt` → Endzustand, kein Polling.
- Netzwerkfehler beim Refresh → letzter Stand bleibt, stiller Retry.

## Offene Punkte

- Kein Realtime (bewusst; Auto-Refresh reicht). Kein Name/Telefon/Bemerkung öffentlich.
```

- [ ] **Step 2: ADR-0007**

Create `Doku/Pizza/Entscheidungen/ADR-0007-oeffentlicher-bestell-status-token.md`:

```markdown
# ADR-0007 — Öffentlicher Bestell-Status über nicht-ratbaren Token

- **Status:** akzeptiert
- **Datum:** 2026-07-13

## Problem

Der QR-Code soll eine ohne Login erreichbare Status-Seite öffnen. `orders.id` ist `text` und
ratbar; RLS lässt Bestellungen nur Eigentümer/Admin lesen. Ein öffentlicher Zugriff darf weder
über die ID adressierbar sein noch personenbezogene Felder (Name/Telefon) preisgeben.

## Mögliche Lösungen

1. Postgres-RPC (SECURITY DEFINER) mit `public_token uuid`, feld-begrenzte Rückgabe.
2. Edge Function als öffentlicher Endpunkt (service_role) mit eigener Filter-/CORS-Logik.

## Entscheidung

Option 1: `public_token uuid` (128 bit, nicht ratbar) + RPC `get_order_status`, für `anon`
ausführbar, gibt nur Whitelist-Felder + eine `labels`-Map zurück.

## Begründung

Passt zum bestehenden Muster (`is_admin`, `validate_order`), minimaler Code, kein zweiter
Deploy-Pfad. Der UUID-Token ist nicht bruteforcebar → Rate-Limiting unnötig.

## Vor- und Nachteile

- ➕ Schlank, RLS bleibt unangetastet, keine Menü-Öffnung für `anon` (Namen via RPC-`labels`).
- ➕ Nur Whitelist-Felder verlassen die DB (kein Name/Telefon/notes/voucher/user_id).
- ➖ Rate-Limiting nur über Supabase-Defaults (bei UUID-Token praktisch irrelevant).

## Auswirkungen

Migration `0010_public_token.sql` (Spalte + RPC + Grants); Betreiber führt sie via
`bunx supabase db push` aus. Frontend: neue öffentliche Route `/bestellung/:token`.

## Alternativen

Edge Function verworfen: Mehraufwand (zweiter Deploy, eigene CORS/Fehlerbehandlung) ohne
Sicherheitsgewinn bei unratbarem Token.
```

- [ ] **Step 3: Changelog-Eintrag**

In `Doku/Pizza/Changelog.md` unter `## 2026-07-13` als obersten Punkt einfügen:

```markdown
- **Scanbarer QR → öffentliche Bestell-Status-Seite:** echter QR (`qrcode.react`) auf der
  Bestätigung verlinkt auf `/bestellung/:token` (öffentlich, ohne Login). Neue Spalte
  `orders.public_token uuid` + SECURITY-DEFINER-RPC `get_order_status` (Migration `0010`), die nur
  Whitelist-Felder (Nr, Status, Abholzeit, Pizzen, Betrag) + eine `labels`-Namensmap liefert — kein
  Name/Telefon/Bemerkung. Status-Seite mit Auto-Refresh alle 20 s (stoppt bei abgeholt/storniert).
  Reine Helfer `describeItem`/`rowToPublicStatus` getestet (bun:test). ADR-0007. Betreiber führt
  Migration `0010` via `bunx supabase db push` aus.
```

- [ ] **Step 4: TODO aktualisieren**

In `Doku/Pizza/TODO.md` die QR-Zeile (`| P2 | Echter, scanbarer QR …`) ersetzen durch:

```markdown
| P2 | ~~Echter, scanbarer QR → öffentliche Bestell-Status-Seite~~ | erledigt (Migration 0010 `public_token`+RPC, `qrcode.react`, Route `/bestellung/:token`, Auto-Refresh 20s; ADR-0007). Betreiber: `bunx supabase db push` für 0010 | Frontend-Deployment |
```

- [ ] **Step 5: SETUP-Supabase Migrations-Liste**

In `Doku/Pizza/SETUP-Supabase.md` die Migrations-Aufzählung (Abschnitt „2. Migrationen ausführen", die Zeile mit `0009_grants.sql`) um `0010` erweitern, z. B. ans Ende der Kette anfügen:

```markdown
→ **`0010_public_token.sql`** (öffentlicher Bestell-Status: `public_token` + `get_order_status`-RPC).
```

Und wo die Reihenfolge `0001 … 0009` genannt wird, auf `0001 … 0010` erweitern.

- [ ] **Step 6: Commit**

```bash
git add Doku/Pizza/Frontend/qr-bestell-status.md Doku/Pizza/Entscheidungen/ADR-0007-oeffentlicher-bestell-status-token.md Doku/Pizza/Changelog.md Doku/Pizza/TODO.md Doku/Pizza/SETUP-Supabase.md
git commit -m "docs(qr): Feature-Seite, ADR-0007, Changelog, TODO, SETUP für öffentlichen Bestell-Status"
```

---

## Betreiber-Schritt (nach Merge)

`bunx supabase db push` ausführen (spielt Migration `0010_public_token.sql` inkl. Grants ein).
Kein Edge-Deploy nötig. Danach: echten Scan auf `https://pizza-self-pi.vercel.app` testen
(bestellen → QR scannen → Status-Seite muss laden und bei Statuswechsel innerhalb ~20 s nachziehen).

## Verifikation gesamt

- `cd Frontend && bun test src` → alle Tests grün (inkl. neuer `public-order.test.ts`).
- `cd Frontend && bun run build` → erfolgreich.
- Nach Betreiber-`db push`: manueller End-to-End-Scan (s. o.).
