# Admin-Desktop-Layout — Phase 1: Shell & Fundament

**Datum:** 2026-07-19
**Status:** Freigegeben

## Kontext

Der Admin-Bereich ist mobil-first: obere Kopfzeile + horizontal scrollende
Tab-Leiste mit 13 Punkten, Inhalt in voller Breite. Am PC läuft der Inhalt
auseinander und die scrollende Tab-Leiste ist umständlich. Der volle
Desktop-Umbau ist in Phasen zerlegt; **diese Spec ist Phase 1 (nur die Shell)**.

## Ziel

Auf großen Bildschirmen (`lg`+) eine feste linke **Seitenleiste** mit vertikaler
Navigation statt der scrollenden Tab-Leiste; der Inhalt wird zentriert und in der
Breite begrenzt. Auf dem Handy bleibt **alles unverändert**.

## Nicht-Ziel (Phase 2/3)

- Kein Redesign der einzelnen Admin-Seiten-Inhalte (bleiben einspaltig wie jetzt).
- Keine neuen wiederverwendbaren Layout-Komponenten (`PageHeader`, `AdminSection`,
  Grid-Wrapper) — die kommen in Phase 2, wo Seiten sie tatsächlich nutzen (YAGNI).
- Keine Backend-/DB-Änderung.

## Betroffene Datei

`Frontend/src/components/layout/admin-shell.tsx` (nur diese eine Datei). `NAV`
(13 Einträge) und die Auth-/Logout-Logik bleiben unverändert.

## Architektur

Wurzel wird zu `lg:flex` (Reihe). Zwei Zweige:

### Desktop-Seitenleiste (`hidden lg:flex lg:flex-col lg:w-60 lg:h-screen lg:sticky lg:top-0`)

- Kopf: Logo „🍕 Pizza Admin".
- Mitte: die 13 `NAV`-Einträge als **vertikale** `NavLink`s (Icon + Label,
  `text-sm`), aktiver Zustand `bg-primary/12 text-primary` (wie heute), scrollbar
  bei kurzen Viewports (`overflow-y-auto`).
- Fuß: E-Mail-Button (→ `/profil`, getruncatet) + „Abmelden" (beide volle Breite,
  linksbündig).

### Rechte Spalte / Handy-Layout (`flex-1 min-w-0 flex flex-col min-h-screen`)

- **Handy-Kopfzeile** und **Handy-Tab-Leiste**: strukturell **identisch** zur
  heutigen Implementierung (inkl. `sticky top-0` / `sticky top-[49px]`,
  `overflow-x-auto`, E-Mail-Truncate), nur zusätzlich mit `lg:hidden` versehen.
- **Inhalt:** `<main className="flex-1 overflow-auto">` mit dem bestehenden
  Motion-Fade; darin der `<Outlet />` in einem Container `mx-auto w-full max-w-5xl`.
  Die Seiten behalten ihr eigenes `p-4` (kein Doppel-Padding, kein Seiten-Umbau).

## Randfälle / Verhalten

- Aktiver Navigationszustand: identische `isActive`-Logik in beiden Navs.
- Sticky-Verhalten am Handy unverändert (Kopfzeile + Tab-Leiste bleiben oben).
- Bei sehr kurzer Desktop-Höhe scrollt die Seitenleisten-Navigation intern.

## Tests / Verifikation

Reines Layout ohne Logik → keine Unit-Tests. Verifikation:

- `bunx tsc --noEmit` grün, `bun run build` grün.
- Manuell/visuell:
  - `<lg` (Handy): Kopfzeile + scrollende Tab-Leiste + Inhalt **exakt wie vorher**,
    kein horizontaler Überlauf.
  - `lg`+ (Desktop): linke Seitenleiste sichtbar, alle 13 Links funktionieren,
    aktiver Punkt hervorgehoben, E-Mail/Abmelden im Fuß funktionieren, Inhalt
    zentriert auf `max-w-5xl`.
- Kein Betreiber-Deploy nötig (nur Frontend, Vercel bei Push).
