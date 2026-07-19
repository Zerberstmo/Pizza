# Admin-Desktop-Layout — Phase 2: Listenseiten mehrspaltig

**Datum:** 2026-07-19
**Status:** Freigegeben

## Kontext

Phase 1 brachte die Desktop-Seitenleiste + vollbreiten Inhalt. Die Admin-Listen
sind aber weiterhin **einspaltige Karten-Stapel** (`space-y-*`), die sich auf
breiten Schirmen über die volle Breite strecken und dadurch leer/gestreckt wirken.
Phase 2 legt diese Listen in **responsive Raster**, damit die Breite genutzt wird.

## Ziel

Die sechs Listenseiten zeigen ihre Karten auf großen Schirmen mehrspaltig; auf dem
Handy bleiben sie einspaltig.

## Nicht-Ziel

- Keine Änderung an Seitenlogik, „Neu anlegen"-Formularen oder Datenfluss.
- Keine neuen Komponenten, kein Backend.

## Änderung (nur je ein Listen-Container-`className` pro Seite)

Der Wrapper direkt um die `.map(...)`-Kartenliste wechselt von `space-y-N` auf ein
Grid mit `items-start` (verhindert, dass ausklappbare Karten die Reihe strecken):

- **Kompakte Karten** — `grid gap-3 sm:grid-cols-2 xl:grid-cols-3 items-start`:
  - `pages/admin/users-page.tsx` (Wrapper um `users.map`)
  - `pages/admin/sauces-page.tsx` (Wrapper um `sauces.map`)
  - `pages/admin/ingredients-page.tsx` (die `TabsContent`-Klasse je Kategorie:
    `space-y-2 mt-3` → `grid gap-3 sm:grid-cols-2 xl:grid-cols-3 items-start mt-3`)
- **Reichere/höhere Karten** — `grid gap-3 md:grid-cols-2 2xl:grid-cols-3 items-start`:
  - `pages/admin/orders-page.tsx` (Wrapper um `shown.map`)
  - `pages/admin/vouchers-page.tsx` (Wrapper um `vouchers.map`)
  - `pages/admin/special-items-page.tsx` (Wrapper um `list.map`)

## Verifikation

- `bunx tsc --noEmit` grün, `bun run build` grün.
- Handy (`<sm`/`<md`): jede Liste einspaltig wie vorher.
- Desktop: 2–3 Spalten je Seite; alle Aktionen (Toggle/Löschen/Bearbeiten/Ausklappen)
  funktionieren; kein horizontaler Überlauf.
- Kein Betreiber-Deploy (nur Frontend).
