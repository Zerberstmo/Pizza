# Mobile-Responsivität: Horizontaler Überlauf — Design

**Datum:** 2026-07-19
**Status:** Freigegeben (Weg B)

## Problem

Auf dem Handy erscheint die Seite beim Öffnen zu breit — der Nutzer muss
erst herauszoomen, um den rechten Rand zu sehen. Symptom eines horizontalen
Überlaufs: irgendein Element ist breiter als der Viewport, wodurch der Browser
die Seite breiter als die sichtbare Fläche rendert.

Der Viewport-Meta-Tag ist korrekt
(`width=device-width, initial-scale=1.0, viewport-fit=cover`). Eine statische
Sichtung von Login, Speisekarte, Konfigurator und Checkout fand **keinen**
offensichtlichen Fixbreiten-Übeltäter — alle Seiten nutzen `px-4`, `flex-wrap`,
`max-w-*` und `min-w-0`. Der Überlauf ist daher subtil oder datenabhängig und
muss empirisch gemessen werden.

## Ziel

Keine Kundenroute (und keine Admin-Route) erzeugt bei 360 px Viewport-Breite
noch horizontalen Überlauf. Das „Herauszoomen-Müssen" verschwindet. Keine
optische Regression, kein Desktop-Umbau (bewusst außerhalb des Umfangs).

## Nicht-Ziel

- Kein Desktop-/PC-Layout (separater, späterer Schritt).
- Keine Umgestaltung der Navigation oder der Seitenstruktur.
- Keine inhaltlichen/funktionalen Änderungen.

## Ansatz (Weg B: messen + gezielt fixen)

Zwei sich ergänzende Ebenen:

### 1. Globales Sicherheitsnetz

In `Frontend/src/styles/theme.css` innerhalb `@layer base`:

```css
html, body { overflow-x: hidden; max-width: 100%; }
```

Dies verhindert, dass die Seite jemals breiter als der Viewport wird — der
horizontale Scroll/Zoom entfällt in jedem Fall. Es ist die Absicherung, **nicht**
der alleinige Fix: echte Überläufe werden zusätzlich an der Quelle behoben, damit
kein Inhalt still abgeschnitten wird.

### 2. Empirischer Audit + Quell-Fixes

1. `bun run dev` starten.
2. Jede Route bei 360 px Breite laden und messen, ob
   `document.documentElement.scrollWidth > document.documentElement.clientWidth`.
   Routen (aus `router.tsx`):
   - Öffentlich/Kunde: `/login`, `/passwort-reset`, `/`, `/konfigurator`,
     `/warenkorb` (leer **und** mit Position), `/bestaetigung`,
     `/meine-bestellungen`, `/profil`, `/bestellung/:token`
   - Admin: `/admin/bestellungen`, `/admin/dashboard`, `/admin/tage`,
     `/admin/oeffnungszeiten`, `/admin/vorlaufzeit`, `/admin/service`,
     `/admin/zutaten`, `/admin/sossen`, `/admin/gutscheine`,
     `/admin/sonderartikel`, `/admin/nutzer`, `/admin/benachrichtigungen`,
     `/admin/einstellungen`
3. Für jede Route mit Überlauf das überlaufende Element identifizieren (über die
   DevTools-Messung des breitesten Kindes) und **an der Quelle** reparieren:
   - Lange, nicht umbrechende Texte → `min-w-0` am Flex-Kind + `truncate`/`break-words`.
   - Zu breite Raster (z. B. `grid-cols-7`-Kalender bei sehr schmaler Breite) →
     Zellen-Mindestbreite/`gap` reduzieren oder Raster in einen
     `overflow-x-auto`-Container kapseln.
   - Feste Pixelbreiten, die den Viewport sprengen → auf relative Einheiten
     bzw. `max-w-full` umstellen.

   Kein pauschales `overflow-x: hidden` auf Einzelkomponenten als Ersatz für
   einen echten Quell-Fix.

## Betroffene Dateien (erwartet)

- `Frontend/src/styles/theme.css` — globales Sicherheitsnetz (sicher).
- 0–n Seiten-/Komponenten-Dateien — nur die, bei denen die Messung tatsächlich
  Überlauf zeigt. Die Liste ist vor dem Audit nicht abschließend bekannt; das
  ist bewusst so und wird im Plan als Mess-Schritt geführt.

## Verifikation

- Nach den Fixes zeigt **keine** Route bei 360 px `scrollWidth > clientWidth`.
- Stichprobe bei 320 px (kleinstes gängiges Handy) unauffällig.
- `bunx tsc --noEmit` grün.
- `bun run build` grün.
- Bestehende Unit-Tests grün (keine Logikänderung erwartet).
- Optische Kontrolle: kein Inhalt sichtbar abgeschnitten.

## Risiken

- **`overflow-x: hidden` maskiert einen echten Überlauf** → deshalb ist der
  empirische Audit Pflicht, nicht optional. Das Sicherheitsnetz ist Absicherung,
  der Audit die eigentliche Behebung.
- **Audit ohne Login für Admin/Kunde** → Messung erfordert Test-Anmeldung im
  Dev-Server; die Zugangsdaten liegen beim Betreiber. Falls im Ausführungskontext
  kein Login möglich ist, wird der Audit auf die öffentlich erreichbaren Routen
  plus statische Code-Prüfung der übrigen beschränkt und das im Ergebnis
  transparent vermerkt.
