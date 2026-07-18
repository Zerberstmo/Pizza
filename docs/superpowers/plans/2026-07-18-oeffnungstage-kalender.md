# Öffnungstage per Kalender Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Der Admin plant Öffnung als **konkrete Kalendertage** (Tabelle `open_days`) statt als Wochentags-Muster; Kunden können nur an geplanten Tagen bestellen, serverseitig erzwungen.

**Architecture:** Neue Tabelle `open_days` (Admin schreibt, alle lesen). `validate_order` prüft `date ∈ open_days` statt Wochentag. Frontend: reine Helfer `getSelectableDates`/`calendarGrid`, Store-CRUD `getOpenDays`/`addOpenDay`/`removeOpenDay`, Admin-Seite als Kalender-Raster, Checkout zieht die Datumsoptionen aus `open_days`. Globale Uhrzeit + Vorlaufzeit unverändert; Sonderartikel-Sofortbestellung (`pizza_qty = 0`-Bypass) bleibt heil.

**Tech Stack:** TypeScript/React/Vite, Tailwind + shadcn/ui, **Bun** (`bun:test`), Supabase (Postgres/RLS/Trigger), react-router.

**Spec:** `docs/superpowers/specs/2026-07-18-oeffnungstage-kalender-design.md`

## Global Constraints

- **Server autoritativ:** `validate_order` überschreibt weiterhin Preis/Discount/Total und erzwingt den Slot. Nur die Tag-Prüfung wechselt von Wochentag auf `open_days`.
- **Unverändert:** Vorlaufzeit (`app_config.lead_time_days`), Uhrzeit-Fenster (`app_config.hours`), Service (`app_config.service`), der `pizza_qty = 0`-Bypass (Sonderartikel).
- **RLS `open_days`:** `select` für `anon`+`authenticated`; `insert`/`delete` nur `public.is_admin()`.
- **ISO-Datumsformat** `YYYY-MM-DD`; lexikografischer String-Vergleich = chronologisch.
- **`open_days` startet leer** — kein Vorbefüllen.
- **Migration heißt `0017_open_days.sql`** (nächste freie Nummer nach `0016`).

## File Structure

| Datei | Verantwortung |
|---|---|
| `supabase/migrations/0017_open_days.sql` (neu) | Tabelle `open_days` + RLS/Grants; `validate_order` mit `open_days`-Prüfung |
| `Frontend/src/lib/slots.ts` (ändern) | `getSelectableDates` neue Signatur; neuer `calendarGrid`; `toISO` exportiert |
| `Frontend/src/lib/data/store.ts` (ändern) | `getOpenDays`/`addOpenDay`/`removeOpenDay` |
| `Frontend/src/pages/admin/days-page.tsx` (ersetzen) | Kalender-Raster statt Wochentags-Schalter |
| `Frontend/src/pages/checkout/checkout-page.tsx` (ändern) | Datumsoptionen aus `getOpenDays` |

---

### Task 1: Migration 0017 — `open_days` + `validate_order`

**Files:**
- Create: `supabase/migrations/0017_open_days.sql`

**Interfaces:**
- Produces (DB): Tabelle `public.open_days`; ersetzte Funktion `public.validate_order()`.

> **Hinweis:** SQL ist hier nicht ausführbar → kein Auto-Test. Review + Betreiber-`db push`. Der BEFORE-INSERT-Trigger aus `0005` bleibt; nur die Funktion wird ersetzt.

- [ ] **Step 1: Tabelle + RLS anlegen**

`supabase/migrations/0017_open_days.sql` beginnen mit:

```sql
-- Öffnungstage als konkrete Kalendertage (ersetzt das Wochentags-Muster app_config.days im Ablauf).
create table if not exists public.open_days (
  date       date primary key,
  created_at timestamptz not null default now()
);

alter table public.open_days enable row level security;

-- Kunden dürfen lesen (sie sehen buchbare Tage), nur Admins schreiben.
create policy open_days_select on public.open_days for select using (true);
create policy open_days_admin  on public.open_days for all using (public.is_admin()) with check (public.is_admin());

grant all on public.open_days to postgres, anon, authenticated, service_role;
```

