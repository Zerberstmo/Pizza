# Design: Öffnungs-Status-Banner (Startseite)

**Datum:** 2026-07-15
**Status:** freigegeben (Brainstorming)
**Kontext:** Pizza-Vorbestell-App (React/Vite/Supabase). Vorbestellung mit Vorlaufzeit
(`app_config.leadTimeDays`), offene Wochentage (`days`), Uhrzeiten (`hours.from/to`), Service-Modi
(`service`). Slot-Logik in `lib/slots.ts`. Startseite = Speisekarte (`menu-page.tsx`, Route `/`).

## Ziel

Oben auf der Startseite ein kleines Banner mit **(a) Ampel „Jetzt geöffnet / geschlossen"** und
**(b) „Nächste Abholung: &lt;Tag&gt; ab &lt;Zeit&gt;"** — damit der Kunde sofort sieht, ob/wann er
Pizza bekommt. Rein aus der vorhandenen Config, **kein Backend**.

## Betroffene Dateien

- **Create:** `Frontend/src/lib/opening-status.ts` (reine Helfer)
- **Test:** `Frontend/src/lib/__tests__/opening-status.test.ts`
- **Create:** `Frontend/src/components/common/opening-status-banner.tsx`
- **Modify:** `Frontend/src/pages/menu/menu-page.tsx` (Banner oben einsetzen)
- **Docs:** Changelog, TODO

## Reine Helfer (`lib/opening-status.ts`)

```ts
import type { AppConfig } from "@/types";
import { JS_DAY_MAP, getSelectableDates, availableServiceModes } from "@/lib/slots";

export interface OpeningStatus {
  openNow: boolean;
  nextPickup: { date: string; time: string } | null; // date = ISO YYYY-MM-DD, time = hours.from
}

// "Jetzt geöffnet" = heutiger Wochentag offen UND aktuelle Uhrzeit in [from..to] UND ein Service aktiv.
// nextPickup = erster wählbarer Abholtag (getSelectableDates) + hours.from; null wenn keine Termine.
export function openingStatus(config: AppConfig, now: Date): OpeningStatus {
  const dayName = JS_DAY_MAP[now.getDay()];
  const openDay = !!config.days[dayName];
  const cur = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const withinHours = cur >= config.hours.from && cur <= config.hours.to;
  const hasService = availableServiceModes(config).length > 0;
  const openNow = openDay && withinHours && hasService;

  const dates = getSelectableDates(config, now);
  const nextPickup = dates.length > 0 ? { date: dates[0], time: config.hours.from } : null;
  return { openNow, nextPickup };
}

// Freundliches Label: heute / morgen / "Di, 16.07." (relativ zu now).
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

> Hinweis: `JS_DAY_MAP`, `getSelectableDates`, `availableServiceModes` existieren bereits in
> `lib/slots.ts`. String-Vergleich von `HH:MM` (nullpadded) ist korrekt für den Uhrzeit-Check.

## Komponente (`components/common/opening-status-banner.tsx`)

- Props: `{ config: AppConfig }` (den `now`-Zeitpunkt bildet die Komponente via `new Date()`; Banner ist
  ein Momentanzustand — kein Live-Ticking nötig).
- Rendert:
  - **Ampel:** kleiner Punkt (🟢 `bg-green-500` / ⚪ `bg-muted-foreground`) + Text „Jetzt geöffnet" /
    „Jetzt geschlossen" (aus `openNow`).
  - **Zeile darunter:** `nextPickup` → „Nächste Abholung: **{relativeDateLabel(date, now)} ab {time} Uhr**";
    `null` → „Aktuell keine Abholtermine".
- Dezent gestyltes Banner (Card/Chip-Optik, passend zum bestehenden Look), volle Breite oben.

## Einbindung (`menu-page.tsx`)

- `config` via `useAsync(getConfig)` laden (falls die Menu-Seite es noch nicht tut).
- Oben, vor der Speisekarte, `{config && <OpeningStatusBanner config={config} />}` einsetzen. Während
  des Ladens nichts/Platzhalter (kein Layout-Sprung provozieren).
- Bestehende Menu-Inhalte unverändert.

## Fehler-/Randfälle

- **Kein offener Tag / kein Service:** `openNow=false`, `nextPickup` ggf. `null` → „geschlossen" +
  „keine Abholtermine".
- **Config lädt noch:** Banner erst zeigen, wenn `config` da ist.
- **Uhrzeit-Grenzen:** `>= from && <= to` (inklusiv) — konsistent zur Slot-Logik (`getAvailableTimes`
  schließt `to` mit ein).

## Tests (bun:test)

- `openingStatus`: offen (offener Tag + Uhrzeit drin + Service) → `openNow=true`; außerhalb der
  Uhrzeiten → false; geschlossener Wochentag → false; kein Service → false; `nextPickup` = erster
  wählbarer Tag bzw. `null` bei leeren `days`.
- `relativeDateLabel`: heute/morgen/übermorgen (Wochentag+Datum).

## Doku

- **Changelog** (2026-07-15) + **TODO** (Idee „Öffnungs-Status" erledigt bei Umsetzung).
- **Kein ADR, keine Migration** (reines Frontend aus vorhandener Config).

## Bewusst NICHT im Scope (YAGNI)

- Kein sekündliches Live-Update der Uhrzeit (Momentanzustand beim Laden reicht).
- Keine mehrtägige Öffnungszeiten-Tabelle im Banner (nur aktueller Status + nächster Termin).
- Keine Sonderöffnungszeiten/Feiertage (nutzt die bestehende `days`/`hours`-Config).
