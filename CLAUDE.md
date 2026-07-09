# Pizza-Projekt — Arbeitsanweisungen für Claude

## Doku-System

Die gesamte Projektdokumentation liegt in `Doku/Pizza/` (Obsidian-Vault auf `Doku/` öffnen).
Einstieg: `Doku/Pizza/00_CONTEXT.md`.

## Projekt-Defaults (verbindlich)

`Doku/Pizza/SETUP.md` ist die Single Source of Truth für Stack, Werkzeuge und Konventionen
(TypeScript/React/Vite, Tailwind + shadcn/ui, **Bun** als Package-Manager, Supabase, Vitest + Playwright).
Ich halte mich an diese Defaults und schlage keine abweichenden Technologien vor, ohne zu fragen.
Neue Setup-Entscheidungen trage ich dort ein.

## Grundregel

**Es darf keine implementierte Funktion existieren, die nicht dokumentiert wurde.**
Nach jeder Umsetzung aktualisiere ich die betroffene Doku.

## Ablauf pro Aufgabe

1. Anforderung verstehen → bestehende Doku & Architektur prüfen
2. Umsetzen
3. **Doku aktualisieren** (Feature-/Seiten-/Komponenten-Seite via Templates)
4. **Changelog-Eintrag** ergänzen (`Doku/Pizza/Changelog.md`)
5. **TODO** pflegen (`Doku/Pizza/TODO.md`)
6. Größere Entscheidung? → **ADR** anlegen (`Doku/Pizza/Entscheidungen/`)

## Templates immer nutzen

Neue Doku-Seiten IMMER aus einer Vorlage in `Doku/Pizza/Templates/` erstellen:
`_feature.md`, `_page.md`, `_component.md`, `_adr.md`, `_bug.md`, `_changelog-entry.md`.

## Session-Tracking (automatisch)

- Am **Session-Ende** läuft automatisch der `SessionEnd`-Hook und schreibt Dauer,
  Tokens und geschätzte Kosten nach `Doku/Pizza/Tracking/Session-Log.md`.
- **Meine Aufgabe:** Bevor die Session endet, trage ich unter dem Punkt
  „Was wurde gemacht" des jeweiligen (oder eines neuen) Session-Log-Eintrags eine
  kurze Stichpunktliste der umgesetzten Arbeit ein. Die harten Zahlen kommen vom Hook.

## Wiederverwendung

`Doku/`, diese `CLAUDE.md` und der Hook in `.claude/settings.json` sind projekt­unabhängig
gestaltet und lassen sich in neue Website-Projekte kopieren. Das Tracking-Script leitet den
Log-Pfad dynamisch aus dem Projektnamen ab.