- [ ] **Step 2: `validate_order` ersetzen**

Übernimm die **komplette** aktuelle `validate_order` aus `supabase/migrations/0013_special_instant_order.sql` unverändert an das Ende von `0017` — mit **genau diesen drei Änderungen** im Slot-Block (dem `if pizza_qty > 0 then … end if;`):

(a) Die `cfg`-Abfrage liest `days` nicht mehr:
```sql
    select hours, lead_time_days, service into cfg from public.app_config where id = 1;
```
(vorher: `select days, hours, lead_time_days, service into cfg …`)

(b) Die Variable `dayname text;` in der `declare`-Sektion **entfernen**.

(c) Den Wochentags-Block ersetzen — also diesen Teil:
```sql
    dayname := case extract(dow from new.pickup_date::date)::int
      when 0 then 'Sonntag' when 1 then 'Montag' when 2 then 'Dienstag'
      when 3 then 'Mittwoch' when 4 then 'Donnerstag' when 5 then 'Freitag'
      when 6 then 'Samstag' end;
    if not coalesce((cfg.days ->> dayname)::boolean, false) then
      raise exception 'Wochentag nicht verfügbar';
    end if;
```
durch:
```sql
    if not exists (select 1 from public.open_days od where od.date = new.pickup_date::date) then
      raise exception 'Tag nicht geöffnet';
    end if;
```

**Sonst Zeichen für Zeichen identisch zu 0013:** Preis/Grant/Voucher, `pizza_qty = 0`-Bypass, Vorlaufzeit-Prüfung, Uhrzeit-Fenster, `service_mode`-Whitelist + `cfg.service`-Verfügbarkeit, `return new`.

- [ ] **Step 3: Review-Gate**

Prüfe: (a) `cfg`-select ohne `days`, `dayname` weg; (b) die neue `open_days`-Prüfung steht **innerhalb** des `if pizza_qty > 0`-Blocks (reine Sonderartikel-Bestellung überspringt sie); (c) Preis-/Grant-/Voucher-Hälfte unverändert; (d) `open_days` hat `select using(true)` **und** admin-only Schreibpolicy.

- [ ] **Step 4: Commit**

```bash
cd "C:/Users/Anwender/Desktop/Website/Pizza"
git add supabase/migrations/0017_open_days.sql
git commit -m "feat(db): 0017 open_days + validate_order prüft Tag statt Wochentag"
```

---

### Task 2: Store — `getOpenDays`/`addOpenDay`/`removeOpenDay`

**Files:**
- Modify: `Frontend/src/lib/data/store.ts`

**Interfaces:**
- Produces: `getOpenDays(): Promise<string[]>`, `addOpenDay(date: string): Promise<void>`, `removeOpenDay(date: string): Promise<void>`. Von Task 3 (Checkout) und Task 4 (Admin) konsumiert.

> Additiv — keine bestehende Funktion ändern. Muster wie die `special_items`-CRUD in derselben Datei.

- [ ] **Step 1: Funktionen anfügen**

Am Ende von `Frontend/src/lib/data/store.ts` einfügen:

```ts
// ── Öffnungstage (open_days) ──
export async function getOpenDays(): Promise<string[]> {
  const { data, error } = await supabase.from("open_days").select("date").order("date");
  if (error) throw error;
  return (data ?? []).map((r) => r.date as string);
}
export async function addOpenDay(date: string): Promise<void> {
  const { error } = await supabase.from("open_days").upsert({ date });
  if (error) throw error;
}
export async function removeOpenDay(date: string): Promise<void> {
  const { error } = await supabase.from("open_days").delete().eq("date", date);
  if (error) throw error;
}
```

- [ ] **Step 2: Typecheck**

Run: `cd "C:/Users/Anwender/Desktop/Website/Pizza/Frontend" && bunx tsc --noEmit`
Expected: keine neuen Fehler.

- [ ] **Step 3: Commit**

