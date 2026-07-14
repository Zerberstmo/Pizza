# Design: Dashboard-Reset (weicher Reset-Punkt)

**Datum:** 2026-07-14
**Status:** freigegeben (Brainstorming)
**Kontext:** Pizza-Vorbestell-App (React/Vite/Supabase). Das Admin-Dashboard aggregiert **all-time**
direkt aus `orders` (`computeDashboard`, keine separate Statistik-Speicherung). Frontend live auf Vercel.

## Ziel

Der Admin kann die Dashboard-Statistik „zurücksetzen", ohne Daten zu verlieren: ein **Reset-Zeitpunkt**
wird gesetzt, ab dem das Dashboard zählt. Bestellungen, Historie, Bestell-Liste und der WhatsApp-Digest
bleiben **unberührt**. Der Reset-Button liegt gut sichtbar getrennt unter einem neuen Admin-Tab
„Einstellungen" und ist gegen versehentliches Klicken abgesichert.

## Rahmenbedingungen

- Dashboard-Zahlen kommen ausschließlich aus `orders` (`computeDashboard` bleibt unverändert).
- Reset ist **nicht destruktiv** und reversibel (Zeitpunkt änderbar / auf all-time zurückstellbar).
- Betrifft **nur** das Dashboard — nicht Digest, Bestell-Liste oder Order-Historie.

## Betroffene Dateien

- **Create:** `supabase/migrations/00XX_dashboard_reset.sql` (Spalte in `app_config`)
- **Modify:** `Frontend/src/lib/data/store.ts` (`getDashboardStats` filtert; `getConfig`/`saveConfig`
  kennen das neue Feld) und `Frontend/src/types/index.ts` (`AppConfig`)
- **Create:** `Frontend/src/pages/admin/settings-page.tsx`
- **Modify:** `Frontend/src/router.tsx` (Route), `Frontend/src/components/layout/admin-shell.tsx` (Nav)
- **Modify (optional):** `Frontend/src/pages/admin/dashboard-page.tsx` (Hinweis „Statistik seit …")
- **Docs:** Changelog, TODO

## Datenmodell (Migration)

- Neue Spalte:
  ```sql
  alter table public.app_config add column if not exists dashboard_reset_at timestamptz;
  ```
  `null` = all-time (bisheriges Verhalten). `app_config` ist das Admin-Config-Singleton (`id = 1`),
  RLS: Lesen für Authentifizierte, Schreiben nur Admin (bestehende Policies gelten).
- `AppConfig`-Typ (Frontend) um `dashboardResetAt: string | null` erweitern; `getConfig`/`saveConfig`
  mappen die Spalte (snake ↔ camel).

## Aggregation

- `getDashboardStats`:
  - liest den Config-Wert `dashboard_reset_at`;
  - lädt `orders` mit `created_at >= dashboard_reset_at`, falls gesetzt (Supabase-Query
    `.gte("created_at", resetAt)`), sonst alle;
  - danach unverändert `computeDashboard(orders, ingredientNames)`.
- Die reine Aggregationslogik (`computeDashboard`) bleibt **unangetastet** (bereits getestet).

## Admin-Seite „Einstellungen"

- Neue Seite `Frontend/src/pages/admin/settings-page.tsx`, Route `/admin/einstellungen` (in den Admin-
  `children`), Nav-Eintrag in `admin-shell.tsx` (z. B. Icon `Settings` aus lucide). Als **erweiterbare**
  Einstellungsseite angelegt (aktuell nur der Dashboard-Reset-Abschnitt).
- **Abschnitt „Dashboard zurücksetzen":**
  - Zeigt den aktuellen Stand: „Statistik zählt seit **&lt;formatiertes Datum&gt;**" bzw.
    „seit Beginn (all-time)".
  - **Fehlklick-Schutz — zweistufig inline:** Primärbutton „Dashboard zurücksetzen" → beim Klick
    erscheint stattdessen „Wirklich zurücksetzen? **Ja** / Abbrechen". Erst „Ja" schreibt
    `dashboard_reset_at = jetzt` (Client setzt `new Date().toISOString()`), lädt den Config-Stand neu.
  - Zusätzlicher Button **„Auf all-time zurückstellen"** (setzt `dashboard_reset_at = null`) — ebenfalls
    mit kurzer Inline-Bestätigung.
- Persistenz über das bestehende `saveConfig`-Muster (Admin-RLS greift).

## Dashboard-Hinweis (optional)

- Auf `dashboard-page.tsx` ein dezenter Vermerk „Statistik seit &lt;Datum&gt;", wenn ein Reset-Punkt
  gesetzt ist — schafft Klarheit über den Bezugszeitraum.

## Fehler-/Randfälle

- `dashboard_reset_at = null` → all-time (Ausgangszustand, kein Sonderfall im UI außer Anzeige).
- Reset in die Zukunft ist nicht möglich (Client setzt „jetzt"); ein manuell gesetzter Zukunftswert
  würde das Dashboard leeren — kein UI-Pfad dafür, daher ignoriert (YAGNI).
- Speicherfehler beim Setzen: kurze Fehlermeldung (konsistent zu anderen Admin-Config-Seiten, soweit
  dort Fehler angezeigt werden; sonst still — im Plan festlegen).

## Tests

- Aggregation nutzt weiter das getestete `computeDashboard`; der Reset-Filter ist ein Query-Detail
  (Client-Integration) → per `bun run build` + manuellem Test verifiziert.
- Optional: ein reiner Helfer, der aus `orders` + `resetAt` die gefilterte Liste bildet, wäre testbar —
  nur einführen, wenn er die Query nicht ohnehin überflüssig macht (im Plan entscheiden).
- Migration (SQL): hier nicht ausführbar → Review; Betreiber spielt sie via `bunx supabase db push` ein.

## Doku

- **Changelog**-Eintrag (2026-07-14).
- **TODO:** Idee „Dashboard-Reset-Button" als erledigt markieren (bei Umsetzung).
- **Kein ADR** (keine tragende Architekturentscheidung).

## Bewusst NICHT im Scope (YAGNI)

- Kein Löschen/Archivieren von Bestellungen (bewusst verworfen zugunsten des weichen Reset-Punkts).
- Kein Passwort-/Modal-Schutz (zweistufiger Inline-Confirm reicht).
- Keine mehreren/benannten Reset-Punkte oder Zeitraum-Filter im Dashboard (nur ein „seit"-Zeitpunkt).
- Kein Reset einzelner Kennzahlen (Reset gilt für die ganze Dashboard-Aggregation).
