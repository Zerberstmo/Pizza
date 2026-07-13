# Design: Scanbarer QR-Code → öffentliche Bestell-Status-Seite

**Datum:** 2026-07-13
**Status:** freigegeben (Brainstorming)
**Kontext:** Pizza-Vorbestell-App (React/Vite/Supabase), Frontend live auf `https://pizza-self-pi.vercel.app`.

## Ziel

Auf der Bestätigungsseite steht aktuell nur ein **Pseudo-QR** (`qr-code.tsx`, reine Optik, nicht scanbar).
Gewünscht: ein **echter, scanbarer** QR-Code, der auf eine **öffentliche** (ohne Login erreichbare)
Bestell-Status-Seite verlinkt, damit der Kunde „Ist meine Pizza fertig?" verfolgen kann.

## Sicherheits-Grundsatz

`orders.id` ist `text` (kurze Bestellnummer, z. B. „42") → **ratbar**. Die öffentliche Seite darf
deshalb **niemals** über die Bestellnummer/ID adressierbar sein, sondern nur über ein
nicht-ratbares Token. RLS lässt Bestellungen nur Eigentümer/Admin lesen; der öffentliche Zugriff
läuft ausschließlich über eine **SECURITY-DEFINER-RPC**, die nur freigegebene Felder liefert.

**Freigegebene Felder (öffentlich):** Bestellnummer, Status, Abholdatum/-zeit, `service_mode`,
Pizza-Liste (Namen + Zutaten/Soße), Gesamtbetrag, Erstellzeit.
**NIE öffentlich:** Name, Telefon, Bemerkung (`notes`), Gutscheincode, `user_id`.

## Gewählter Ansatz

**Ansatz A — Postgres-RPC (SECURITY DEFINER).** Der 128-bit-UUID-Token ist nicht bruteforcebar;
eine RPC passt zum bestehenden Muster (`is_admin`, `validate_order`) und braucht keinen zweiten
Deploy-Pfad. (Ansatz B „Edge Function" verworfen: Rate-Limiting/CORS-Mehraufwand ist bei einem
unratbaren Token Overkill.)

**Token-Erzeugung:** Client generiert `crypto.randomUUID()` beim Anlegen und reicht es durch;
die DB-Spalte hat zusätzlich `default gen_random_uuid()` als Sicherheitsnetz (deckt auch bestehende
Bestellungen ab).

## Komponenten & Änderungen

### 1. Datenbank — Migration `supabase/migrations/0010_public_token.sql`

- Spalte:
  ```sql
  alter table public.orders
    add column public_token uuid not null default gen_random_uuid();
  create unique index orders_public_token_idx on public.orders(public_token);
  ```
  Bestehende Zeilen bekommen durch den Default automatisch ein Token.
- RPC:
  ```sql
  create or replace function public.get_order_status(p_token uuid)
  returns table (
    id text, status text, pickup_date text, pickup_time text,
    service_mode text, items jsonb, total numeric, created_at timestamptz,
    labels jsonb
  )
  language sql security definer stable set search_path = public as $$
    select o.id, o.status, o.pickup_date, o.pickup_time,
           o.service_mode, o.items, o.total, o.created_at,
           -- labels: nur die in DIESER Bestellung referenzierten Zutaten-/Soßen-IDs → Name
           coalesce((
             select jsonb_object_agg(x.id, x.name) from (
               select i.id, i.name from public.ingredients i
                 where i.id in (select jsonb_array_elements(o.items) ->> 'ingredientIds')
               union
               select s.id, s.name from public.sauces s
                 where s.id in (select (jsonb_array_elements(o.items) ->> 'sauceId'))
             ) x
           ), '{}'::jsonb)
      from public.orders o
     where o.public_token = p_token;
  $$;
  ```
  > Hinweis für die Umsetzung: Das Einsammeln der referenzierten IDs aus dem `items`-jsonb
  > (Array von `{ ingredientIds: string[], sauceId?: string }`) muss die Array-Verschachtelung
  > korrekt auflösen (ein `ingredientIds` ist selbst ein Array). Die genaue SQL-Formulierung wird
  > im Plan finalisiert; entscheidend ist das **Ergebnis**: eine flache Map `{ id: name }` nur über
  > die in der Bestellung vorkommenden Zutaten/Soßen — **nicht** die ganze Speisekarte.
- Grants (analog `0009_grants.sql`):
  ```sql
  grant execute on function public.get_order_status(uuid) to anon, authenticated;
  ```
  RLS auf `orders` bleibt unverändert — die RPC umgeht sie kontrolliert und gibt nur die
  Whitelist-Felder zurück.

### 2. Datenzugriff — `Frontend/src/lib/data/store.ts`

- `createOrder`: `const publicToken = crypto.randomUUID();` erzeugen, im `insert` als
  `public_token: publicToken` mitgeben und in die zurückgegebene `OrderData` schreiben.
- Neu: `getOrderStatus(token: string): Promise<PublicOrderStatus | null>` →
  `supabase.rpc("get_order_status", { p_token: token })`. Leeres Ergebnis → `null`. Mappt die
  Row auf `PublicOrderStatus` (snake_case → camelCase), inkl. `labels`.

### 3. Typen — `Frontend/src/types/index.ts`

- `OrderData` um `publicToken: string` erweitern.
- Neu:
  ```ts
  export interface PublicOrderStatus {
    id: string;
    status: OrderStatus;
    pickupDate: string;
    pickupTime: string;
    serviceMode: ServiceMode;
    items: CartItem[];
    total: number;
    createdAt: string;
    labels: Record<string, string>; // ingredientId|sauceId → Name
  }
  ```

### 4. Echter QR-Code — `Frontend/src/components/common/qr-code.tsx`

- Pseudo-QR-Logik entfernen, `qrcode.react` (`QRCodeSVG`) verwenden. Gleiche öffentliche Prop
  `data: string` (jetzt eine URL). Optik beibehalten (weißer Hintergrund, gerundet, volle Breite).
- Neue Dependency: `qrcode.react` (via `bun add qrcode.react`).

### 5. Bestätigungsseite — `Frontend/src/pages/confirmation/confirmation-page.tsx`

- QR kodiert `${window.location.origin}/bestellung/${order.publicToken}` statt `order.id`.
- Unter dem QR ein antippbarer Link „Status verfolgen" auf dieselbe URL (nützlich am eigenen Gerät).

### 6. Öffentliche Status-Seite + Route

- Neue Seite `Frontend/src/pages/status/order-status-page.tsx`.
- Route `/bestellung/:token` in `router.tsx` **außerhalb** der Auth-Layouts (öffentlich, wie
  `/login` / `/passwort-reset`).
- Verhalten:
  - Beim Mount `getOrderStatus(token)` laden.
  - **Auto-Refresh alle 20 s** per `setInterval`; Intervall **stoppt** bei Endstatus
    (`abgeholt` / `storniert`) und beim Unmount.
  - Anzeige: Bestellnummer, **Status-Badge** (Komponente `order-status-badge.tsx` wiederverwenden),
    Abholdatum/-zeit, Pizza-Liste (Namen via `labels` aufgelöst), Gesamtbetrag.
  - Kein `RequireAuth` — Seite muss ohne Session funktionieren.
- Namensauflösung: reiner Helfer (z. B. `resolveItemLabels(items, labels)`), damit testbar und
  ohne Zugriff auf die (RLS-geschützten) Menü-Tabellen.

### 7. Fehler- & Randfälle

- Unbekannter/ungültiger/leerer Token → freundliche Seite „Bestellung nicht gefunden".
- `storniert` → deutlich als storniert kennzeichnen, kein weiteres Polling.
- Endstatus `abgeholt` → finaler Zustand anzeigen, kein weiteres Polling.
- Netzwerkfehler beim Refresh → letzten bekannten Stand behalten, still weiterversuchen.

### 8. Tests (bun:test, wie im Projekt üblich)

- `resolveItemLabels(items, labels)` — Namensauflösung inkl. fehlender Labels (Fallback: ID/„?").
- Mapping der RPC-Row → `PublicOrderStatus` (snake→camel, leeres Ergebnis → `null`).
- Optional: Status-Seiten-Zustände (Laden / nicht gefunden / storniert) mit Testing-Library.
- Die RPC selbst wird **nicht** in JS getestet (kein DB-Zugriff in dieser Dev-Umgebung); die
  Migration führt der Betreiber via `bunx supabase db push` aus.

### 9. Dokumentation (CLAUDE.md-Grundregel)

- **Feature-Seite** in `Doku/Pizza/` aus `Templates/_feature.md`.
- **ADR** aus `Templates/_adr.md`: „Begrenzte Bestelldaten öffentlich per unratbarem Token
  (SECURITY-DEFINER-RPC)" — Sicherheitsentscheidung, Alternativen, Konsequenzen.
- **Changelog**-Eintrag, **TODO** aktualisieren (Punkt „echter QR" → erledigt).
- **`SETUP-Supabase.md`**: Migration `0010` in die Liste aufnehmen (Betreiber führt sie aus).

## Betreiber-Schritt (nach Merge)

`bunx supabase db push` (Migration `0010_public_token.sql` inkl. Grants). Kein Edge-Deploy nötig.

## Bewusst NICHT im Scope (YAGNI)

- Kein Realtime für die öffentliche Seite (Auto-Refresh reicht).
- Kein serverseitiges Rate-Limiting (UUID-Token nicht ratbar).
- Keine Öffnung der Menü-Tabellen für `anon` (Namen kommen über die `labels`-Map der RPC).
- Keine Anzeige von Name/Telefon/Bemerkung auf der öffentlichen Seite.