```bash
cd "C:/Users/Anwender/Desktop/Website/Pizza"
git add Frontend/src/lib/data/store.ts
git commit -m "feat(store): getOpenDays/addOpenDay/removeOpenDay"
```

---

### Task 3: Slot-Logik auf offene Tage umstellen (TDD) + Checkout

**Files:**
- Modify: `Frontend/src/lib/slots.ts`
- Modify: `Frontend/src/lib/__tests__/slots.test.ts` (falls vorhanden; sonst Create)
- Modify: `Frontend/src/pages/checkout/checkout-page.tsx`

**Interfaces:**
- Consumes: `getOpenDays` (Task 2).
- Produces: `getSelectableDates(openDates: string[], leadTimeDays: number, today: Date): string[]`; `calendarGrid(today: Date, weeks: number): string[][]`; `export`-ierte `toISO(d: Date): string`.

> Diese Task ändert `getSelectableDates` **und** den einzigen Kunden-Aufrufer (Checkout) gemeinsam, damit der Build grün bleibt.

- [ ] **Step 1: Failing tests schreiben**

In `Frontend/src/lib/__tests__/slots.test.ts` ergänzen (Datei ggf. neu anlegen mit `import { describe, it, expect } from "bun:test";`):

```ts
import { getSelectableDates, calendarGrid } from "@/lib/slots";

describe("getSelectableDates (open_days)", () => {
  const today = new Date("2026-07-18T09:00:00"); // Sa
  it("filtert Tage vor heute+Vorlauf, sortiert, dedupliziert", () => {
    const open = ["2026-07-25", "2026-07-19", "2026-07-25", "2026-07-10"];
    expect(getSelectableDates(open, 3, today)).toEqual(["2026-07-25"]); // 19. < 18.+3=21.; 10. Vergangenheit
  });
  it("Vorlauf 0: heute inklusive", () => {
    expect(getSelectableDates(["2026-07-18", "2026-07-17"], 0, today)).toEqual(["2026-07-18"]);
  });
  it("leere Eingabe → leer", () => expect(getSelectableDates([], 3, today)).toEqual([]));
});

describe("calendarGrid", () => {
  it("startet am Montag der Woche, N Wochen à 7 Tage", () => {
    const grid = calendarGrid(new Date("2026-07-18T12:00:00"), 2); // Sa 18.07.
    expect(grid).toHaveLength(2);
    expect(grid[0]).toHaveLength(7);
    expect(grid[0][0]).toBe("2026-07-13"); // Montag dieser Woche
    expect(grid[1][6]).toBe("2026-07-26"); // Sonntag der Folgewoche
  });
});
```

- [ ] **Step 2: Tests laufen lassen, Fehlschlag prüfen**

Run: `cd "C:/Users/Anwender/Desktop/Website/Pizza/Frontend" && bun test slots`
Expected: FAIL (neue Signatur/`calendarGrid` fehlen).

- [ ] **Step 3: `slots.ts` umbauen**

In `Frontend/src/lib/slots.ts`: `toISO` exportieren, `getSelectableDates` ersetzen, `calendarGrid` ergänzen, `isSlotAllowed` an die neue Signatur anpassen. Ersetze die bestehenden `toISO`-, `getSelectableDates`- und `isSlotAllowed`-Definitionen durch:

```ts
export function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Buchbare Tage: geplante offene Tage ab heute + Vorlaufzeit, sortiert & dedupliziert.
export function getSelectableDates(openDates: string[], leadTimeDays: number, today: Date): string[] {
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + leadTimeDays);
  const min = toISO(start);
  return [...new Set(openDates)].filter((d) => d >= min).sort();
}

// Wochenzeilen (Mo–So) ab dem Montag der Woche von `today`, für `weeks` Wochen — für den Admin-Kalender.
export function calendarGrid(today: Date, weeks: number): string[][] {
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  const dow = (start.getDay() + 6) % 7; // Mo=0 … So=6
  start.setDate(start.getDate() - dow);
  const grid: string[][] = [];
  for (let w = 0; w < weeks; w++) {
    const row: string[] = [];
    for (let d = 0; d < 7; d++) {
      const cell = new Date(start);
      cell.setDate(start.getDate() + w * 7 + d);
      row.push(toISO(cell));
    }
    grid.push(row);
  }
  return grid;
}

export function isSlotAllowed(dateStr: string, time: string, openDates: string[], leadTimeDays: number, hours: Hours, now: Date): boolean {
  return getSelectableDates(openDates, leadTimeDays, now).includes(dateStr)
    && getAvailableTimes(hours).includes(time);
}
```

