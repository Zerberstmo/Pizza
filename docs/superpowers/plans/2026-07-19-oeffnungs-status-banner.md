# Öffnungs-Status-Banner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kleines Banner oben auf der Startseite zeigt Ampel „Jetzt geöffnet/geschlossen" + „Nächste Abholung: <Tag> ab <Zeit>".

**Architecture:** Reine Frontend-Ableitung aus vorhandener Config (`getConfig`) + Öffnungstagen (`getOpenDays`, `open_days`-Tabelle). Getestete pure Helfer in `lib/opening-status.ts`, dünne Präsentations-Komponente, Einbindung in `menu-page.tsx`. Kein Backend, keine Migration, kein Deploy.

**Tech Stack:** TypeScript, React 19, Tailwind v4, bun:test.

## Global Constraints

- Kein Backend/keine Migration/kein Betreiber-Deploy — nur Frontend.
- Öffnungstage kommen aus `open_days` via `getOpenDays(): Promise<string[]>` (Kalendermodell seit 0017), **nicht** aus `config.days`.
- `getSelectableDates(openDates: string[], leadTimeDays: number, today: Date)` — exakte Signatur einhalten.
- Uhrzeit-Grenzen inklusiv: `cur >= from && cur <= to` (konsistent zu `getAvailableTimes`).
- `bunx tsc --noEmit` grün, `bun test` grün, `bun run build` grün.

---

### Task 1: Pure Helfer + Tests (`lib/opening-status.ts`)

**Files:**
- Create: `Frontend/src/lib/opening-status.ts`
- Test: `Frontend/src/lib/__tests__/opening-status.test.ts`

**Interfaces:**
- Consumes: `toISO`, `getSelectableDates`, `availableServiceModes` aus `@/lib/slots`; `AppConfig` aus `@/types`.
- Produces: `interface OpeningStatus { openNow: boolean; nextPickup: { date: string; time: string } | null }`; `openingStatus(config: AppConfig, openDays: string[], now: Date): OpeningStatus`; `relativeDateLabel(dateStr: string, now: Date): string`.

- [ ] **Step 1: Failing tests schreiben** (`__tests__/opening-status.test.ts`)

```ts
import { describe, it, expect } from "bun:test";
import { openingStatus, relativeDateLabel } from "@/lib/opening-status";
import type { AppConfig } from "@/types";

const base: AppConfig = {
  days: {}, hours: { from: "11:00", to: "14:00" }, leadTimeDays: 0,
  service: { dineIn: false, takeaway: true }, dashboardResetAt: null,
};
const now = new Date("2026-07-20T12:00:00"); // Mo, 12:00 in [11:00..14:00]

describe("openingStatus", () => {
  it("offen: heute in open_days + Uhrzeit drin + Service", () => {
    const s = openingStatus(base, ["2026-07-20"], now);
    expect(s.openNow).toBe(true);
    expect(s.nextPickup).toEqual({ date: "2026-07-20", time: "11:00" });
  });
  it("außerhalb der Uhrzeiten → geschlossen", () => {
    expect(openingStatus(base, ["2026-07-20"], new Date("2026-07-20T15:00:00")).openNow).toBe(false);
  });
  it("heute nicht in open_days → geschlossen", () => {
    expect(openingStatus(base, ["2026-07-25"], now).openNow).toBe(false);
  });
  it("kein Service → geschlossen", () => {
    const cfg = { ...base, service: { dineIn: false, takeaway: false } };
    expect(openingStatus(cfg, ["2026-07-20"], now).openNow).toBe(false);
  });
  it("leeres openDays → nextPickup null", () => {
    expect(openingStatus(base, [], now).nextPickup).toBeNull();
  });
  it("Vorlaufzeit schiebt nextPickup nach vorn", () => {
    const cfg = { ...base, leadTimeDays: 2 };
    const s = openingStatus(cfg, ["2026-07-20", "2026-07-25"], now);
    expect(s.nextPickup?.date).toBe("2026-07-25"); // 20. < 20.+2=22.
  });
});

describe("relativeDateLabel", () => {
  it("heute", () => expect(relativeDateLabel("2026-07-20", now)).toBe("heute"));
  it("morgen", () => expect(relativeDateLabel("2026-07-21", now)).toBe("morgen"));
  it("übermorgen → Wochentag+Datum", () => expect(relativeDateLabel("2026-07-22", now)).toBe("Mi, 22.07."));
});
```

- [ ] **Step 2: Test failt** — `cd Frontend && bun test opening-status` → FAIL (Modul fehlt).

- [ ] **Step 3: Helfer implementieren** (`lib/opening-status.ts`)

