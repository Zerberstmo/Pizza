# Pizza-Projekt — Arbeitsanweisungen für Claude

## Coding-Workflow (ECC — hat Priorität)

Bei jeder Coding-Aufgabe nutze ich standardmäßig das ECC-Plugin (`ecc@ecc`) und
seine Agents/Skills. Dieser Ablauf ersetzt/steuert die Doku-Schritte weiter unten —
er ist die verbindliche Reihenfolge, sofern nicht anders angegeben:

1. **`/ecc:plan "<Aufgabe>"`** — Planner-Agent erstellt einen Blueprint (Schritte,
   Risiken, Dependencies). Dabei prüft er bestehende Doku (`Doku/Pizza/`) und
   `SETUP.md`, bevor er plant.

2. **Skill-Check (PFLICHT, vor jeder Umsetzung)** — Bevor irgendein Code
   geschrieben wird, gehe ich die verfügbare Skill-Liste durch und bewerte
   für jeden potenziell relevanten Skill explizit JA/NEIN mit Begründung,
   z. B.:Relevante Skill-Familien für dieses Projekt (nicht abschließend):
   `ponytail-*` (audit, debt, gain, help, review), `caveman-*` (commit,
   compress, help, review, stats), `design-taste-frontend*`,
   `ui-styling`, `ui-ux-pro-max`, `imagegen-frontend-*`,
   `image-to-code`, `stitch-design-taste`, `emil-design-eng`,
   `full-output-enforcement`, `gpt-taste`, `high-end-visual-design`,
   `industrial-brutalist-ui`, `llm-council`, `minimalist-ui`,
   `redesign-existing-projects`.
   Trifft ein Skill zu → ich rufe ihn **explizit** auf (z. B. `/ponytail-review`),
   statt die Aufgabe direkt selbst zu implementieren. Bei Unsicherheit gilt:
   lieber einen Skill zu viel geprüft als einen relevanten übersehen.

3. **Umsetzen** gemäß Blueprint und den in Schritt 2 gewählten Skills.
   Wo sinnvoll: `tdd-workflow`-Skill (Tests zuerst). Bei größeren/unabhängigen
   Teilaufgaben: Git-Worktree-Parallelisierung nutzen.

4. **`/code-review`** — Qualitäts- und Security-Pass durch den Code-Reviewer-Agent.

5. **`/security-scan`** (AgentShield) — Pflicht vor jedem Commit.

6. **Doku aktualisieren** (siehe unten, via Templates).

7. **Changelog-Eintrag** ergänzen (`Doku/Pizza/Changelog.md`).

8. **TODO** pflegen (`Doku/Pizza/TODO.md`).

9. Größere Entscheidung? → **ADR** anlegen (`Doku/Pizza/Entscheidungen/`).

Der Security-Reviewer/AgentShield-Agent wird zusätzlich automatisch bei
sicherheitsrelevanten Änderungen (Auth, Payments, Datenzugriff) hinzugezogen,
auch außerhalb von Schritt 5.

## Skill-Priorität (verbindlich)

Installierte, aktivierte Skills haben **Vorrang** vor meinem Standardverhalten.
Ich implementiere eine Aufgabe nicht "einfach so", wenn ein passender Skill
existiert — auch wenn ich die Aufgabe auch ohne Skill lösen könnte. Bin ich
unsicher, ob ein Skill passt, liste ich kurz die Kandidaten auf und wähle den
naheliegendsten, statt den Skill-Schritt zu überspringen.

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

## Verlinkung (Obsidian-Graph) — verbindlich

Der Obsidian-Graph entsteht **nur** durch Links. Deshalb gilt für jede Doku-Notiz:

- **Interne Verweise IMMER als Obsidian-Wikilink** `[[Dateiname]]` bzw. `[[Dateiname|Anzeigetext]]` —
  **nicht** als relativer Markdown-Link (`[Text](../pfad.md)`). Wikilinks überleben Umbenennungen,
  haben Autovervollständigung und erscheinen sauber im Graph.
- Bei mehrdeutigen Dateinamen (es gibt mehrere `README.md`) den Ordner mitangeben:
  `[[Frontend/README|Frontend-Doku]]`.
- **Keine Waisen:** Jede neue Notiz verlinkt mindestens die Nabe [[00_CONTEXT]] zurück und ihre
  fachlich verwandten Notizen (Feature ↔ ADR ↔ Seite ↔ Changelog/TODO). Index-/README-Seiten
  verlinken ihre Kinder, ADRs verlinken den [[Entscheidungen/README|ADR-Index]].
- Neue ADRs zusätzlich in die Index-Tabelle in `Entscheidungen/README.md` eintragen.
- Einstiegspunkt und Zentrum des Vaults ist `Doku/Pizza/00_CONTEXT.md`.

## Session-Tracking (automatisch)

- Am **Session-Ende** läuft automatisch der `SessionEnd`-Hook und schreibt Dauer,
  Tokens und geschätzte Kosten nach `Doku/Pizza/Tracking/Session-Log.md`.
- **Meine Aufgabe:** Bevor die Session endet, trage ich unter dem Punkt
  „Was wurde gemacht" des jeweiligen (oder eines neuen) Session-Log-Eintrags eine
  kurze Stichpunktliste der umgesetzten Arbeit ein. Die harten Zahlen kommen vom Hook.

## Wiederverwendung

`Doku/`, diese `CLAUDE.md` und der Hook in `.claude/settings.json` sind projektunabhängig
gestaltet und lassen sich in neue Website-Projekte kopieren. Das Tracking-Script leitet den
Log-Pfad dynamisch aus dem Projektnamen ab.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
