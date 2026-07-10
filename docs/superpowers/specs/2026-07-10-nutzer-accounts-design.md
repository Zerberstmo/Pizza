# Design: Nutzer-Accounts (Login, Profil, Admin-Nutzerverwaltung) — Teil-A-Erweiterung

- **Datum:** 2026-07-10
- **Status:** genehmigt (User-Freigabe des Designs)
- **Kontext:** Erweiterung des Teil-A-Frontends (`Frontend/`, Vite + React 18 + TS + Tailwind v4 + shadcn, Bun). Mock-/localStorage-Datenschicht bleibt die Naht für Teil-B (Supabase).

## Ziel

Ein **Account-System mit Rollen** für Teil-A, als localStorage-Mock (Naht → Teil-B Supabase-Auth):

1. **Login-Gate** — vor allem anderen muss man sich anmelden; die Rolle steuert den Zugang.
2. **Profil-Selbstbearbeitung** — jeder Nutzer ändert Vorname, Nachname, Telefon und Passwort selbst (Benutzername bleibt fest).
3. **Admin-Nutzerverwaltung** — der Admin legt Nutzer an, verwaltet sie (aktiv/inaktiv, löschen, Passwort zurücksetzen, Rolle).
4. **Checkout-Vorausfüllung** — Name + Telefon aus dem Profil, pro Bestellung editierbar.

## ⚠️ Sicherheits-Hinweis (verbindlich dokumentieren)

Der Mock speichert Passwörter **im Klartext** in `localStorage`. Das ist **ausschließlich** für die Teil-A-Attrappe vertretbar und **nicht betriebssicher**. Teil-B ersetzt die gesamte Auth-Schicht durch Supabase-Auth (serverseitig gehashte Passwörter, Sessions/JWT, RLS). Alle betroffenen Stellen tragen `TEIL-B TODO`-Marker.

## Nicht-Ziele / bewusste Grenzen

- **Keine öffentliche Registrierung** — geschlossenes System, nur der Admin legt Konten an.
- **Kein Passwort-Reset per E-Mail** — der Admin setzt Passwörter zurück (kein E-Mail-Feld im System).
- **Warenkorb bleibt gerätelokal** (nicht pro Nutzer) — unverändert.
- **Admin ist reines Management** — nach Login → Admin-Panel; bestellt nicht selbst.
- **Preis-/Bestell-Logik unverändert.**

---

## Datenmodell (`types/index.ts`)

```ts
export type Role = "customer" | "admin";

export interface User {
  id: string;
  username: string;   // Login-Kennung, eindeutig, admin-vergeben, unveränderlich
  password: string;   // TEIL-B TODO: Klartext nur im Mock → Supabase-Hash
  firstName: string;
  lastName: string;
  phone: string;
  role: Role;
  active: boolean;
}
```

## Seed (`lib/data/seed.ts`)

Ein Start-Admin (Bootstrapping, da nur Admins Nutzer anlegen):
```ts
export const USERS_DEFAULT: User[] = [
  { id: "u1", username: "Mo", password: "pizza", firstName: "Mo", lastName: "", phone: "", role: "admin", active: true },
];
```
`ADMIN_PASSWORD` entfällt (wird durch das Nutzersystem ersetzt).

## Datenschicht (`lib/data/store.ts`)

Neu (Naht → Teil-B):
```ts
export function getUsers(): Promise<User[]>;
export function saveUsers(list: User[]): Promise<void>;
export function verifyLogin(username: string, password: string): Promise<User | null>; // null bei falsch/inaktiv
```
`verifyLogin`: findet aktiven Nutzer mit passendem `username` + `password`; sonst `null`. `verifyAdminPassword` wird entfernt.

## Auth-Schicht (`hooks/use-auth.tsx`, NEU — ersetzt `use-admin-auth.ts`)

