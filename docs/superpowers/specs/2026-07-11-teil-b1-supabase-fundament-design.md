# Design: Teil-B1 — Supabase-Fundament + Auth (voller Cutover)

- **Datum:** 2026-07-11
- **Status:** genehmigt (User-Freigabe des Designs)
- **Kontext:** Erstes Sub-Projekt von Teil-B. Löst die localStorage-Mocks des Teil-A-Frontends (`Frontend/`, Vite + React 18 + TS + Tailwind v4 + shadcn, Bun) durch ein echtes Supabase-Backend ab. Nutzt die in Teil-A gebaute async-Naht (`lib/data/store.ts`, `hooks/use-auth.tsx`).

## Teil-B-Zerlegung (Kontext)

Teil-B ist mehrteilig; jedes Sub-Projekt bekommt eigenen Spec→Plan→Umsetzung-Zyklus:

- **B1 (dieses Dokument):** Supabase-Fundament + Auth + voller Datenschicht-Cutover.
- **B2:** Bestell-Status + Realtime. *(baut auf B1)*
- **B3:** WhatsApp via CallMeBot (Edge Function bei Bestell-Insert). *(baut auf B1)*
- **B4:** Serverseitige Vorlauf-/Preis-Validierung. *(baut auf B1)*

## Ziel (B1)

Voller Cutover auf Supabase: Auth (E-Mail), `profiles` + alle Domänentabellen (Zutaten, Soßen, Gutscheine, Config, Bestellungen), RLS, und Umbau von `store.ts`/`use-auth.tsx` von localStorage auf `@supabase/supabase-js`. Die async-Signaturen bleiben unverändert — die UI ändert sich nur dort, wo die E-Mail-Umstellung es erzwingt.

## Voraussetzungen & Umgebungs-Realität (verbindlich)

- **Der Nutzer betreibt Supabase.** Er legt ein Supabase-Projekt an, führt die Migrationen aus (Supabase CLI oder Dashboard-SQL-Editor) und testet gegen sein Projekt.
- **Diese Umgebung ist headless/ohne Supabase-Zugriff.** Wir schreiben Code + SQL-Migrationen + Edge Function und verifizieren hier nur **Typecheck/Build** sowie die unveränderten reinen Logik-Tests. Echtes Ausführen/Klick-Testen macht der Nutzer.
- **Keys:** Werte aus Dashboard → Project Settings → API.
  - `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` → `Frontend/.env.local` (gitignored). Öffentlich, RLS schützt die Daten.
  - **service_role-Key: geheim.** Nur in der Edge Function (bei Supabase-hosted Functions automatisch injiziert). **Nie** ins Repo, **nie** mit `VITE_`-Präfix (nur `VITE_`-Vars landen im Browser-Bundle).
  - `.env.example` (Vorlage ohne echte Werte) wird committet.

## Nicht-Ziele (bewusste Grenzen)

- **Kein Realtime, kein Status-Workflow** (B2), **kein WhatsApp** (B3), **keine serverseitige Vorlauf-/Preis-Validierung** (B4). B1 behält die Client-Validierung aus Teil-A; die serverseitige Härtung kommt in B4.
- **Kein öffentliches Registrieren** — Admin legt Konten an (jetzt via Edge Function).
- **Warenkorb bleibt gerätelokal** (`useCart`, unverändert).

## Architektur

`@supabase/supabase-js` direkt hinter der bestehenden async-Naht. `store.ts`/`use-auth.tsx` behalten ihre Signaturen; nur die Innereien wechseln zu Supabase-Queries. **RLS** trägt die Sicherheit. **Eine Edge Function** (`admin-create-user`) nur für den privilegierten Fall „Admin legt Nutzer an" (braucht service_role). Verworfen: alles über Edge Functions als eigenes Backend-API (zu viel Code; serverseitige Validierung ist bewusst B4).

## Komponenten

### 1. Supabase-Client (`Frontend/src/lib/supabase.ts`, NEU)
Erstellt den Client aus `import.meta.env.VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`. Ein Singleton, importiert von `store.ts`/`use-auth.tsx`.

### 2. Schema (SQL-Migrationen in `supabase/migrations/`)

**`profiles`** (1:1 zu `auth.users`):
`id uuid PK REFERENCES auth.users(id) ON DELETE CASCADE`, `first_name text`, `last_name text`, `phone text`, `role text NOT NULL DEFAULT 'customer' CHECK (role IN ('customer','admin'))`, `active boolean NOT NULL DEFAULT true`, `created_at timestamptz DEFAULT now()`.
- **Trigger** `on auth.users insert`: legt automatisch eine `profiles`-Zeile an und übernimmt `first_name/last_name/phone/role` aus `new.raw_user_meta_data` (falls gesetzt; sonst Defaults).

