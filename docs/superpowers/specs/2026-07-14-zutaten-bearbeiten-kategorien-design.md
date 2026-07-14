# Design: Zutaten bearbeiten + Kategorie „Sonstiges"

**Datum:** 2026-07-14
**Status:** freigegeben (Brainstorming)
**Kontext:** Pizza-Vorbestell-App (React/Vite/Supabase), Admin-Zutatenverwaltung. Frontend live auf Vercel.

## Ziel

Zwei kleine, verwandte Verbesserungen der Zutaten-Admin-Seite:
1. **Bestehende Zutaten bearbeiten** (Name, Emoji, Kategorie, Beschreibung) — aktuell nur Anlegen,
   Verfügbar-Toggle und Löschen möglich.
2. **Beliebige/neue Kategorie vergeben** (insb. „Sonstiges" für Schoko/Süßes, Dessert-Pizzen) —
   aktuell bietet das Formular nur bereits existierende Kategorien an.

## Wichtige Rahmenbedingung (kein Backend-Aufwand)

- `ingredients.category` ist bereits ein freier `text` (Migration `0001`) — **keine Schema-/
  Migrationsänderung**, kein Betreiber-Schritt, kein Supabase-Deploy.
- `saveIngredients(list)` upsertet bereits die ganze Liste — Bearbeiten = Element ersetzen + upsert.
- **Kategorien sind überall datengetrieben:** sowohl die Admin-Tabs (`ingredients-page.tsx:58-62`)
  als auch der Kunden-Konfigurator (`configurator-page.tsx:65-67`) leiten die Kategorie-Liste aus den
  vorhandenen Zutaten ab. Sobald eine Zutat die Kategorie „Sonstiges" hat, erscheint sie **automatisch**
  als Admin-Tab UND als Gruppe im Konfigurator — ohne weitere Code-Änderung.
- Reines **Frontend**; deployt über den normalen `main`-Push (Vercel Auto-Deploy).

## Betroffene Dateien

- **Modify:** `Frontend/src/pages/admin/ingredients-page.tsx` (Kernänderung)
- **Create:** `Frontend/src/lib/ingredient-categories.ts` (reiner Helfer `mergeCategories`)
- **Test:** `Frontend/src/lib/__tests__/ingredient-categories.test.ts`
- **Docs:** Changelog, TODO (kein ADR, kein SETUP)

## Komponenten & Verhalten

### 1. Bearbeiten (Stift-Icon → gemeinsames Formular)

- Neuer State `editingId: string | null` (`null` = Anlege-Modus, sonst die `id` der bearbeiteten Zutat).
- Das bestehende, aufklappbare Formular wird **ein gemeinsames Add-/Edit-Formular**:
  - Titel: „Neue Zutat hinzufügen" (add) ↔ „Zutat bearbeiten" (edit).
  - Submit-Button: „Hinzufügen" (add) ↔ „Speichern" (edit).
- Jede Zutaten-Karte bekommt ein **Stift-Icon** (lucide `Pencil`) links neben dem Verfügbar-Switch.
  Klick →
  1. `form` mit den Werten der Zutat vorausfüllen (`name`, `emoji`, `category`, `description`),
  2. `editingId = ing.id`, `showForm = true`.
- **Speichern (Edit-Modus):** die Zutat in der Liste ersetzen und dabei `id` **und** `available`
  erhalten (`available` behält seinen eigenen Toggle, ist nicht Teil des Formulars):
  `items.map((i) => i.id === editingId ? { ...i, name, emoji, category, description } : i)`,
  dann via bestehendem `mutate(next)` persistieren (fire-and-forget wie im Bestand).
  Danach `form` zurücksetzen, `editingId = null`, `showForm = false`.
- **Anlegen (add-Modus):** unverändert wie bisher (`uid()`-`id`, `available: true`).
- **Abbrechen** setzt zusätzlich `editingId = null`.
- Der obere „Neue Zutat"-Button öffnet das Formular weiterhin im **Add-Modus** (setzt `editingId = null`
  und leert `form`), damit man nach einem Edit nicht versehentlich im Edit-Zustand hängen bleibt.

