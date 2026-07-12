# Teil-B4 — Serverseitige Preis-/Vorlauf-Validierung — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Den Bestell-Insert serverseitig härten: ein Postgres BEFORE-INSERT-Trigger berechnet Preis/Gutschein neu und weist ungültige Abhol-Slots ab; der Checkout fängt einen serverseitigen Reject sauber ab.

**Architecture:** Reines SQL (Trigger `validate_order()` auf `orders`) — nicht umgehbar, keine RLS-/Flow-Änderung. Ein kleiner Client-`try/catch` im Checkout für saubere Fehlermeldung. Logik spiegelt `pricing.ts`/`slots.ts` in plpgsql.

**Tech Stack:** Supabase (Postgres/plpgsql), Bun, Vite, React 18, TS. Tests: bun:test (nur bestehende reine Logik).

## Global Constraints

- **Umgebung erreicht Supabase NICHT.** Jeder Task verifiziert NUR `cd Frontend && bun run build` (Typecheck) + `cd Frontend && bun test src` (bestehende Tests grün). SQL wird geschrieben, NICHT ausgeführt. Kein Task braucht laufendes Supabase.
- Bun. Build/Test aus `Frontend/`.
- **Preis-Regel:** `subtotal = 10 * Anzahl Pizzen`; `discount` aus gültigem Gutschein (percent→`subtotal*value/100`, fixed→`value`, ingredient→0 + `free_ingredient`); ungültiger Gutschein → discount 0 + `voucher_code`/`free_ingredient` null (KEINE Ablehnung); `total = greatest(0, subtotal - discount)`; **≥1 Pizza** (sonst reject).
- **Slot-Regel:** `pickup_date >= heute + lead_time_days`; Wochentag in `app_config.days` (deutsche Namen) aktiv; `pickup_time` in `[hours.from, hours.to]`; `service_mode` in `app_config.service` aktiv. Verstoß → `raise exception` (Insert scheitert).
- **Referenz-Spec:** `docs/superpowers/specs/2026-07-12-teil-b4-serverseitige-validierung-design.md`.
- Doku-Task (Task 3) läuft am Ende; Build muss nach jedem Task grün bleiben.

---

## Dateistruktur (Ziel)

```
supabase/migrations/0005_validate_order.sql        (N) Trigger validate_order()
Frontend/src/pages/checkout/checkout-page.tsx      (M) try/catch + Fehlermeldung in placeOrder
Doku/Pizza/SETUP-Supabase.md, Changelog.md, TODO.md, Frontend/README.md  (M) Doku (Task 3)
```

---

### Task 1: Migration — `validate_order()`-Trigger

**Files:**
- Create: `supabase/migrations/0005_validate_order.sql`

> Reines SQL; berührt den Frontend-Build nicht. Review = SQL-Korrektheit. Nicht hier ausführbar.

- [ ] **Step 1: Migration schreiben** (`supabase/migrations/0005_validate_order.sql`)
```sql
-- Teil-B4: Serverseitige Preis-/Slot-Validierung. BEFORE INSERT auf orders.
-- SECURITY DEFINER, damit app_config/vouchers ohne RLS-Reibung gelesen werden.
create function public.validate_order() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  n int;
  subtotal numeric;
  discount numeric := 0;
  v record;
  cfg record;
  dayname text;
begin
  -- ── Preis serverseitig neu berechnen (überschreibt Client-Werte) ──
  n := coalesce(jsonb_array_length(new.items), 0);
  if n < 1 then
    raise exception 'Leere Bestellung';
  end if;
  subtotal := 10 * n;

  new.free_ingredient := null;
  if new.voucher_code is not null then
    select * into v from public.vouchers
      where code = new.voucher_code and active and expires_at >= current_date
      limit 1;
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
      new.voucher_code := null; -- ungültig/abgelaufen → ignorieren, kein Reject
    end if;
  end if;

  new.subtotal := subtotal;
  new.discount := discount;
  new.total := greatest(0, subtotal - discount);

  -- ── Abhol-Slot prüfen (raise → Insert scheitert) ──
  select days, hours, lead_time_days, service into cfg from public.app_config where id = 1;

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

  return new;
end; $$;

create trigger validate_order_before_insert
  before insert on public.orders
  for each row execute function public.validate_order();
```

- [ ] **Step 2: Build → grün** (Sanity — SQL berührt den Build nicht)

Run: `cd Frontend && bun run build`
Expected: unverändert grün.

- [ ] **Step 3: Commit**
```bash
git add supabase/migrations/0005_validate_order.sql
git commit -m "feat(b4): validate_order-Trigger (Preis/Slot serverseitig erzwungen)"
```

---

### Task 2: Checkout — Reject sauber abfangen

**Files:**
- Modify: `Frontend/src/pages/checkout/checkout-page.tsx`

**Interfaces:**
- Consumes: bestehendes `createOrder`, `placeOrder`.

- [ ] **Step 1: Fehler-State + try/catch**

