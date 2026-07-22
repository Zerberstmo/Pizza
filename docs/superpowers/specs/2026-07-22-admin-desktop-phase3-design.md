# Admin-Desktop-Layout — Phase 3: Einstellungen-Hub + Dashboard-Breite

**Datum:** 2026-07-22
**Status:** Freigegeben

## Kontext

Phase 1 brachte die Desktop-Seitenleiste + vollbreiten Inhalt, Phase 2 legte die
sechs Listenseiten in responsive Raster. Offen blieben die **Konfig-/Dashboard-Seiten**:
mehrere schmale Ein-Karten-Formulare (Öffnungszeiten, Vorlaufzeit, Service,
Benachrichtigungen, Reset), die sich seit Phase 1 (kein `max-w-lg`-Deckel mehr)
über die volle Desktop-Breite strecken und mit ihrem vollbreiten „Speichern"-Button
leer/verloren wirken. Zusätzlich hat die Admin-Navigation **13 Einträge** — zu lang.

## Ziel

1. Die fünf Konfig-Formular-Seiten zu **einem Einstellungen-Hub** zusammenfassen:
   ein responsives Karten-Raster (1 Spalte Handy, 2 ab `md`, 3 ab `xl`).
2. Die Admin-Navigation von 13 auf 9 Einträge verkürzen.
3. Das Dashboard nutzt die Desktop-Breite (Kacheln 4-spaltig, Charts nebeneinander).

Ein einheitliches Verhalten auf allen Geräten (Handy = Hub mit gestapelten Karten,
kein zweiter Code-Pfad).

## Nicht-Ziele

- **Bestelltage** (Kalender) und **Dashboard** bleiben eigene Nav-Punkte.
- Keine Änderung an der Formular-Logik/Validierung/Datenfluss — nur umgehängt.
- Kein Backend, keine Migration, kein Betreiber-Deploy (reines Frontend).

## Architektur

### Einstellungen-Hub (`pages/admin/settings-page.tsx`)

Wird vom reinen Reset-Formular zum **Hub**. Route bleibt `/admin/einstellungen`.
Rendert ein responsives Grid (`grid gap-3 md:grid-cols-2 xl:grid-cols-3 items-start`)
mit fünf Karten in dieser Reihenfolge:

| Karte | Komponente | Speicher-Quelle |
|-------|-----------|-----------------|
| Service | `ServiceCard` | `AppConfig` (geteilt) |
| Öffnungszeiten | `HoursCard` | `AppConfig` (geteilt) |
| Vorlaufzeit | `LeadTimeCard` | `AppConfig` (geteilt) |
| Benachrichtigungen | `NotificationsCard` | `NotifyConfig` (eigen) |
| Dashboard-Reset | `DashboardResetCard` | eigene Reset-Aktion |

### Karten-Komponenten (`components/admin/settings/`)

Jede Karte ist eine eigenständige, fokussierte Komponente, die genau ein Formular
kapselt. Was jede tut, wie man sie nutzt, wovon sie abhängt:

- **`ServiceCard`, `HoursCard`, `LeadTimeCard`** — rendern je ihr Formular +
  eigenen „Speichern"-Button. Sie erhalten den **geteilten** Config-Zustand vom Hub
  per Props: `config`, `setConfig`, `save`, `saved`. Kein eigener `useConfigEditor`.
- **`NotificationsCard`** — selbst-versorgend: eigenes `useAsync(getNotifyConfig)` +
  lokaler Zustand + `saveNotifyConfig`. Eigener „Speichern"-Button.
- **`DashboardResetCard`** — selbst-versorgend: die heutige Reset-Logik aus
  `settings-page.tsx` (zweistufiger Confirm, „auf all-time zurückstellen",
  `getConfig`/`setDashboardResetAt`). Keine „Speichern"-Zeile, eigene Confirm-Aktionen.

### Kein Lost-Update (kritisch)

Service/Öffnungszeiten/Vorlaufzeit schreiben **dasselbe** `AppConfig`-Objekt
(`saveConfig` persistiert das ganze Objekt). Getrennte `useConfigEditor`-Instanzen
je Karte würden je eine eigene Kopie laden → Speichern der einen Karte könnte
Änderungen der anderen mit stalen Feldern überschreiben.

**Regel:** Der Hub hält **genau einen** `useConfigEditor()` und reicht
`config`/`setConfig`/`save`/`saved` an ServiceCard, HoursCard und LeadTimeCard.
Jede dieser drei Karten behält ihren eigenen „Speichern"-Button (spart Wege), aber
alle drei rufen dasselbe geteilte `save()` auf demselben `config`-Objekt auf — kein
Datenverlust. Das „Gespeichert"-Feedback (`saved`) ist geteilt und darf auf allen
drei Buttons gleichzeitig aufleuchten (akzeptiert).

### Navigation (`components/layout/admin-shell.tsx`)

Die vier Einträge **Öffnungszeiten, Vorlaufzeit, Service, Benachrichtigungen**
werden aus dem `NAV`-Array entfernt (wirkt zugleich auf Desktop-Seitenleiste und
Handy-Tab-Leiste, da beide `NAV` mappen). „Einstellungen" bleibt für die Gruppe.
Ergebnis: 13 → 9 Einträge. Nicht mehr benötigte Icon-Importe (`Clock`, `Timer`,
`Store`, `MessageSquare`) entfernen.

### Routing

Die vier alten Routen werden auf den Hub umgeleitet, damit ein offener Tab / Reload
keinen 404 erzeugt:

```
/admin/oeffnungszeiten    → <Navigate to="/admin/einstellungen" replace />
/admin/vorlaufzeit        → <Navigate to="/admin/einstellungen" replace />
/admin/service            → <Navigate to="/admin/einstellungen" replace />
/admin/benachrichtigungen → <Navigate to="/admin/einstellungen" replace />
```

Die vier Seiten-Dateien (`hours-page.tsx`, `lead-time-page.tsx`, `service-page.tsx`,
`notifications-page.tsx`) werden **gelöscht** — ihr Inhalt lebt in den Karten weiter.

### Dashboard-Breite (`pages/admin/dashboard-page.tsx`)

Reine className-Änderungen:

- Kennzahl-Kacheln: `grid grid-cols-2 gap-3` → `grid grid-cols-2 xl:grid-cols-4 gap-3`.
- Die beiden Chart-Karten („Beliebteste Pizzen" / „Beliebteste Zutaten") ab `lg`
  nebeneinander: gemeinsamer Wrapper `grid gap-5 lg:grid-cols-2 items-start`.

## Fehlerbehandlung

Unverändert gegenüber den bestehenden Seiten (`AsyncBoundary` für Lade-/Fehlerzustand
je Karte bzw. je Datenquelle; Reset-Karte behält ihre `saveError`-Anzeige).

## Verifikation

- `bunx tsc --noEmit` grün, `bun run build` grün.
- Handy (`<md`): Hub 1-spaltig, Karten gestapelt; Tab-Leiste zeigt 9 statt 13 Einträge.
- Desktop: 3 Karten pro Reihe; Dashboard-Kacheln 4-spaltig (`xl`), Charts nebeneinander (`lg`).
- Alle fünf Aktionen funktionieren: Service/Öffnungszeiten/Vorlaufzeit speichern (ohne
  sich gegenseitig zu überschreiben), Benachrichtigungen speichern, Reset + all-time.
- Alte Routen leiten auf `/admin/einstellungen` um; kein horizontaler Überlauf.
- Kein Betreiber-Deploy (nur Frontend).
