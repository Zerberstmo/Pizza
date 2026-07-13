# SETUP — Supabase (Teil-B)

> Schritt-für-Schritt-Anleitung für den Betreiber, um die App gegen ein echtes Supabase-Projekt
> laufen zu lassen. In dieser Entwicklungsumgebung ist kein Zugriff auf Supabase möglich — die
> folgenden Schritte sind **nicht** hier ausgeführt/getestet worden, siehe [ADR-0006](Entscheidungen/ADR-0006-supabase-cutover.md).

## 1. Supabase-Projekt anlegen

Auf [supabase.com](https://supabase.com) einloggen → „New Project" → Name, Passwort (DB), Region wählen.

## 2. Migrationen ausführen

Reihenfolge ist wichtig, alle liegen in `supabase/migrations/`:
`0001_schema_rls.sql` → `0002_seed.sql` → `0003_profiles_email.sql` → `0004_order_status.sql`
(B2: Status) → `0005_validate_order.sql` (B4: Preis-/Slot-Trigger) → `0006_digest.sql` (B3:
Kundendaten + `notify_config`) → `0007_voucher_max_uses.sql` (Härtung) → `0008_prep_digest.sql`
(B5: `last_prep_date`) → **`0009_grants.sql`** (Supabase-Standard-Grants, s. u.).

**CLI ohne globale Installation (empfohlen):** Wir nutzen die CLI über **Bun**, das erspart
PATH-Gefummel. Statt `supabase …` immer **`bunx supabase …`**:

```bash
bunx supabase login --token <access-token>      # Token: Dashboard → Account → Access Tokens
bunx supabase init                               # legt supabase/config.toml an (Editor-Prompts: N)
bunx supabase link --project-ref <projekt-ref>
bunx supabase db push                            # fragt nach dem DB-Passwort
```

> **`db push` schlägt mit „function … already exists" fehl?** Dann existieren in der DB schon
> Objekte, aber die CLI-Historie ist leer (z. B. früher manuell eingespielt). Auf einem Projekt
> **ohne echte Daten** sauber neu aufsetzen: `bunx supabase db reset --linked --no-seed` (⚠️ löscht
> alle Daten, spielt danach 0001–0009 frisch ein).

> **WICHTIG — Grants nach `db reset`:** Ein `db reset` erstellt das `public`-Schema neu und entfernt
> dabei die Standard-Grants, die Supabase sonst mitbringt. Ohne sie können `anon`/`authenticated`/
> `service_role` die Tabellen nicht lesen (RLS greift erst **nach** der Tabellen-Berechtigung) → der
> Login schlägt mit **„Konto deaktiviert"** fehl, weil die `profiles`-Zeile nicht lesbar ist.
> Migration **`0009_grants.sql`** stellt die Grants wieder her und läuft bei `db push`/`db reset`
> automatisch mit — sie muss vorhanden sein.

**Alternative — SQL-Editor im Dashboard:** Migrationen `0001` … `0009` einzeln in dieser Reihenfolge
einfügen und ausführen (Rolle des SQL-Editors ggf. auf `postgres` stellen).

## 3. Edge Functions deployen

```bash
bunx supabase functions deploy admin-users
bunx supabase functions deploy daily-digest
```
> Die Warnung „Docker is not running" ist ok — die CLI nutzt den API-Bundler, kein Docker nötig.

- `admin-users` (`supabase/functions/admin-users`) läuft mit dem `service_role`-Key **serverseitig**
  und übernimmt Anlegen/Löschen/Passwort-Reset von Nutzern durch Admins.
- `daily-digest` (`supabase/functions/daily-digest`, B3) baut den täglichen Bestell-Digest und
  schickt ihn an CallMeBot. Wird per `pg_cron` getriggert (Schritt 4b); braucht keine Extra-Secrets
  (`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` stellt Supabase bereit).

## 3b. Realtime für `orders` aktivieren (Teil-B2)

Dashboard → Database → Replication (bzw. Table Editor → `orders` → „Enable Realtime"): die Tabelle
`public.orders` zur Realtime-Publikation hinzufügen. **Ohne diesen Schritt** aktualisieren sich die
Bestell-Seiten (Kunde `/bestellungen`, Admin `/admin/bestellungen`) nicht live.

## 3c. Täglicher Digest per pg_cron (Teil-B3)

Extensions aktivieren (Dashboard → Database → Extensions): **`pg_cron`** und **`pg_net`**.
Dann im SQL-Editor den Job anlegen — `<PROJECT>` und `<SERVICE_ROLE_KEY>` durch die echten Werte
ersetzen (Dashboard → Settings → API):

```sql
select cron.schedule('daily-digest-hourly', '0 * * * *', $$
  select net.http_post(
    url := 'https://<PROJECT>.functions.supabase.co/daily-digest',
    headers := jsonb_build_object('Authorization', 'Bearer <SERVICE_ROLE_KEY>')
  );
$$);
```

Der Job feuert stündlich; die Edge Function sendet nur um **18 Uhr Europe/Berlin** (Stunden-Gate,
DST-sicher) und nur, wenn ein Empfänger hinterlegt und „Digest aktiv" gesetzt ist (Schritt 8).

Zum Testen den Job manuell auslösen (sendet nur, falls es gerade 18 Uhr Berlin ist):
`select net.http_post(url := 'https://<PROJECT>.functions.supabase.co/daily-digest', headers := jsonb_build_object('Authorization','Bearer <SERVICE_ROLE_KEY>'));`

## 4. Bootstrap-Admin „Mo" anlegen

1. Dashboard → Authentication → Users → „Add user" → E-Mail + Passwort eintragen, **„Auto Confirm
   User" aktivieren** (sonst kein sofortiger Login). `handle_new_user` legt automatisch ein
   `profiles`-Row mit `role='customer'` an.
2. Danach im SQL-Editor zum Admin befördern.

> **Stolperstein — der `protect_profile_columns`-Trigger.** Er setzt `role`/`active` bei einem
> UPDATE zurück, wenn der Aufrufer nicht `is_admin()` oder `service_role` ist. Der SQL-Editor erfüllt
> das i. d. R. **nicht** → ein simples `update … set role='admin'` **verpufft lautlos**. Deshalb den
> Trigger für diesen einen Update kurz umgehen (Editor-Rolle ggf. auf `postgres` stellen):

```sql
alter table public.profiles disable trigger profiles_protect;
update public.profiles set role = 'admin', active = true where email = '<mo-email>';
alter table public.profiles enable trigger profiles_protect;
select email, role, active from public.profiles;  -- Kontrolle: role=admin, active=true
```

Die Beförderung zu `admin` erfolgt bewusst per SQL, nie über die Anwendung selbst.

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

## 8. WhatsApp-Digest-Empfänger einrichten (Teil-B3)

1. Der Empfänger registriert sich einmalig bei **CallMeBot**: die CallMeBot-WhatsApp-Nummer als
   Kontakt speichern und die Freigabe-Nachricht senden (Anleitung: <https://www.callmebot.com/blog/free-api-whatsapp-messages/>).
   CallMeBot antwortet mit einem **API-Key**, der an genau diese Nummer gebunden ist.
2. Als Admin einloggen → **/admin/benachrichtigungen** → Empfänger-Nummer + API-Key eintragen,
   **„Digest aktiv"** einschalten, speichern.
3. Empfänger später wechseln = Nummer **und** deren API-Key in derselben Maske aktualisieren
   (jede Nummer hat ihren eigenen CallMeBot-Key).

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
- **Preis-/Slot-Validierung ist serverseitig erzwungen** (Teil-B4, Trigger `validate_order` in
  `0005`): der Client rechnet weiter vor, aber der `BEFORE INSERT`-Trigger berechnet Preis/Gutschein
  neu und lehnt ungültige Abhol-Slots ab — manipulierte `total`/`discount` haben keine Wirkung.
- Die `notify_config`-Tabelle (B3) enthält den CallMeBot-API-Key und ist per **admin-only RLS**
  abgesichert; nur Admins (und die `service_role`-Edge-Function) lesen sie — der Key gelangt nie an
  öffentliche Clients.