In `checkout-page.tsx` einen State ergänzen (bei den anderen `useState`, z. B. nach `voucherMessage`):
```tsx
  const [orderError, setOrderError] = useState("");
```
`placeOrder` (aktuell ohne Fehlerbehandlung) so ersetzen:
```tsx
  const placeOrder = async () => {
    if (!canOrder || noDates || noService || !serviceMode) return;
    setOrderError("");
    try {
      const order = await createOrder({
        items: cart, customer, notes, pickupDate, pickupTime,
        voucherCode: appliedVoucher?.code, serviceMode,
      });
      clearCart();
      navigate("/bestaetigung", { state: order });
    } catch {
      setOrderError("Bestellung konnte nicht angenommen werden — bitte Angaben prüfen.");
    }
  };
```

- [ ] **Step 2: Meldung anzeigen**

Die Fehlermeldung direkt über dem fixierten Bestell-Button einfügen (im `fixed bottom-…`-Container, vor dem `<Button …>… bestellen …</Button>`):
```tsx
        {orderError && <p className="text-destructive text-xs text-center mb-2">{orderError}</p>}
```
> Der Implementer liest die Datei und platziert die Zeile unmittelbar vor dem großen Bestell-Button im fixierten unteren Bereich.

- [ ] **Step 3: Build + Tests → grün**

Run: `cd Frontend && bun run build && bun test src`
Expected: Build grün; Tests unverändert grün.

- [ ] **Step 4: Commit**
```bash
git add Frontend/src/pages/checkout/checkout-page.tsx
git commit -m "feat(b4): Checkout fängt serverseitigen Reject ab (Fehlermeldung statt Absturz)"
```

---

### Task 3: Doku & Verifikation

**Files:**
- Modify: `Doku/Pizza/SETUP-Supabase.md`, `Doku/Pizza/Changelog.md`, `Doku/Pizza/TODO.md`, `Frontend/README.md`

> Hinweis für die Ausführung: Doku wird gebündelt am Ende gemacht (siehe SDD-Ledger). Dieser Task fasst den B4-Doku-Teil.

- [ ] **Step 1: Gesamt-Verifikation**

Run: `cd Frontend && bun run build && bun test src`
Expected: Build grün; reine Logik-Tests grün.

- [ ] **Step 2: SETUP — Migration 0005**

`Doku/Pizza/SETUP-Supabase.md`: `0005_validate_order.sql` in die Liste der auszuführenden Migrationen aufnehmen (nach 0004). Kurzer Satz: „Ab jetzt erzwingt die DB Preis + Abhol-Slot; manipulierte Preise/ungültige Slots werden beim Bestellen abgelehnt/korrigiert."

- [ ] **Step 3: Changelog + README + TODO**

`Doku/Pizza/Changelog.md` (oben, 2026-07-12): „Teil-B4: serverseitige Preis-/Vorlauf-Validierung — Postgres-Trigger `validate_order` (Migration 0005) berechnet Preis/Gutschein neu und weist ungültige Slots (Vorlaufzeit/Wochentag/Uhrzeit/Modus) ab; Checkout zeigt Fehler statt Absturz. Schließt das in B1 dokumentierte Client-Manipulations-Restrisiko. Hier nur Build verifiziert; Betreiber führt 0005 aus."
`Frontend/README.md`: im Supabase-Abschnitt ergänzen: „Bestellungen werden serverseitig validiert (Preis + Slot), Migration 0005."
`Doku/Pizza/TODO.md`: „Teil-B4 (serverseitige Validierung) — erledigt"; im B1-Härtungs-Follow-up-Eintrag den Punkt „serverseitige Preis-/Vorlauf-Validierung" streichen/als erledigt markieren; Betreiber-Setup-Punkt um „Migration 0005" ergänzen.

- [ ] **Step 4: Commit**
```bash
git add Doku/ Frontend/README.md
git commit -m "docs(b4): SETUP (Migration 0005), Changelog/README/TODO"
```

---

## Self-Review (durchgeführt)

- **Spec-Abdeckung:** Preis-Recompute (subtotal/voucher/total, ≥1 Pizza) → T1; Slot-Checks (Vorlaufzeit/Wochentag/Uhrzeit/Service-Modus, raise) → T1; ungültiger Gutschein → still Voll-Preis (voucher_code/free_ingredient null) → T1; Client-try/catch → T2; SETUP/Changelog/README/TODO → T3. Nicht-Ziele (kein Flow-/RLS-Umbau, kein WhatsApp/Status) eingehalten.
- **Grün ohne Supabase:** T1 (SQL) berührt den Vite-Build nicht; T2 verifiziert `bun run build` + Tests; T3 nur Doku + Verifikation.
- **Konsistenz zur bestehenden Logik:** Preis-Formeln spiegeln `pricing.ts` (percent `subtotal*value/100`, fixed `value`, ingredient 0); Gutschein-Gültigkeit `active AND expires_at >= current_date` entspricht `validateVoucher`; Slot-Checks spiegeln `slots.ts` (Vorlaufzeit, `days`-Map, Zeitfenster) + B2-Service-Modus. Spalten (`items/subtotal/discount/total/free_ingredient/voucher_code/pickup_date/pickup_time/service_mode`) existieren laut 0001.
- **Platzhalter:** keine; die plpgsql-Logik ist vollständig ausgeschrieben.