Context-Provider, aktueller Nutzer in `sessionStorage` (Key `pizza-auth`, gespeichert wird die `user.id`; der volle Nutzer wird beim Start aus `getUsers()` aufgelöst):
```ts
interface AuthContextValue {
  currentUser: User | null;
  loading: boolean;                                   // solange initialer getUsers-Load läuft
  login(username: string, password: string): Promise<User | null>;  // setzt currentUser bei Erfolg
  logout(): void;
  updateOwnProfile(patch: Partial<Pick<User,"firstName"|"lastName"|"phone"|"password">>): Promise<void>; // persistiert via saveUsers
}
export function useAuth(): AuthContextValue;
```
`updateOwnProfile` ändert nur den eigenen Datensatz (nie `username`/`role`/`id`) und persistiert die gesamte Nutzerliste.
`use-admin-auth.ts` wird gelöscht.

## Login-Gate & Routing (`router.tsx`, `app.tsx`, Guards)

- **`app.tsx`**: `AuthProvider` ganz außen (um `CartProvider`/`FavoritesProvider`).
- **Öffentliche Route** `/login` — einzige ohne Anmeldung. `LoginPage` (NEU, `pages/login/login-page.tsx`): Benutzername + Passwort, Fehleranzeige, Show-Passwort-Toggle. Bei Erfolg Weiterleitung nach Rolle: `customer` → `/`, `admin` → `/admin/dashboard`. Inaktiver/falscher Login → Fehlermeldung.
- **Guards** (kleine Wrapper-Komponenten, `components/layout/`):
  - `RequireAuth` (Rolle egal): kein `currentUser` → `<Navigate to="/login" replace />`.
  - `RequireCustomer`: kein Login → `/login`; Rolle `admin` → `/admin/dashboard`.
  - `RequireAdmin`: kein Login → `/login`; Rolle `customer` → `/`.
  - Während `loading` (initialer Auth-Load): neutraler Ladezustand statt Redirect (verhindert Flackern/Fehl-Redirect).
- **Routen:**
  - `/login` → `LoginPage` (public)
  - `AppLayout` (mit BottomNav) unter `RequireCustomer`: `/`, `/konfigurator`, `/warenkorb`, `/bestaetigung`
  - `/profil` unter `RequireAuth` (beide Rollen) — **eigenständige Seite ohne BottomNav** (eigener Header mit Zurück-Button + Abmelden), damit sie für Kunde **und** Admin funktioniert, ohne die Kunden-BottomNav für den Admin zu zeigen
  - `AdminLayout` unter `RequireAdmin`: bestehende `/admin/*` + neu `/admin/nutzer`
  - Die bisherige `/admin`-Login-Route entfällt; `pages/admin/login-page.tsx` wird gelöscht.

## BottomNav (`components/layout/bottom-nav.tsx`)

Der bisherige **„Admin"-Tab wird durch „Profil"** ersetzt (`/profil`, Icon `User`/`CircleUser`). Kunden sehen keinen Admin-Tab mehr (Admin gelangt über den rollenbasierten Login ins Panel).

## AdminShell (`components/layout/admin-shell.tsx`)

- Guard/Logout laufen über `useAuth` statt `useAdminAuth` (Rolle `admin`; `logout()` → `/login`).
- Header zeigt den angemeldeten Benutzernamen mit Link zu `/profil` (damit auch der Admin sein Passwort ändern kann).
- Neuer Nav-Punkt **„Nutzer"** (`/admin/nutzer`, Icon `Users`).

## Profil (`pages/profile/profile-page.tsx`, NEU)