**Domänentabellen:**
- `ingredients`: `id text PK`, `name`, `emoji`, `category`, `available boolean`, `description`.
- `sauces`: `id text PK`, `name`, `emoji`, `color`, `available boolean`.
- `vouchers`: `id text PK`, `name`, `code`, `type` (`percent|fixed|ingredient`), `value numeric`, `ingredient_name text`, `expires_at date`, `active boolean`, `max_uses int`, `uses int`.
- `app_config`: Ein-Zeilen-Tabelle (`id int PK DEFAULT 1 CHECK (id=1)`), `days jsonb`, `hours jsonb`, `lead_time_days int`, `service jsonb`.
- `orders`: `id text PK` (die `#xxxxx`-Nummer), `user_id uuid REFERENCES auth.users`, `items jsonb` (Pizzas verschachtelt wie `OrderData.items`), `subtotal/discount/total numeric`, `free_ingredient text`, `service_mode text`, `pickup_date text`, `pickup_time text`, `notes text`, `voucher_code text`, `status text NOT NULL DEFAULT 'eingegangen'` (Vorbereitung B2), `created_at timestamptz DEFAULT now()`.

> **Namens-Mapping:** DB nutzt `snake_case`, die TS-Typen `camelCase`. Die Umsetzung mappt in `store.ts` (kleine `rowTo*`/`*ToRow`-Helfer), damit die `@/types`-Interfaces **unverändert** bleiben.

### 3. RLS & Rollen
- Helper `is_admin()` als **`SECURITY DEFINER`**-Funktion (liest die Rolle des Aufrufers aus `profiles`; SECURITY DEFINER umgeht RLS und **verhindert die Rekursion**, die entstünde, wenn `profiles`-Policies wieder `profiles` abfragen).
- **RLS aktiv auf allen Tabellen.**
- **`profiles`:** jeder liest/ändert die **eigene** Zeile (Update ohne `role`/`active`/`id` — via `WITH CHECK`/Spalten-Trigger abgesichert); Admins lesen/schreiben alle.
- **`ingredients`/`sauces`/`vouchers`/`app_config`:** alle **authentifizierten** Nutzer lesen; nur Admins schreiben.
- **`orders`:** Kunde `INSERT` mit `user_id = auth.uid()`; Kunde `SELECT` eigene; Admins `SELECT`/`UPDATE` alle.

### 4. Auth (E-Mail) — `use-auth.tsx`-Umbau
- Login = **E-Mail + Passwort** über `supabase.auth.signInWithPassword`.
- `AuthProvider` hört auf `supabase.auth.onAuthStateChange`; beim Session-Start lädt er die `profiles`-Zeile. `currentUser` = `{ id, email, firstName, lastName, phone, role, active }` (aus Auth-User + Profil zusammengesetzt).
- `logout` → `supabase.auth.signOut`. `updateOwnProfile` → `profiles`-Update (nie `role`/`active`; E-Mail-Änderung via `supabase.auth.updateUser`).
- **Passwort vergessen:** Link auf der Login-Seite → `supabase.auth.resetPasswordForEmail` (Reset-Seite `/passwort-reset` mit `updateUser({ password })`).
- **`inactive`-Nutzer:** nach Login prüft die App `profile.active`; inaktiv → sofort `signOut` + Hinweis. *(RLS-seitige Härtung optional in B4.)*

### 5. Erster Admin (Bootstrap)
Da nur Admins Nutzer anlegen: der Nutzer legt **Mo einmalig im Dashboard** an (Auth → Add user, mit E-Mail + Passwort). Der Insert-Trigger erzeugt ein `profiles` mit `role='customer'`; danach setzt der Nutzer per SQL `update profiles set role='admin' where id = (select id from auth.users where email='<mo-email>')`. In der SETUP-Anleitung Schritt für Schritt.

### 6. Admin legt Nutzer an → Edge Function `admin-create-user`
`supabase/functions/admin-create-user/`: prüft per JWT, dass der Aufrufer Admin ist, ruft `auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { first_name, last_name, phone, role } })` (service_role). Der Trigger legt das Profil an. Die Admin-Nutzerverwaltung (`users-page.tsx`) ruft diese Function via `supabase.functions.invoke` statt eines direkten Inserts. Aktiv/inaktiv/löschen/Passwort-Reset: Admin-Updates auf `profiles` (RLS erlaubt Admins) bzw. für Passwort-Reset ein weiterer Function-Aufruf (`auth.admin.updateUserById`).

### 7. Datenschicht-Umbau — `store.ts`
Jede Funktion → Supabase-Query, Signaturen **unverändert**:
`getMenu/getIngredients/getSauces/getVouchers/getConfig/getUsers` → `select`; `saveIngredients/saveSauces/saveVouchers/saveConfig/saveUsers` → `upsert`/`update`; `verifyLogin` entfällt (Auth macht das jetzt Supabase); `createOrder` → `insert` in `orders` (Preis-/Gutschein-Berechnung bleibt vorerst client-seitig wie in Teil-A; Härtung = B4). `getDashboardStats` **bleibt in B1 Mock** (echte Aggregation ist YAGNI für den Cutover, kommt später).