```ts
import type { AppConfig } from "@/types";
import { toISO, getSelectableDates, availableServiceModes } from "@/lib/slots";

export interface OpeningStatus {
  openNow: boolean;
  nextPickup: { date: string; time: string } | null;
}

// "Jetzt geöffnet" = heutiges Datum ist geplanter Öffnungstag (open_days)
// UND aktuelle Uhrzeit in [from..to] UND mind. ein Service aktiv.
export function openingStatus(config: AppConfig, openDays: string[], now: Date): OpeningStatus {
  const openToday = openDays.includes(toISO(now));
  const cur = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const withinHours = cur >= config.hours.from && cur <= config.hours.to;
  const hasService = availableServiceModes(config).length > 0;
  const openNow = openToday && withinHours && hasService;

  const dates = getSelectableDates(openDays, config.leadTimeDays, now);
  const nextPickup = dates.length > 0 ? { date: dates[0], time: config.hours.from } : null;
  return { openNow, nextPickup };
}

// Freundliches Label: heute / morgen / "Mi, 22.07." (relativ zu now).
export function relativeDateLabel(dateStr: string, now: Date): string {
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T00:00:00");
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  if (diffDays === 0) return "heute";
  if (diffDays === 1) return "morgen";
  const wd = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"][target.getDay()];
  const dd = String(target.getDate()).padStart(2, "0");
  const mm = String(target.getMonth() + 1).padStart(2, "0");
  return `${wd}, ${dd}.${mm}.`;
}
```

- [ ] **Step 4: Tests grün** — `cd Frontend && bun test opening-status` → PASS.

- [ ] **Step 5: Commit** — `feat(menu): openingStatus/relativeDateLabel-Helfer + Tests`.

---

### Task 2: Banner-Komponente (`components/common/opening-status-banner.tsx`)

**Files:**
- Create: `Frontend/src/components/common/opening-status-banner.tsx`

**Interfaces:**
- Consumes: `openingStatus`, `relativeDateLabel` aus `@/lib/opening-status`; `AppConfig` aus `@/types`.
- Produces: `export function OpeningStatusBanner(props: { config: AppConfig; openDays: string[] }): React.ReactElement`.

- [ ] **Step 1: Komponente implementieren** — dezente Card/Chip-Optik, volle Breite. Ampel-Punkt (`bg-green-500` offen / `bg-muted-foreground` geschlossen) + Text „Jetzt geöffnet"/„Jetzt geschlossen"; Zeile darunter aus `nextPickup` → „Nächste Abholung: **{relativeDateLabel} ab {time} Uhr**" bzw. „Aktuell keine Abholtermine". `now` via `new Date()` in der Komponente. Bestehende Tailwind-Tokens/Look verwenden (vgl. `menu-page.tsx` Header-Optik).

- [ ] **Step 2: `bunx tsc --noEmit`** grün.

- [ ] **Step 3: Commit** — `feat(menu): OpeningStatusBanner-Komponente`.

---

### Task 3: Einbindung in `menu-page.tsx`

**Files:**
- Modify: `Frontend/src/pages/menu/menu-page.tsx`

**Interfaces:**
- Consumes: `OpeningStatusBanner`; `getOpenDays` aus `@/lib/data/store`.

- [ ] **Step 1:** Import `getOpenDays` + `OpeningStatusBanner`. `const openDays = useAsync(getOpenDays);` ergänzen (neben `config`).
- [ ] **Step 2:** Direkt unter dem Header-Block, vor/nach dem `<Separator />`, einsetzen: `{config.data && openDays.data && <div className="px-4 pt-4"><OpeningStatusBanner config={config.data} openDays={openDays.data} /></div>}`. Kein Layout-Sprung: nur rendern wenn beide da.
- [ ] **Step 3:** `bunx tsc --noEmit` + `bun run build` grün.
- [ ] **Step 4: Commit** — `feat(menu): Öffnungs-Status-Banner auf Startseite einbinden`.

---

### Task 4: Doku

**Files:**
- Modify: `Doku/Pizza/Changelog.md` (Eintrag 2026-07-19)
- Modify: `Doku/Pizza/TODO.md` (Idee „Öffnungs-Status-Banner" → erledigt)

- [ ] **Step 1:** Changelog-Eintrag + TODO-Zeile.
- [ ] **Step 2: Commit** — `docs: Öffnungs-Status-Banner in Changelog/TODO`.

## Validation

```bash
cd Frontend && bun test opening-status && bunx tsc --noEmit && bun run build
```

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Zeitzone: `new Date()` clientseitig ≠ Europe/Berlin | Niedrig | Banner ist unverbindlicher Momentanhinweis; Slot-Validierung bleibt serverautoritativ. Kein harter Effekt. |
| `open_days` leer → immer „geschlossen"/„keine Termine" | Erwartet | Korrektes Verhalten; deckt Randfall ab. |

## Acceptance

- [ ] Tests grün, tsc grün, build grün
- [ ] Banner zeigt korrekten Status + nächsten Abholtag auf `/`
- [ ] Kein horizontaler Überlauf, kein Layout-Sprung beim Laden