- Route `/profil`, für **beide Rollen** (RequireAuth), **eigenständige Seite ohne BottomNav** (eigener Header mit Zurück-Button). Kunde erreicht sie über den „Profil"-Tab der BottomNav, Admin über den Benutzernamen-Link im AdminShell-Header.
- Felder: Vorname, Nachname, Telefon, **Passwort ändern** (mit Bestätigungsfeld). Benutzername wird angezeigt, ist aber **schreibgeschützt**.
- Speichern → `useAuth().updateOwnProfile(...)` (+ kurze „Gespeichert"-Rückmeldung).
- Abmelden-Button (`logout()` → `/login`).

## Checkout-Vorausfüllung (`pages/checkout/checkout-page.tsx`)

- Der lokale `customer`-State wird aus `useAuth().currentUser` (firstName, lastName, phone) **vorbelegt**, bleibt aber **pro Bestellung editierbar** (ändert das Profil nicht).
- Bestell-Logik/`createOrder` sonst unverändert.

## Admin-Nutzerverwaltung (`pages/admin/users-page.tsx`, NEU)

Nach dem Muster der Zutaten-/Gutschein-Seite (`mutate` = setState + `saveUsers`):
- **Anlegen**: Benutzername, Vorname, Nachname, Telefon, Startpasswort, Rolle (`customer`/`admin`). Validierung: Pflichtfelder + **eindeutiger Benutzername** (Fehlermeldung bei Duplikat).
- **Liste**: alle Nutzer mit Rolle-Badge, aktiv/inaktiv-Schalter, löschen.
- **Passwort zurücksetzen**: setzt ein neues Passwort für den Nutzer.
- Route `/admin/nutzer`, Nav-Eintrag in AdminShell.
- Selbstschutz: der aktuell angemeldete Admin kann sich **nicht selbst** löschen oder deaktivieren (sonst sperrt er sich aus).

## Tests (bun:test + happy-dom)

- **`verifyLogin`**: korrekt → User; falsches Passwort → null; unbekannter Benutzer → null; **inaktiver** Nutzer → null.
- **`useAuth`**: `login` setzt `currentUser` + sessionStorage; `logout` löscht; `updateOwnProfile` persistiert und lässt `username`/`role` unangetastet.
- **Nutzer anlegen**: doppelter Benutzername wird abgelehnt (reine Validierungsfunktion, z. B. `usernameTaken(list, name)`).
- **Guard-Logik**: reine Helper (z. B. `redirectFor(user, required)` → Zielpfad/`null`), getestet für die Rollen-Kombinationen.
- Bestehende Suite bleibt grün; Tests/Referenzen auf `useAdminAuth`/`verifyAdminPassword` werden auf das neue System umgestellt.

## Betroffene Dateien

**Neu:** `hooks/use-auth.tsx`, `pages/login/login-page.tsx`, `pages/profile/profile-page.tsx`, `pages/admin/users-page.tsx`, `components/layout/require-auth.tsx` (enthält `RequireAuth`/`RequireCustomer`/`RequireAdmin` + `redirectFor`-Helper), plus Tests (`lib/data/__tests__/users.test.ts` bzw. Ergänzungen, `hooks/__tests__/use-auth.test.tsx`).

**Geändert:** `types/index.ts`, `lib/data/seed.ts`, `lib/data/store.ts`, `app.tsx`, `router.tsx`, `components/layout/bottom-nav.tsx`, `components/layout/admin-shell.tsx`, `pages/checkout/checkout-page.tsx`.

**Gelöscht:** `hooks/use-admin-auth.ts`, `pages/admin/login-page.tsx`.

**Doku:** `Doku/Pizza/Changelog.md`, `Doku/Pizza/Frontend/README.md`, `Frontend/README.md` (Login/Profil/Nutzerverwaltung + Sicherheitshinweis); ADR sinnvoll (Mock-Auth als Naht → Supabase).

## Definition of Done

- Nicht angemeldet → jede Route leitet auf `/login`. Login mit `Mo`/`pizza` → Admin-Panel; falsch/inaktiv → Fehlermeldung.
- Admin legt einen Kunden an → dieser kann sich einloggen und sieht die Speisekarte.
- Kunde ändert Name/Telefon/Passwort im Profil (persistent); Checkout ist damit vorbelegt, pro Bestellung editierbar.
- Admin kann Nutzer anlegen/aktiv-inaktiv/löschen/Passwort-zurücksetzen; doppelter Benutzername abgelehnt; Admin kann sich nicht selbst sperren.
- Rollen-Guards greifen (Kunde kommt nicht ins Admin-Panel, Admin wird auf Panel geleitet).
- Build + alle Unit-Tests grün; keine Referenzen mehr auf `useAdminAuth`/`verifyAdminPassword`.
- Doku aktualisiert inkl. Klartext-Passwort-Sicherheitshinweis.
