# Pizza-Frontend

Mobile-first Bestell-App (Vorbestellung + Abholung) — Vite + React 18 + TypeScript + Tailwind v4 + shadcn/ui.
**Paketmanager & Test-Runner: Bun.**

## Befehle

```bash
bun install         # Abhängigkeiten
bun run dev         # Dev-Server → http://localhost:5173
bun run build       # tsc -b && vite build → dist/
bun test src        # Unit-/Component-Tests (bun:test + happy-dom)
bun run test:e2e    # E2E (Playwright) — Browser nötig, siehe Hinweis unten
```

## Ordnerstruktur

```
src/
├── app.tsx · main.tsx · router.tsx      App-Root, Routing
├── types/                               Domänentypen
├── lib/
│   ├── pricing.ts · slots.ts            reine, getestete Logik (Preis/Gutschein, Slots/Vorlaufzeit)
│   ├── recommendations.ts               Zutaten-Empfehlungen
│   └── data/{seed,store}.ts             async Datenschicht (localStorage-Naht)
├── hooks/                               useAsync, useCart, useConfigEditor, useAuth
├── components/{ui,pizza,common,layout}  Primitives, Pizza-SVG, Charts, Layouts
└── pages/{menu,configurator,checkout,confirmation,admin}
tests/e2e/                               Playwright Happy-Path
```

## Daten (wichtig)

Alle Daten laufen **ausschließlich** über `lib/data/store.ts` (async).
Aktuell Mock/`localStorage` mit künstlichem Delay — **das ist die Naht für Teil-B (Supabase).**
Die UI bleibt dabei unverändert; nur `store.ts` wird ersetzt.

## Accounts & Login

Ein Login (`/login`) für alle Nutzer — die **Rolle** entscheidet über den Zugang, nicht separate
Logins. Start-Admin: Benutzername `Mo`, Passwort `pizza` (im Profil änderbar).

- **Profil** (`/profil`): eigenen Namen/Telefon/Passwort bearbeiten, Benutzername read-only.
- **Admin-Nutzerverwaltung** (`/admin/nutzer`): Nutzer anlegen, Rolle setzen, aktiv/inaktiv
  schalten, löschen, Passwort zurücksetzen. Ein Admin kann sich nicht selbst aussperren
  (letzter aktiver Admin ist geschützt).
- **Sicherheitshinweis:** Passwörter liegen **im Klartext** in `localStorage`
  (`lib/auth.ts`, Key `pizza-users`) — reiner Mock, nur lokal, siehe
  [ADR-0005](../Doku/Pizza/Entscheidungen/ADR-0005-mock-auth-naht.md).
  **Teil-B ersetzt dies durch echte Supabase-Auth** (gehashte Passwörter, RLS).

## Admin

- Zugang: über Login (`/login`) mit einem Account der Rolle `admin`; kein separates Admin-Passwort mehr.
- Konfigurierbar: Bestelltage, Öffnungszeiten, **Vorlaufzeit** (Default 3 Tage), Zutaten, Gutscheine, **Soßen**, **Service-Modus**, **Nutzer** (`/admin/nutzer`).
- **Vorlaufzeit:** Frühester Abholtag = heute + Vorlaufzeit. Wirkt direkt auf die Datumsauswahl im Checkout.

## Soßen

Admin-verwaltbar unter `/admin/sossen`. Jede Soße hat eine Farbe, die die `PizzaSVG`-Vorschau
im Konfigurator/Warenkorb einfärbt (`resolveSauce()` in `lib/sauces.ts` löst die Soßen-id auf,
mit Fallback auf die erste verfügbare Soße). Die Soße ist im pauschalen 10€-Pizzapreis enthalten,
sie ändert den Preis nicht.

## Favoriten

Bis zu 5 eigene Pizzen lassen sich als Favorit speichern (`useFavorites`, `FavoritesProvider`,
localStorage-persistent unter dem Key `pizza-favorites`). Nutzbar im Konfigurator (Speichern)
und auf der Speisekarte (`favorites-bar.tsx`, schnelles Hinzufügen zum Warenkorb).

## Service-Modus

Admin-schaltbar unter `/admin/service` (Vor Ort / Abholen, `availableServiceModes()` in
`lib/slots.ts`). Wirkt auf Checkout (Auswahl, falls beide Modi aktiv), Bestätigungsseite und
den Speisekarten-Header.

## E2E-Hinweis

`bun run test:e2e` nutzt System-Chrome (`channel: "chrome"`). In manchen Umgebungen ist
kein Browser lauffähig; dann lokal ausführen mit `bunx playwright install chromium` und
`playwright.config.ts` ggf. auf das gebündelte Chromium zurückstellen.
