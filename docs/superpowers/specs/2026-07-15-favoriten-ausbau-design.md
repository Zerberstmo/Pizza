# Design: Favoriten ausbauen (kontogebunden, benennen, bearbeiten, 1-Tap)

**Datum:** 2026-07-15
**Status:** freigegeben (Brainstorming)
**Kontext:** Pizza-Vorbestell-App (React/Vite/Supabase). Es gibt bereits Favoriten
(`useFavorites`, localStorage, max 5, `FavoritePizza = { id, name, ingredientIds, sauceId }`), eine
`FavoritesBar` im Konfigurator und ein Auto-Speichern mit Auto-Name „Eigene Pizza N".

## Ziel

Favoriten werden **an das Konto gebunden** (geräteübergreifend), können beim Speichern **selbst benannt**
und später **bearbeitet** werden (Name **und** Rezept), und lassen sich **mit 1 Tap von der Startseite**
in den Warenkorb legen.

## Ausgangslage (heute)

- Favoriten in `localStorage` (`useFavorites`), Cap 5. Anlegen im Konfigurator per „♥ Favorit"-Button
  mit **Auto-Name** „Eigene Pizza N" (kein Namensfeld). Laden setzt Zutaten/Soße; Löschen per X in der
  `FavoritesBar`. **Kein** Umbenennen, **kein** Bearbeiten, **kein** Direkt-Bestellen.

## A. Speicherung — kontogebunden

### Migration (neue Tabelle)
```sql
create table public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  ingredient_ids jsonb not null default '[]'::jsonb,
  sauce_id text,
  created_at timestamptz not null default now()
);
alter table public.favorites enable row level security;
create policy favorites_own on public.favorites for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
```
- RLS: nur Eigentümer (lesen/anlegen/ändern/löschen). Grants laufen über das `0009`-Muster mit
  (`db push`).

### Store (`store.ts`)
- `getFavorites(): Promise<FavoritePizza[]>` — eigene (RLS), nach `created_at`.
- `addFavorite(name, ingredientIds, sauceId): Promise<FavoritePizza>` — insert mit
  `user_id = (await supabase.auth.getUser()).data.user.id`.
- `updateFavorite(id, name, ingredientIds, sauceId): Promise<void>` — update (RLS beschränkt auf eigene).
- `removeFavorite(id): Promise<void>` — delete.
- `rowToFavorite(r)` (getestet): `{ id, name, ingredientIds: r.ingredient_ids ?? [], sauceId: r.sauce_id ?? "" }`.

### `useFavorites` umbauen (DB-backed)
- State `favorites` + `loading`. Beim Mount/Anmeldewechsel: mit Nutzer → `getFavorites`, ohne Nutzer → `[]`.
- Interface: `{ favorites, loading, add, update, remove, isFull }`
  - `add(name, ingredientIds, sauceId): Promise<boolean>` — false bei `>=5`, sonst `addFavorite` + State.
  - `update(id, name, ingredientIds, sauceId): Promise<void>` — `updateFavorite` + State ersetzen.
  - `remove(id): Promise<void>` — `removeFavorite` + State filtern.
  - `isFull` bei `>=5`.
- **Einmalige Migration:** beim ersten Laden mit Nutzer — falls `localStorage["pizza-favorites"]`
  Einträge hat: diese (bis zum Cap) via `addFavorite` übernehmen, dann den localStorage-Key löschen
  (verhindert Doppel-Migration). Bestehende Favoriten gehen so nicht verloren.
- **Provider-Reihenfolge:** `FavoritesProvider` muss innerhalb `AuthProvider` liegen (braucht den Nutzer);
  im Plan verifizieren.
- Der bestehende Test `hooks/__tests__/use-favorites.test.tsx` (localStorage) wird **ersetzt/angepasst**.

## B. Benennen (Konfigurator)

- Beim Favoriten-Speichern ein **Name-Feld** (Vorbelegung „Eigene Pizza N", überschreibbar) statt des
  Auto-Namens → `add(name, selected, sauceId)`.

## C. Bearbeiten (Rezept + Umbenennen) — Konfigurator im Edit-Modus

- Konfigurator-Route `/konfigurator` erhält optional `?fav=<id>`. Ist der Param gesetzt:
  - Favorit aus `useFavorites` holen → `setSelected(fav.ingredientIds)`, `setSauceId(fav.sauceId)`,
    Name-Feld mit `fav.name` vorbelegen, `editingFavoriteId = fav.id`.
  - Ein Hinweis „Favorit bearbeiten: <Name>"; der Speichern-Button heißt **„Aktualisieren"** →
    `update(editingFavoriteId, name, selected, sauceId)` (Rezept **und** Name in einem).
- Ohne `?fav`: normaler Konfigurator; Speichern legt einen **neuen** Favoriten an (Abschnitt B).
- Die bestehende `FavoritesBar` bleibt „Rezept als Startpunkt laden → neuer Favorit" (bewusst getrennt
  vom Edit-Modus).

## D. Startseite „Deine Favoriten" (`menu-page.tsx`)

- Abschnitt **„Deine Favoriten"** (nur wenn `favorites.length > 0`). Je Favorit: Name + Mini-Vorschau
  (`PizzaSVG selected={ingredientIds}`) + Aktionen:
  - **[In den Warenkorb]** → `addToCart(name, ingredientIds, sauceId)` → kurze Bestätigung, **bleibt**
    auf der Startseite (Warenkorb-Badge zählt hoch).
  - **[Bearbeiten]** → `navigate("/konfigurator?fav=" + id)`.
  - **[Löschen]** → `remove(id)`.

## Fehler-/Randfälle

- **Nicht eingeloggt:** Favoriten leer (laufen ohnehin nur hinter `RequireCustomer`).
- **Cap 5 erreicht:** `add` gibt false → Hinweis „Max. 5 Favoriten — lösche zuerst einen." (wie heute).
- **`?fav=<id>` unbekannt** (z. B. gelöscht/anderes Gerät): normaler Konfigurator, keine Edit-Vorbelegung.
- **Nicht-mehr-verfügbare Zutat** im Favoriten: wie bei „Erneut bestellen" — wird beim Bestellen
  wie-gespeichert übernommen (Server prüft Verfügbarkeit nicht); im Konfigurator sichtbar/änderbar.

## Tests

- `rowToFavorite` rein (bun:test): Mapping inkl. `sauce_id = null → ""`, fehlende `ingredient_ids → []`.
- `hooks/__tests__/use-favorites.test.tsx` an DB-Backing anpassen (bzw. auf die reine Mapping-/Cap-Logik
  reduzieren; localStorage-Annahmen entfernen).
- Konfigurator-Edit + Startseiten-Aktionen: `bun run build` + manueller Klicktest.
- SQL (Migration/RLS): hier nicht ausführbar → Review; Betreiber `bunx supabase db push`.

## Doku & Betreiber

- **Changelog** + **TODO** (Favoriten-Ausbau erledigt) + **SETUP-Supabase.md** (neue Migration).
- **Betreiber-Schritt:** Migration via `bunx supabase db push`. Kein Edge-Deploy.
- Kein ADR.

## Bewusst NICHT im Scope (YAGNI)

- Cap bleibt bei **5** (nicht konfigurierbar).
- Kein Teilen/Öffentlich-Machen von Favoriten.
- Kein Umbenennen „inline" auf der Startseite (Umbenennen läuft über den Konfigurator-Edit, zusammen
  mit dem Rezept — eine Bearbeiten-Fläche).
- Keine Sortierung/Reihenfolge der Favoriten (nach `created_at`).