`JS_DAY_MAP` und `DAYS_OF_WEEK` werden von `days-page.tsx` (bis Task 4) noch importiert — **stehen lassen**, bis Task 4 sie entfernt. Prüfe mit `grep -rn "isSlotAllowed" Frontend/src`, ob `isSlotAllowed` App-Aufrufer hat; falls ja, an die neue Signatur anpassen; falls nein, genügt die konsistente Definition.

- [ ] **Step 4: Checkout auf `getOpenDays` umstellen**

In `Frontend/src/pages/checkout/checkout-page.tsx`:

(a) Import ergänzen: `getOpenDays` zum bestehenden `@/lib/data/store`-Import hinzufügen.

(b) Nach den anderen `useAsync`-Zeilen (bei `getSauces`) ergänzen:
```ts
  const { data: openDays } = useAsync(getOpenDays);
```

(c) Die Zeile `const availableDates = config ? getSelectableDates(config, new Date()) : [];` ersetzen durch:
```ts
  const availableDates = config ? getSelectableDates(openDays ?? [], config.leadTimeDays, new Date()) : [];
```

- [ ] **Step 5: Tests + Typecheck + Build**

Run: `cd "C:/Users/Anwender/Desktop/Website/Pizza/Frontend" && bun test slots && bunx tsc --noEmit && bun run build`
Expected: slots-Tests grün; keine Typfehler; Build erfolgreich.

- [ ] **Step 6: Commit**

```bash
cd "C:/Users/Anwender/Desktop/Website/Pizza"
git add Frontend/src/lib/slots.ts Frontend/src/lib/__tests__/slots.test.ts Frontend/src/pages/checkout/checkout-page.tsx
git commit -m "feat(slots): getSelectableDates aus open_days + calendarGrid; Checkout umgestellt"
```

---

### Task 4: Admin `/admin/tage` als Kalender-Raster

**Files:**
- Modify: `Frontend/src/pages/admin/days-page.tsx` (vollständig ersetzen)

**Interfaces:**
- Consumes: `getOpenDays`/`addOpenDay`/`removeOpenDay` (Task 2); `calendarGrid`/`toISO`/`formatDateLabel` (Task 3); `useAsync`.

- [ ] **Step 1: `days-page.tsx` ersetzen**

Ersetze den **gesamten** Inhalt von `Frontend/src/pages/admin/days-page.tsx` durch:

