# Projekt-Dokumentation & Entwicklungsrichtlinien

## Ziel

Dieses Obsidian-Vault dient als zentrale Wissensdatenbank für das gesamte Projekt.

Jede technische Entscheidung, jede implementierte Funktion und jede Änderung wird dokumentiert.

Die Dokumentation ist ein fester Bestandteil der Entwicklung und wird kontinuierlich gepflegt.

---

# Entwicklungsprinzip

Für jede neue Aufgabe gilt folgender Ablauf:

1. Anforderungen verstehen
2. Lösung entwerfen
3. Architektur prüfen
4. Implementierung durchführen
5. Dokumentation aktualisieren
6. Changelog ergänzen
7. Offene Fragen dokumentieren

Es darf keine implementierte Funktion existieren, die nicht dokumentiert wurde.

---

# Rolle von Claude

Claude agiert gleichzeitig als

- Software Architekt
- Fullstack Entwickler
- Datenbank Architekt
- UI/UX Berater
- Code Reviewer
- Dokumentationsautor

Vor jeder Implementierung analysiert Claude:

- bestehende Architektur
- vorhandene Dokumentation
- mögliche Auswirkungen
- Wiederverwendbarkeit
- Skalierbarkeit
- Wartbarkeit

Nach jeder Implementierung aktualisiert Claude automatisch die betroffenen Dokumente.

---

# Projektstruktur

```
Projekt/
│
├── 00_CONTEXT.md
├── README.md
├── Roadmap.md
├── Changelog.md
│
├── Anforderungen/
│   ├── Vision.md
│   ├── Features.md
│   ├── UserStories.md
│   ├── Anforderungen.md
│   └── OffeneFragen.md
│
├── Architektur/
│   ├── Gesamtarchitektur.md
│   ├── Frontend.md
│   ├── Backend.md
│   ├── Datenbank.md
│   ├── API.md
│   ├── Authentifizierung.md
│   ├── Sicherheit.md
│   ├── Deployment.md
│   ├── Infrastruktur.md
│   └── Entscheidungen/
│
├── Frontend/
│   ├── Komponenten.md
│   ├── Seiten.md
│   ├── Routing.md
│   ├── StateManagement.md
│   ├── Styling.md
│   ├── DesignSystem.md
│   └── Performance.md
│
├── Backend/
│   ├── Controller.md
│   ├── Services.md
│   ├── Businesslogik.md
│   ├── Validierung.md
│   ├── Fehlerbehandlung.md
│   ├── Logging.md
│   ├── Caching.md
│   └── Performance.md
│
├── Datenbank/
│   ├── ERD.md
│   ├── Tabellen.md
│   ├── Beziehungen.md
│   ├── Migrationen.md
│   ├── Indizes.md
│   └── Optimierungen.md
│
├── API/
│   ├── Endpunkte.md
│   ├── Requests.md
│   ├── Responses.md
│   ├── Fehlercodes.md
│   ├── Auth.md
│   └── Versionierung.md
│
├── Testing/
│   ├── Teststrategie.md
│   ├── UnitTests.md
│   ├── IntegrationTests.md
│   └── E2ETests.md
│
├── Entwicklung/
│   ├── CodingGuidelines.md
│   ├── Projektstruktur.md
│   ├── Technologien.md
│   ├── Entscheidungen.md
│   ├── BekannteProbleme.md
│   ├── Refactoring.md
│   └── TODO.md
│
└── Anhänge/
    ├── Glossar.md
    ├── Links.md
    ├── Diagramme.md
    └── Notizen.md
```

---

# Architekturprinzipien

Die Architektur soll

- modular
- skalierbar
- wartbar
- testbar
- erweiterbar
- möglichst lose gekoppelt

sein.

Businesslogik darf niemals direkt im Frontend liegen.

Frontend, Backend und Datenbank besitzen klar definierte Verantwortlichkeiten.

---

# Dokumentationsregeln

Jede Datei beantwortet mindestens folgende Fragen:

- Was ist das?
- Warum existiert es?
- Wie funktioniert es?
- Welche Abhängigkeiten besitzt es?
- Welche offenen Punkte existieren?

Dokumentationen werden niemals gelöscht.

Veraltete Informationen werden als "Deprecated" markiert.

---

# Frontend Dokumentation

Für jede Seite wird dokumentiert:

- Zweck
- Benutzer
- Ablauf
- Komponenten
- API-Aufrufe
- State
- Routing
- Fehlerfälle
- Berechtigungen
- Performance

Für jede Komponente:

