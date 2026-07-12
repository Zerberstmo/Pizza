# SETUP — Supabase (Teil-B)

> Schritt-für-Schritt-Anleitung für den Betreiber, um die App gegen ein echtes Supabase-Projekt
> laufen zu lassen. In dieser Entwicklungsumgebung ist kein Zugriff auf Supabase möglich — die
> folgenden Schritte sind **nicht** hier ausgeführt/getestet worden, siehe [ADR-0006](Entscheidungen/ADR-0006-supabase-cutover.md).

## 1. Supabase-Projekt anlegen

Auf [supabase.com](https://supabase.com) einloggen → „New Project" → Name, Passwort (DB), Region wählen.

## 2. Migrationen ausführen

Reihenfolge ist wichtig, alle liegen in `supabase/migrations/`:
`0001_schema_rls.sql` → `0002_seed.sql` → `0003_profiles_email.sql` → `0004_order_status.sql`
(B2: Status-Werte) → `0005_validate_order.sql` (B4: serverseitiger Preis-/Slot-Trigger) →
`0006_digest.sql` (B3: Kundendaten in `orders` + `notify_config`).

**Option A — Supabase CLI:**

```bash
supabase link --project-ref <projekt-ref>
supabase db push
```

**Option B — SQL-Editor im Dashboard:**

Dashboard → SQL Editor → Migrationen `0001` … `0006` **einzeln in dieser Reihenfolge** einfügen
und ausführen.

## 3. Edge Functions deployen

```bash
supabase functions deploy admin-users
supabase functions deploy daily-digest
```

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