### 8. Seeding
Seed-Migration schreibt die Teil-A-Defaults (Zutaten, Soßen, Gutscheine, `app_config`) in die DB (Werte aus `seed.ts`). So ist das Menü nach dem Setup sofort befüllt.

### 9. Teil-A-UX-Anpassungen (Folge der E-Mail-Umstellung)
- **Login-Seite:** E-Mail-Feld statt Benutzername + „Passwort vergessen?"-Link.
- **Profil:** E-Mail (via Supabase änderbar) statt Benutzername.
- **Admin-Nutzerverwaltung:** E-Mail-Feld beim Anlegen; Liste zeigt E-Mail.
- **Typen (`@/types`):** `User.username` → entfällt zugunsten `email`; `password` wandert aus dem Client-Typ (Supabase hält es). `User` wird zu `{ id, email, firstName, lastName, phone, role, active }`.

### 10. Tests & Verifikation
- **Bleiben grün:** reine Logik-Tests (`pricing`, `slots`, `sauces`, `auth`-Helper `redirectFor`; `usernameTaken`→`emailTaken` inkl. Test-Anpassung).
- **Entfallen/ersetzt:** die Mock-Auth-Unit-Tests, die die localStorage-Auth prüften (`hooks/__tests__/use-auth.test.tsx`, `lib/data/__tests__/users.test.ts`) — diese Auth existiert nicht mehr; sie werden gelöscht (Supabase-Auth wird gegen das echte Projekt getestet, nicht als Unit-Test gemockt).
- **Store/Auth werden zu dünnen Supabase-Wrappern** → hier **nur `bun run build`** (Typecheck). Supabase in Unit-Tests zu mocken ist für B1 bewusst **nicht** Ziel (echte Verifikation läuft gegen das Projekt des Nutzers).
- **SETUP-Anleitung** (`Doku/Pizza/…` + `Frontend/README.md`): Projekt anlegen → Migrationen ausführen → Seed → Mo als Admin → `.env.local` füllen → `bun run dev` → Klick-Test.

## Betroffene Dateien

**Neu:** `Frontend/src/lib/supabase.ts`, `Frontend/.env.example`, `supabase/migrations/*.sql` (Schema, RLS, Seed), `supabase/functions/admin-create-user/index.ts`, `Frontend/src/pages/auth/reset-password-page.tsx` (Passwort-Reset), SETUP-Doku, ADR-0006 (Supabase-Cutover).

**Geändert:** `Frontend/src/types/index.ts` (`User`: email statt username/password), `Frontend/src/lib/data/store.ts` (Supabase-Queries + row-Mapping), `Frontend/src/hooks/use-auth.tsx` (Supabase Auth), `Frontend/src/pages/login/login-page.tsx` (E-Mail + Passwort-vergessen), `Frontend/src/pages/profile/profile-page.tsx` (E-Mail), `Frontend/src/pages/admin/users-page.tsx` (E-Mail + Edge-Function-Aufruf), `Frontend/src/router.tsx` (Reset-Route), `Frontend/src/lib/auth.ts` (`usernameTaken`→`emailTaken`), `Frontend/package.json` (`@supabase/supabase-js`), `.gitignore` (`.env.local`, `supabase/.temp` etc.).

**Ggf. entfernt/reduziert:** `Frontend/src/lib/data/seed.ts` (Defaults wandern in die Seed-Migration; die `USERS_DEFAULT`-Mock-Nutzer entfallen — Bootstrap via Dashboard). `verifyLogin` aus `store.ts`.

## Sicherheit

- Passwörter liegen **nicht mehr im Client/Repo** — Supabase Auth hält sie gehasht. Der Klartext-Mock aus Teil-A entfällt.
- **service_role-Key niemals im Frontend/Repo** (nur Edge Function). Nur `VITE_`-Vars sind client-sichtbar.
- RLS ist die Sicherheitsgrenze; `is_admin()` als SECURITY DEFINER (rekursionsfrei). Client-seitige Preis-/Vorlauf-Berechnung bleibt vorerst manipulierbar → in **B4** serverseitig gehärtet (dokumentierter Rest-Risiko-Hinweis).

## Definition of Done

- `bun run build` grün (Typecheck über alle umgebauten Dateien); reine Logik-Tests grün.
- Migrationen (Schema + RLS + Seed) + Edge Function liegen unter `supabase/`; `.env.example` + SETUP-Anleitung vorhanden.
- Nach dem Setup (durch den Nutzer): Login mit E-Mail funktioniert gegen Supabase; Rolle steuert Zugang; Admin legt Nutzer via Edge Function an; Menü/Soßen/Gutscheine/Config kommen aus der DB; Bestellung landet in `orders`; Passwort-vergessen schickt Mail.
- Keine Referenzen mehr auf den localStorage-Auth-Mock (`verifyLogin`, `USERS_DEFAULT`) bzw. Klartext-Passwörter.
- ADR-0006 + Doku (Changelog/README/SETUP) aktualisiert.