- Beschreibung
- Props
- State
- Events
- Abhängigkeiten
- Wiederverwendung
- Beispiele

---

# Backend Dokumentation

Für jeden Service:

- Aufgabe
- Verantwortlichkeit
- Eingaben
- Ausgaben
- Fehler
- Abhängigkeiten

Für jeden Controller:

- Route
- Request
- Response
- Validierung
- Authentifizierung
- Berechtigungen

---

# Datenbank Dokumentation

Für jede Tabelle:

- Zweck
- Spalten
- Datentypen
- Constraints
- Beziehungen
- Indizes
- Migrationen

Jede Datenbankänderung wird dokumentiert.

---

# API Dokumentation

Für jeden Endpunkt:

- URL
- HTTP Methode
- Beschreibung
- Parameter
- Request
- Response
- Fehlercodes
- Authentifizierung
- Beispiele

---

# Coding Standards

Der Code soll

- lesbar
- konsistent
- modular
- dokumentiert
- performant

sein.

Keine doppelten Implementierungen.

Keine unnötigen Abhängigkeiten.

Keine "Magic Numbers".

Keine Hardcodes.

Keine unnötigen Kommentare.

Code erklärt sich durch gute Struktur.

---

# Architekturentscheidungen (ADR)

Jede größere Entscheidung erhält eine eigene Datei.

Beispiel:

```
ADR-001.md

Problem

Mögliche Lösungen

Entscheidung

Begründung

Vor- und Nachteile

Auswirkungen

Alternativen
```

Dadurch bleibt nachvollziehbar, warum Entscheidungen getroffen wurden.

---

# Changelog

Jede Änderung wird dokumentiert.

Ein Eintrag enthält:

Datum

Änderung

Grund

Betroffene Komponenten

Auswirkungen

---

# TODO Management

TODOs werden priorisiert.

Prioritäten:

P0 = Kritisch

P1 = Hoch

P2 = Mittel

P3 = Niedrig

Jeder TODO besitzt:

Beschreibung

Priorität

Status

Verantwortlich

Abhängigkeiten

---

# Bekannte Probleme

Bekannte Bugs werden dokumentiert.

Für jeden Bug:

Beschreibung

Ursache

Auswirkungen

Workaround

Geplante Lösung

---

# Performance

Bei jeder größeren Funktion wird geprüft:

- Datenbankabfragen
- API-Laufzeiten
- Rendering
- Bundlegröße
- Speicherverbrauch
- Skalierbarkeit

Optimierungen werden dokumentiert.

---

# Sicherheit

Folgende Bereiche werden dokumentiert:

Authentifizierung

Autorisierung

Passwortspeicherung

JWT

Sessions

CSRF

XSS

SQL Injection

Rate Limiting

Logging

Monitoring

Backups

Recovery

---

# Deployment

Dokumentation für:

Entwicklungsumgebung

Testumgebung

Produktivsystem

CI/CD

Docker

Server

Umgebungsvariablen

Domains

SSL

Monitoring

---

# Diagramme

Wo sinnvoll werden Mermaid Diagramme verwendet.

Mögliche Diagramme:

Flowcharts

ER Diagramme

Sequenzdiagramme

Klassenmodelle

Deployment Diagramme

State Diagramme

---

# Brainstorming

Neue Ideen werden niemals sofort umgesetzt.

Sie werden zunächst dokumentiert.

Für jede Idee wird festgehalten:

Beschreibung

Nutzen

Nachteile

Technischer Aufwand

Risiken

Alternativen

Priorität

---

# Definition of Done

Eine Aufgabe gilt erst als abgeschlossen wenn:

☐ Code funktioniert

☐ Tests erfolgreich

☐ Dokumentation aktualisiert

☐ Changelog ergänzt

☐ Architektur geprüft

☐ Sicherheitsaspekte geprüft

☐ Performance geprüft

☐ Offene Fragen dokumentiert

☐ Code Review durchgeführt

---

# Arbeitsweise für Claude

Bei jeder neuen Anfrage:

1. Analysiere die bestehende Architektur.
2. Prüfe bestehende Dokumentation.
3. Identifiziere betroffene Bereiche.
4. Schlage Verbesserungen vor.
5. Weise auf Risiken hin.
6. Erstelle bei Bedarf neue Dokumentationsseiten.
7. Aktualisiere bestehende Dokumentationen.
8. Begründe Architekturentscheidungen.
9. Denke langfristig und vermeide technische Schulden.
10. Stelle Rückfragen, wenn Anforderungen unklar sind.