```tsx
import type React from "react";
import { getOpenDays, addOpenDay, removeOpenDay } from "@/lib/data/store";
import { calendarGrid, toISO, formatDateLabel } from "@/lib/slots";
import { useAsync } from "@/hooks/use-async";
import { cn } from "@/lib/utils";
import { AsyncBoundary } from "@/components/common/async-boundary";

const WEEKS = 4;
const WD = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

// Admin: Öffnungstage als konkrete Kalendertage (ersetzt das Wochentags-Muster).
export default function DaysPage(): React.ReactElement {
  const { data, loading, error, reload } = useAsync(getOpenDays);
  const todayIso = toISO(new Date());
  const grid = calendarGrid(new Date(), WEEKS);

  const toggle = async (date: string, isOpen: boolean) => {
    if (isOpen) await removeOpenDay(date);
    else await addOpenDay(date);
    reload();
  };

  return (
    <div className="p-4 space-y-4">
      <div>
        <h2 className="font-bold text-lg">Öffnungstage</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Tippe die Tage an, an denen du geöffnet hast. Nur markierte Tage sind buchbar.
        </p>
      </div>
      <AsyncBoundary loading={loading} error={error} data={data ?? []}>
        {(openList: string[]) => {
          const open = new Set(openList);
          return (
            <div className="space-y-2">
              <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
                {WD.map((w) => <div key={w}>{w}</div>)}
              </div>
              {grid.map((week) => (
                <div key={week[0]} className="grid grid-cols-7 gap-1">
                  {week.map((date) => {
                    const past = date < todayIso;
                    const isOpen = open.has(date);
                    const day = Number(date.slice(8, 10));
                    return (
                      <button
                        key={date}
                        type="button"
                        disabled={past}
                        aria-pressed={isOpen}
                        aria-label={formatDateLabel(date)}
                        onClick={() => toggle(date, isOpen)}
                        className={cn(
                          "aspect-square rounded-md text-sm font-semibold transition-colors",
                          past && "opacity-30 cursor-not-allowed",
                          !past && isOpen && "bg-primary text-primary-foreground",
                          !past && !isOpen && "bg-card border border-border text-foreground hover:bg-accent",
                        )}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              ))}
              <p className="text-xs text-muted-foreground pt-1">
                {open.size} {open.size === 1 ? "Tag" : "Tage"} geöffnet in den nächsten {WEEKS} Wochen.
              </p>
            </div>
          );
        }}
      </AsyncBoundary>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + Build**

Run: `cd "C:/Users/Anwender/Desktop/Website/Pizza/Frontend" && bunx tsc --noEmit && bun run build`
Expected: keine Typfehler; Build erfolgreich. (Prüfe: `DAYS_OF_WEEK` wird jetzt evtl. nirgends mehr importiert — das ist ok, es bleibt in `slots.ts` exportiert.)

- [ ] **Step 3: Commit**

```bash
cd "C:/Users/Anwender/Desktop/Website/Pizza"
git add Frontend/src/pages/admin/days-page.tsx
git commit -m "feat(admin): Öffnungstage als Kalender-Raster (open_days) statt Wochentags-Schalter"
```

---

### Task 5: Doku

**Files:**
- Modify: `Doku/Pizza/Changelog.md`
- Modify: `Doku/Pizza/TODO.md`

**Interfaces:** keine.

- [ ] **Step 1: Changelog**

In `Doku/Pizza/Changelog.md` unter dem aktuellen Datum ergänzen: „**Öffnungstage per Kalender:** Der Admin plant unter `/admin/tage` konkrete Kalendertage (Kalender-Raster, 4 Wochen rollend) statt fester Wochentage — für unregelmäßigen Betrieb. Neue Tabelle `open_days` (Admin schreibt, Kunden lesen, RLS); `validate_order` (Migration `0017`) prüft `date ∈ open_days` statt Wochentag. Globale Uhrzeit + Vorlaufzeit unverändert; Sonderartikel-Sofortbestellung unberührt. Reine Helfer `getSelectableDates`/`calendarGrid` mit bun:test. Betreiber: `bunx supabase db push` (0017), danach Tage im Admin planen (`open_days` startet leer)."

- [ ] **Step 2: TODO**

In `Doku/Pizza/TODO.md` einen erledigten Eintrag (Datum 2026-07-18) für „Öffnungstage per Kalender" ergänzen, mit Verweis auf Migration `0017` und die Betreiber-Schritte.

- [ ] **Step 3: Commit**

```bash
cd "C:/Users/Anwender/Desktop/Website/Pizza"
git add Doku/Pizza/
git commit -m "docs: Öffnungstage per Kalender dokumentiert"
```

---

## Betreiber-Ausrollung (nach Merge nach `main`)

1. `bunx supabase db push` — spielt `0017` ein (`open_days`, neuer `validate_order`).
2. Frontend-Deploy (Vercel Auto-Deploy auf `main`).
3. Admin öffnet `/admin/tage` und plant die ersten Tage — **vorher ist nichts buchbar** (`open_days` leer).
4. Smoke-Test: einen Tag ≥ Vorlaufzeit markieren → als Kunde erscheint er im Checkout; ein nicht markierter Tag ist nicht bestellbar (Server: „Tag nicht geöffnet").
