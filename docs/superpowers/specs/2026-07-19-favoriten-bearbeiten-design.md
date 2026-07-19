# Favoriten bearbeiten & benennen — Design

**Datum:** 2026-07-19
**Status:** Freigegeben

## Problem

Gespeicherte Favoriten (eigene Pizzen) können bisher nur angelegt und gelöscht
werden. Sie erhalten einen Auto-Namen („Eigene Pizza N") und ihr Rezept ist nach
dem Speichern fix. Nutzer möchten Favoriten **umbenennen** und ihr **Rezept
(Zutaten/Soße) ändern**.

## Ziel

- Favoriten benennen: beim Speichern einen eigenen Namen vergeben und bestehende
  Favoriten nachträglich umbenennen.
- Favoriten-Rezept bearbeiten: einen Favoriten laden, im Konfigurator anpassen und
  den **bestehenden** Favoriten überschreiben (statt einen neuen anzulegen).

## Nicht-Ziel

- Keine Backend-/DB-Änderung — Favoriten bleiben rein lokal (`localStorage`,
  Schlüssel `pizza-favorites`, max. 5, pro Gerät).
- Kein Geräte-Sync, kein Desktop-Umbau, keine Strukturänderung der Seiten.

## Datenmodell (unverändert)

`FavoritePizza`: `{ id: string; name: string; ingredientIds: string[]; sauceId: string }`.

## Architektur / Komponenten

### 1. Hook `use-favorites.tsx`

Zwei neue Funktionen im Context, `add`/`remove` bleiben unverändert:

- `rename(id: string, name: string): void` — setzt nur den Namen (leerer Name wird
  ignoriert, alter Name bleibt).
- `update(id: string, patch: { name?: string; ingredientIds?: string[]; sauceId?: string }): void`
  — überschreibt die angegebenen Felder des Favoriten mit `id`.

Beide `setFavorites`-basiert und über den bestehenden `useEffect` nach `localStorage`
persistiert.

### 2. Konfigurator `configurator-page.tsx` — Rezept bearbeiten „in place" + benennen

- Neuer State `editingFavId: string | null` (Bearbeiten-Modus) und `favName: string`
  (Namensfeld).
- `FavoritesBar.onLoad(fav)` setzt zusätzlich `editingFavId = fav.id` und
  `favName = fav.name` (neben `selected`/`sauceId` wie bisher).
- Der Speichern-Bereich (bisher ein „♥ Favorit"-Button mit Auto-Namen) wird zu einem
  kleinen Inline-Block:
  - ein **Namensfeld** (`Input`, vorbelegt mit `favName` bzw. einem Vorschlag
    „Eigene Pizza N"),
  - ein Button: im Bearbeiten-Modus **„Aktualisieren"** → `update(editingFavId,
    { name, ingredientIds: selected, sauceId })`; sonst **„Als Favorit speichern"** →
    `add(name, selected, sauceId)` (respektiert weiterhin `isFull`/MAX 5).
  - Im Bearbeiten-Modus zusätzlich ein Link **„als neuen speichern"** → `add(...)`
    statt `update(...)` (nur wenn nicht voll) und `editingFavId = null`.
- Nach erfolgreichem Speichern/Aktualisieren: kurze Bestätigung (bestehendes
  `favMsg`-Muster) und `editingFavId` wird nach „Aktualisieren" auf `null` gesetzt;
  die Auswahl bleibt stehen, damit man weiterbauen kann.

### 3. Umbenennen nachträglich — `favorites-bar.tsx` und Speisekarte `menu-page.tsx`

Beide zeigen Favoriten mit Name + Löschen. Ergänzt wird je ein **Stift-Icon**
(`Pencil` aus `lucide-react`), das ein Inline-Namensfeld öffnet:

- `favorites-bar.tsx` (Konfigurator): pro Chip ein kleiner Stift; Klick → der Name
  wird zu einem `Input`; Enter/Bestätigen ruft `rename(f.id, wert)`, Escape/Blur
  bricht ab.
- `menu-page.tsx` (Favoriten-Kachel): analog ein kleiner Stift neben/unter dem
  Namen; öffnet ein Inline-Namensfeld → `rename(f.id, wert)`.

Der Umbenenn-Zustand (welcher Favorit gerade editiert wird) ist lokal in der
jeweiligen Komponente (`editingId`/`draft`), keine globale Verdrahtung nötig.

## Fehlerbehandlung / Randfälle

- Leerer/nur-Leerzeichen-Name → `rename`/`update` ignoriert den Namensteil, alter
  Name bleibt.
- `MAX = 5` gilt weiter für **neue** Favoriten (`add`); `update` eines bestehenden
  ist immer erlaubt (erhöht die Anzahl nicht).
- Wird der gerade im Konfigurator bearbeitete Favorit anderweitig gelöscht, zielt
  `update` auf eine nicht mehr existierende `id` → No-op (kein Absturz).

## Tests

Reine Hook-Logik wird mit `bun:test` getestet (analog vorhandener Lib-Tests). Da der
Hook Context/`localStorage` nutzt, wird die reine Transformationslogik als kleine,
testbare Hilfsfunktion herausgezogen (`applyRename`/`applyUpdate` über ein
`FavoritePizza[]`) und der Provider ruft diese auf:

- `applyRename` ändert nur den Namen des passenden Favoriten; leerer Name = No-op;
  unbekannte `id` = No-op.
- `applyUpdate` überschreibt `ingredientIds`/`sauceId`/`name` des passenden Favoriten
  und lässt andere unberührt; unbekannte `id` = No-op.

## Verifikation

- `bunx tsc --noEmit` grün, `bun run build` grün, `bun test` (Unit) grün.
- Manuell: Favorit anlegen mit eigenem Namen; laden → Zutat ändern → „Aktualisieren"
  überschreibt (kein Duplikat); umbenennen in Leiste und auf der Speisekarte.
