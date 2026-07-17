# Pizza-Projekt — Arbeitsanweisungen für Claude

## Coding-Workflow (ECC — hat Priorität)

Bei jeder Coding-Aufgabe nutze ich standardmäßig das ECC-Plugin (`ecc@ecc`) und
seine Agents/Skills. Dieser Ablauf ersetzt/steuert die Doku-Schritte weiter unten —
er ist die verbindliche Reihenfolge, sofern nicht anders angegeben:

1. **`/ecc:plan "<Aufgabe>"`** — Planner-Agent erstellt einen Blueprint (Schritte,
   Risiken, Dependencies). Dabei prüft er bestehende Doku (`Doku/Pizza/`) und
   `SETUP.md`, bevor er plant.
2. **Umsetzen** gemäß Blueprint. Wo sinnvoll: `tdd-workflow`-Skill (Tests zuerst).
   Bei größeren/unabhängigen Teilaufgaben: Git-Worktree-Parallelisierung nutzen.
3. **`/code-review`** — Qualitäts- und Security-Pass durch den Code-Reviewer-Agent.
4. **`/security-scan`** (AgentShield) — Pflicht vor jedem Commit.
5. **Doku aktualisieren** (siehe unten, via Templates).
6. **Changelog-Eintrag** ergänzen (`Doku/Pizza/Changelog.md`).
7. **TODO** pflegen (`Doku/Pizza/TODO.md`).
8. Größere Entscheidung? → **ADR** anlegen (`Doku/Pizza/Entscheidungen/`).

Der Security-Reviewer/AgentShield-Agent wird zusätzlich automatisch bei
sicherheitsrelevanten Änderungen (Auth, Payments, Datenzugriff) hinzugezogen,
auch außerhalb von Schritt 4.

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
