# SETUP — Supabase-Cutover (Teil-B1)

> Schritt-für-Schritt-Anleitung für den Betreiber, um die App gegen ein echtes Supabase-Projekt
> laufen zu lassen. In dieser Entwicklungsumgebung ist kein Zugriff auf Supabase möglich — die
> folgenden Schritte sind **nicht** hier ausgeführt/getestet worden, siehe [ADR-0006](Entscheidungen/ADR-0006-supabase-cutover.md).

## 1. Supabase-Projekt anlegen

Auf [supabase.com](https://supabase.com) einloggen → „New Project" → Name, Passwort (DB), Region wählen.

## 2. Migrationen ausführen

Reihenfolge ist wichtig: `0001_schema_rls.sql` → `0002_seed.sql` → `0003_profiles_email.sql`
(liegen in `supabase/migrations/`).

**Option A — Supabase CLI:**

```bash
supabase link --project-ref <projekt-ref>
supabase db push
```

**Option B — SQL-Editor im Dashboard:**

Dashboard → SQL Editor → Inhalt von `0001_schema_rls.sql` einfügen und ausführen, danach
`0002_seed.sql`, danach `0003_profiles_email.sql`. Jede Datei einzeln, in dieser Reihenfolge.

## 3. Edge Function deployen

```bash
supabase functions deploy admin-users
```

Die Function (`supabase/functions/admin-users`) läuft mit dem `service_role`-Key **serverseitig**
und übernimmt Anlegen/Löschen/Passwort-Reset von Nutzern durch Admins.

## 4. Bootstrap-Admin „Mo" anlegen

1. Dashboard → Authentication → Users → „Add user" → E-Mail + Passwort für „Mo" eintragen.
2. Danach im SQL-Editor zum Admin befördern:

```sql
update public.profiles set role = 'admin' where email = '<mo-email>';
```

`handle_new_user` legt beim Anlegen automatisch ein `profiles`-Row mit `role='customer'` an —
die Beförderung zu `admin` erfolgt bewusst erst danach, per SQL, nie über die Anwendung selbst.

## 5. Frontend-Env konfigurieren

```bash
cp Frontend/.env.example Frontend/.env.local
```

In `.env.local` eintragen (Dashboard → Settings → API):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Der `service_role`-Key gehört **niemals** in `.env.local`/das Frontend — er wird ausschließlich
von der Edge Function verwendet (Supabase verwaltet ihn dort selbst).

## 6. Lokal starten & Klick-Test

```bash
cd Frontend && bun run dev
```

- Mit Mos E-Mail/Passwort einloggen (`/login`).
- Speisekarte prüfen: Menü/Zutaten kommen aus der DB (nicht mehr aus `localStorage`).
- Eine Testbestellung durchführen → prüfen, dass sie in der Tabelle `orders` landet.
- Unter `/admin/nutzer` einen neuen Nutzer anlegen (läuft über die Edge Function `admin-users`).

## 7. Öffentliche Registrierung deaktivieren

Dashboard → Authentication → Providers/Settings → **„Allow new users to sign up" AUS**.

Nutzer werden ausschließlich vom Admin über die Edge Function angelegt — Self-Signup ist nicht
vorgesehen und muss nach dem Setup deaktiviert werden.

## Sicherheitshinweise

- Der `service_role`-Key darf **nie** ins Repo oder ins Frontend gelangen — er lebt ausschließlich
  in der Edge-Function-Umgebung von Supabase.
- **RLS ist die Sicherheitsgrenze**, nicht die Client-Logik. Alle Tabellen sind per Row-Level-Security
  abgesichert (siehe `0001_schema_rls.sql`).
- `handle_new_user` erzwingt beim Anlegen serverseitig `role='customer'` — die Rolle wird **nie**
  aus Client-Metadata übernommen. Selbst-Eskalation zu `admin` über die Anwendung ist damit
  ausgeschlossen.
- Der Trigger `protect_profile_columns` verhindert, dass Nutzer sich selbst schützenswerte Spalten
  (u. a. `role`) über ein direktes Profil-Update setzen.
- Die Preis-/Vorlaufzeit-Validierung läuft aktuell noch **client-seitig** (`lib/pricing.ts`,
  `lib/slots.ts`) — eine serverseitige Härtung ist für Teil-B4 vorgesehen, siehe
  [TODO.md](TODO.md).
