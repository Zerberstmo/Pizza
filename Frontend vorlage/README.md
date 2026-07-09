# 🍕 Pizzeria Bestellsystem

Eine moderne, mobile-optimierte Pizza-Bestellplattform für eine private Pizzeria mit Abholung.  
Gebaut mit **React 18 · TypeScript · Tailwind CSS · shadcn/ui · Vite**.

---

## Inhaltsverzeichnis

1. [Features](#features)
2. [Technologie-Stack](#technologie-stack)
3. [Lokal starten](#lokal-starten)
4. [Projektstruktur](#projektstruktur)
5. [Benutzeroberfläche](#benutzeroberfläche)
6. [Admin-Bereich](#admin-bereich)
7. [Gutschein-System](#gutschein-system)
8. [Warenkorb & Bestellung](#warenkorb--bestellung)
9. [Deployment (GitHub Pages)](#deployment-github-pages)
10. [Passwort & Sicherheit](#passwort--sicherheit)

---

## Features

- **Speisekarte** mit 4 festen Standard-Pizzen (klickbar → direkt in den Warenkorb)
- **Pizza-Konfigurator** zum freien Zusammenstellen eigener Pizzen
- **Warenkorb** für mehrere Pizzen gleichzeitig (Standard + Eigene kombinierbar)
- **Gutscheine** — Prozentrabatt, fester Betrag und Sonderzutat (z.B. Weed 🌿)
- **Bemerkungsfeld** bei der Bestellung (Allergien, Sonderwünsche)
- **Nur erlaubte Abholtage & -zeiten** – vom Admin konfigurierbar, Kunden sehen nur offene Slots
- **QR-Code** zur Abholung nach jeder Bestellung
- **Admin-Bereich** mit Dashboard, Zutatenverwaltung, Gutscheinverwaltung, Öffnungszeiten
- **Live Pizza-Vorschau** im Konfigurator – Zutaten erscheinen sofort auf der Pizza-Grafik
- Vollständig **mobil-optimiert** (Mobile First, große Touch-Flächen)

---

## Technologie-Stack

| Technologie | Version | Zweck |
|---|---|---|
| React | 18.3.1 | UI-Framework |
| TypeScript | — | Typsicherheit |
| Vite | 6.3.5 | Build-Tool & Dev-Server |
| Tailwind CSS | 4.1.12 | Styling |
| shadcn/ui | — | UI-Komponenten (Button, Card, Input, Switch…) |
| Radix UI | — | Accessible Primitives |
| Motion (Framer) | 12.x | Animationen |
| Lucide React | 0.487 | Icons |
| pnpm | 9.x | Paketmanager |

---

## Lokal starten

### Voraussetzungen

- **Node.js** ≥ 20 — [nodejs.org](https://nodejs.org)
- **pnpm** — `npm install -g pnpm`

### Setup

```bash
# 1. Repository klonen
git clone https://github.com/dein-nutzername/dein-repo.git
cd dein-repo

# 2. Abhängigkeiten installieren
pnpm install

# 3. Entwicklungsserver starten
pnpm dev
```

→ Die App ist erreichbar unter **http://localhost:5173**

### Weitere Befehle

```bash
pnpm dev        # Dev-Server mit Hot-Reload
pnpm build      # Produktions-Build → dist/
pnpm preview    # Lokale Vorschau des Produktions-Builds
```

---

## Projektstruktur

```
/
├── index.html                  # HTML-Einstiegspunkt
├── vite.config.ts              # Vite-Konfiguration
├── tsconfig.json               # TypeScript-Konfiguration
├── package.json
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Actions Pipeline
└── src/
    ├── main.tsx                # React-Einstiegspunkt
    ├── app/
    │   └── App.tsx             # Hauptkomponente (gesamte App-Logik)
    ├── components/
    │   └── ui/                 # shadcn/ui-Komponenten
    │       ├── button.tsx
    │       ├── card.tsx
    │       ├── badge.tsx
    │       ├── input.tsx
    │       ├── label.tsx
    │       ├── switch.tsx
    │       ├── separator.tsx
    │       ├── tabs.tsx
    │       ├── progress.tsx
    │       ├── textarea.tsx
    │       └── scroll-area.tsx
    ├── lib/
    │   └── utils.ts            # cn()-Hilfsfunktion (clsx + tailwind-merge)
    └── styles/
        ├── index.css           # CSS-Einstiegspunkt
        ├── fonts.css           # Google Fonts Import
        ├── theme.css           # Design-Tokens (Farben, Radius…)
        ├── tailwind.css        # Tailwind-Direktiven
        └── globals.css
```

---

## Benutzeroberfläche

### Navigation

Die App hat eine **Bottom Navigation** mit drei Tabs:

| Tab | Funktion |
|---|---|
| **Speisekarte** | Startseite mit den 4 Standard-Pizzen |
| **Eigene Pizza** | Konfigurator zum freien Zusammenstellen |
| **Warenkorb** | Zeigt Anzahl der Pizzen (Badge) + Checkout |
| **Admin** | Weiterleitung zum Admin-Login |

### Bestell-Flow

```
Speisekarte
  └─ Pizza auswählen → In den Warenkorb
       │
Konfigurator
  └─ Zutaten wählen → + Warenkorb
       │
Warenkorb (Checkout)
  ├─ Pizzen prüfen / entfernen
  ├─ Name, Telefon eingeben
  ├─ Abholdatum & -uhrzeit wählen (nur erlaubte Slots)
  ├─ Bemerkungen eingeben
  ├─ Gutschein einlösen
  └─ Jetzt bestellen →
       │
Bestätigung
  ├─ Bestellnummer
  └─ QR-Code zur Abholung
```

### Standard-Pizzen (Speisekarte)

Nur diese 4 Pizzen sind für Kunden sichtbar:

| # | Name | Zutaten |
|---|---|---|
| 01 | **Margherita** | Mozzarella, Rucola, Basilikum |
| 02 | **Salami** | Salami, Mozzarella |
| 03 | **Hawaii** | Schinken, Ananas, Mozzarella |
| 04 | **Speciale** | Salami, Schinken, Paprika, Pilze, Mozzarella |

Jede Pizza kostet **10,00 €** (fest, kein Aufpreis für Zutaten).

---

## Admin-Bereich

### Zugang

Erreichbar über den **Admin-Tab** in der Navigation.

> Das Passwort befindet sich in der Datei `src/app/App.tsx` in der Konstante `ADMIN_PASSWORD`.  
> Es sollte nach dem ersten Einsatz geändert und **niemals öffentlich geteilt** werden.

### Admin-Funktionen

#### Dashboard
Übersicht über Bestellungen, Umsatz und beliebteste Zutaten mit Diagrammen.

#### Bestelltage verwalten
Jeden Wochentag einzeln aktivieren oder deaktivieren.  
Deaktivierte Tage erscheinen **nicht** in der Datumsauswahl der Kunden.

| Status | Bedeutung |
|---|---|
| ✅ Aktiv | Bestellungen an diesem Tag möglich |
| ❌ Inaktiv | Kunden sehen diesen Tag nicht |

#### Öffnungszeiten verwalten
Start- und Endzeit festlegen.  
Kunden können **nur Uhrzeiten innerhalb dieser Zeiten** in 15-Minuten-Schritten wählen.

#### Zutaten verwalten
- Zutaten aktivieren / deaktivieren (deaktivierte erscheinen grau im Konfigurator)
- Zutaten löschen
- **Neue Zutat hinzufügen** (Emoji, Name, Kategorie, Beschreibung)

#### Gutscheine verwalten
Gutscheine erstellen, aktivieren/deaktivieren und löschen.  
→ Details siehe [Gutschein-System](#gutschein-system)

---

## Gutschein-System

### Gutschein-Typen

| Typ | Beschreibung | Beispiel |
|---|---|---|
| **Prozent** | Prozentualer Rabatt auf den Gesamtbetrag | 10% → 2,00 € bei 2 Pizzen |
| **Fester Betrag** | Fixer Abzug vom Gesamtbetrag | 5 € Rabatt |
| **Sonderzutat** | Kostenlose Sonderzutat (frei wählbar) | Weed 🌿 gratis |

### Vorkonfigurierte Codes

| Code | Typ | Wert | Status |
|---|---|---|---|
| `WELCOME10` | Prozent | 10% | Aktiv |
| `SOMMER15` | Prozent | 15% | Aktiv |
| `PIZZA5` | Fester Betrag | 5 € | Inaktiv |
| `WEED420` | Sonderzutat | Weed 🌿 | Aktiv |

> Codes können jederzeit im Admin-Bereich unter **Gutscheine** geändert, deaktiviert oder gelöscht werden.

### Gutschein erstellen (Admin)

1. Admin → Gutscheine → **Neuer Gutschein**
2. Name, Code, Typ und Wert eingeben
3. Ablaufdatum und maximale Nutzungsanzahl festlegen
4. **Erstellen** klicken

---

## Warenkorb & Bestellung

### Mehrere Pizzen bestellen

1. Beliebige Pizza auf der Speisekarte antippen → wird in den Warenkorb gelegt
2. Weitere Pizzen hinzufügen (oder über **Eigene Pizza** selbst konfigurieren)
3. Der **Warenkorb-Tab** zeigt die aktuelle Anzahl als Badge
4. Im Warenkorb können einzelne Pizzen mit **×** entfernt werden
5. Direkt aus dem Warenkorb weitere Standard- oder eigene Pizzen hinzufügen

### Preisberechnung

```
Anzahl Pizzen × 10,00 €
− Gutscheinrabatt (falls eingelöst)
= Gesamtpreis
```

Bezahlung erfolgt **bar bei Abholung**.

### Sonderzutat-Gutschein

Wird ein Sonderzutat-Gutschein eingelöst, erscheint die Zutat in der Bestellübersicht und auf dem Bestätigungszettel. Die Zutat wird dem Pizzabäcker mitgeteilt – sie ist nicht Teil des digitalen Zutatensystems.

---

## Deployment (GitHub Pages)

### Einmalige Einrichtung

**1. `vite.config.ts` anpassen** – `base` auf den Repo-Namen setzen:

```ts
// vite.config.ts
base: '/dein-repo-name/',
```

**2. Workflow-Datei anlegen** – `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - run: pnpm install

      - run: pnpm build

      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

      - uses: actions/deploy-pages@v4
        id: deployment
```

**3. GitHub Pages aktivieren:**  
Repository → Settings → Pages → Source: **GitHub Actions**

### Deployment auslösen

```bash
git add .
git commit -m "deploy: update pizza app"
git push origin main
```

→ GitHub Actions baut die App automatisch und veröffentlicht sie.  
→ Erreichbar unter: `https://dein-nutzername.github.io/dein-repo-name/`

---

## Passwort & Sicherheit

> ⚠️ **Wichtig:** Das Admin-Passwort wird aktuell clientseitig in der App gespeichert.  
> Das bedeutet: Jeder der den Quellcode lesen kann, kann das Passwort einsehen.  
> Für den privaten Gebrauch (Familie, Freunde) ist das ausreichend.  
> Für öffentliche Deployments sollte ein Backend mit echter Authentifizierung verwendet werden.

**Passwort ändern:**

In `src/app/App.tsx` die Konstante anpassen:

```ts
const ADMIN_PASSWORD = "dein-neues-passwort";
```

Danach neu builden und deployen.

---

## Lizenz

Privates Projekt – nicht für die kommerzielle Weiterverbreitung bestimmt.
