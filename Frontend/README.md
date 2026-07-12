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

Alle Daten laufen **ausschließlich** über `lib/data/store.ts` (async). Seit Teil-B1 ist das
kein Mock mehr, sondern echtes Supabase-Postgres (RLS-abgesichert) — siehe Abschnitt
„Supabase (Teil-B1)" unten. Die UI blieb beim Umstieg unverändert; nur `store.ts` wurde ersetzt.

## Accounts & Login

Ein Login (`/login`) für alle Nutzer — die **Rolle** entscheidet über den Zugang, nicht separate
Logins. **Auth ist jetzt E-Mail-basiert** (Supabase Auth, seit Teil-B1; vorher Benutzername-Mock).
Start-Admin „Mo" wird gemäß [SETUP-Supabase.md](../Doku/Pizza/SETUP-Supabase.md) per Dashboard
angelegt und per SQL zu `admin` befördert.

- **Profil** (`/profil`): eigenen Namen/Telefon/Passwort bearbeiten.
- **Admin-Nutzerverwaltung** (`/admin/nutzer`): Nutzer anlegen, Rolle setzen, aktiv/inaktiv
  schalten, löschen, Passwort zurücksetzen — läuft über die Edge Function `admin-users`
  (service_role, serverseitig). Ein Admin kann sich nicht selbst aussperren oder löschen
  (Selbstschutz).
- Passwort-Reset per E-Mail-Link verfügbar.
- Der frühere localStorage-Mock (Klartext-Passwörter, [ADR-0005](../Doku/Pizza/Entscheidungen/ADR-0005-mock-auth-naht.md))
  ist vollständig entfernt; Passwörter werden von Supabase gehasht verwaltet.

## Supabase (Teil-B1)

Domänendaten, Bestellungen und Auth laufen über ein echtes Supabase-Projekt
(siehe [ADR-0006](../Doku/Pizza/Entscheidungen/ADR-0006-supabase-cutover.md)).

- **Setup:** vollständige Schritt-für-Schritt-Anleitung (Projekt anlegen, Migrationen, Edge
  Function deployen, Bootstrap-Admin, Env, Klick-Test, Signup deaktivieren) in
  [Doku/Pizza/SETUP-Supabase.md](../Doku/Pizza/SETUP-Supabase.md).
- **Env:** `.env.example` nach `.env.local` kopieren, `VITE_SUPABASE_URL` +
  `VITE_SUPABASE_ANON_KEY` (Dashboard → Settings → API) eintragen. Der `service_role`-Key gehört
  **nie** ins Frontend/Repo — er läuft nur in der Edge Function `admin-users`.
- **Auth ist jetzt E-Mail-basiert** — kein Benutzername-Login mehr.
- Diese Entwicklungsumgebung hat keinen Netzwerkzugriff auf Supabase — verifiziert wurden hier
  nur Build/Typecheck + reine Logik-Tests. Ausführung gegen ein echtes Projekt erfolgt durch den
  Betreiber gemäß SETUP-Anleitung.

## Bestellungen: Status, Validierung & Digest (Teil-B2/B4/B3)

- **Status + Realtime (B2):** Bestellungen haben einen Status (`eingegangen`/`in_arbeit`/`fertig`/
  `abgeholt`/`storniert`, Migration `0004`). Kunde sieht seine Bestellungen unter `/bestellungen`
  mit Badge, Admin ändert den Status unter `/admin/bestellungen`; Live-Update via Supabase-Realtime
  (`hooks/use-orders-realtime.ts`) — **Betreiber muss Realtime für `orders` aktivieren**.
- **Serverseitige Validierung (B4):** der Postgres-Trigger `validate_order` (Migration `0005`)
  erzwingt Preis + Abhol-Slot beim Insert; der Checkout zeigt einen serverseitigen Reject als
  Fehlermeldung. Manipulierte Preise/ungültige Slots werden korrigiert/abgelehnt.
- **Täglicher Digest (B3):** Edge Function `daily-digest` (per `pg_cron`) schickt 18 Uhr (Berlin)
  alle heutigen Abholungen per WhatsApp (CallMeBot). Empfänger/Key/An-Aus unter
  `/admin/benachrichtigungen` (Tabelle `notify_config`, admin-only). Reine Logik in `lib/digest.ts`.
- **Vorbereitungs-/Einkaufs-Digest (B5):** derselbe 18-Uhr-Lauf schickt zusätzlich eine Liste für
  **morgen** (aggregierte Zutaten/Soßen je Anzahl Pizzen + Teiganzahl, `formatPrepList`), falls es
  Bestellungen für morgen gibt; idempotent über `notify_config.last_prep_date` (Migration `0008`).

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