### 2. Kategorie-Auswahl mit „Neue Kategorie…"

- Neue Konstante ersetzt das bisherige `FALLBACK_CATEGORIES`:
  `BASE_CATEGORIES = ["Käse", "Fleisch", "Fisch", "Gemüse", "Sonstiges"]`.
- Reiner Helfer `mergeCategories(items, base)` in `Frontend/src/lib/ingredient-categories.ts`:
  liefert die **Vereinigung** aus `base` und den in `items` vorkommenden Kategorien, **ohne Dubletten**,
  Reihenfolge: erst `base` (in ihrer Reihenfolge), dann neue datengetriebene Kategorien (erste Sichtung
  gewinnt). Wird sowohl für die Tab-Liste als auch für die Formular-Optionen genutzt.
- Das Kategorie-`SelectInput` im Formular erhält als Optionen: `mergeCategories(...)` **plus** eine
  Sentinel-Option **„＋ Neue Kategorie…"** (fester Sentinel-Wert, z. B. `"__new__"`).
- Wählt der Admin den Sentinel, erscheint ein **Textfeld** für den freien Kategorienamen; dessen Wert
  wird zu `form.category`. Solange dieses Feld leer ist, ist **Speichern/Hinzufügen deaktiviert**
  (verhindert leere Kategorie).
- „Sonstiges" ist damit sofort per Dropdown-Klick wählbar; beliebige weitere (z. B. „Dessert") per
  Freitext.

### Tab-Liste

- Die Tab-Liste nutzt künftig ebenfalls `mergeCategories(items, BASE_CATEGORIES)` statt der
  bisherigen rein aus den Daten abgeleiteten Liste — so ist „Sonstiges" (und das Grundset) immer als
  Tab sichtbar, auch wenn noch keine Zutat drin ist (leerer Tab zeigt den bestehenden
  „Keine Zutaten in dieser Kategorie."-Hinweis).

## Fehler-/Randfälle

- **Leere Kategorie** (Freitext leer) → Submit deaktiviert.
- **Emoji `maxLength={2}`** bleibt wie im Bestand (mehrteilige Emojis sind eine pre-existing
  Einschränkung, außerhalb des Scopes).
- **Speicherfehler:** `saveIngredients` bleibt fire-and-forget (bewusst, konsistent zum Bestand; keine
  Fehleranzeige ergänzt — als bekannter Minor unverändert).
- **Edit → dann „Neue Zutat"-Button:** setzt sauber in den Add-Modus zurück (kein hängender
  `editingId`).

## Tests (bun:test)

- `mergeCategories`:
  - Grundset ohne Daten → nur `BASE_CATEGORIES`.
  - Daten mit neuer Kategorie („Dessert") → Grundset + „Dessert" hintenan, keine Dublette.
  - Daten, deren Kategorien schon im Grundset sind → keine Dubletten, Reihenfolge stabil.
- Form-Modus/Edit-Apply: per `bun run build` + manuellem Klicktest verifiziert (UI-Logik, Projekt-Muster).

## Doku

- **Changelog**-Eintrag (2026-07-14).
- **TODO:** beide Ideen („Zutaten bearbeiten", „Kategorie Sonstiges") als erledigt markieren.
- Falls eine Zutaten-/Admin-Feature-Seite existiert: kurz ergänzen. **Kein ADR** (keine
  Architekturentscheidung), **kein SETUP-Eintrag** (keine Migration).

## Bewusst NICHT im Scope (YAGNI)

- Keine Fehleranzeige bei Speicherfehler (bleibt wie Bestand).
- Kein Bearbeiten der `id` (würde Referenzen in bestehenden Bestellungen brechen).
- Keine Umbenennung/Migration bestehender Kategorien, kein Aufräumen verwaister Kategorien.
- Keine Dubletten-Erkennung bei Freitext-Kategorie (Dropdown-first mindert das Risiko).
