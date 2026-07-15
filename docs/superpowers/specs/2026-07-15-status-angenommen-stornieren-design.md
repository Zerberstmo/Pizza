# Design: Status „angenommen" + Bestellung stornieren (durch Kunden)

**Datum:** 2026-07-15
**Status:** freigegeben (Brainstorming)
**Kontext:** Pizza-Vorbestell-App (React/Vite/Supabase). Bestell-Status + Realtime + das Kunden-Detail-
Modal `OrderQrModal` sind live. Status-Werte sind per DB-CHECK auf 5 begrenzt (Migration `0004`) und in
`order-status.ts` abgebildet.

## Ziel

1. **Neuer Status „angenommen"** zwischen `eingegangen` und `in_arbeit` — der Betreiber bestätigt eine
   Bestellung, bevor die Zubereitung startet.
2. **Kunde kann selbst stornieren**, solange die Bestellung **noch nicht in Arbeit** ist (also in
   `eingegangen` oder `angenommen`). Ein evtl. eingelöster **Gutschein wird zurückgegeben**.

## Teil A — Neuer Status „angenommen"

Neuer Ablauf: `eingegangen → angenommen → in_arbeit → fertig → abgeholt` (+ `storniert` als Abbruch).

### Datenmodell (Migration)
- CHECK-Constraint auf `orders.status` um `'angenommen'` erweitern (additiv; bestehende Bestellungen
  bleiben gültig, keine Datenmigration):
  ```sql
  alter table public.orders drop constraint if exists orders_status_check;
  alter table public.orders add constraint orders_status_check
    check (status in ('eingegangen','angenommen','in_arbeit','fertig','abgeholt','storniert'));
  ```

### `order-status.ts`
- `OrderStatus`-Typ (in `types/index.ts`) um `"angenommen"` erweitern.
- `ORDER_STATUSES = ["eingegangen","angenommen","in_arbeit","fertig","abgeholt","storniert"]`.
- `FORWARD`: `eingegangen→angenommen`, `angenommen→in_arbeit`, `in_arbeit→fertig`, `fertig→abgeholt`,
  `abgeholt→null`, `storniert→null`.
- `LABELS`: `angenommen: "Angenommen"`.
- `isActive` bleibt (`s !== "abgeholt" && s !== "storniert"` deckt `angenommen` automatisch als aktiv ab).
- **Neu:** `isCancellable(s: OrderStatus): boolean` = `s === "eingegangen" || s === "angenommen"`
  (reiner Helfer, für UI + als Referenz zur Server-Prüfung).

### `order-status-badge.tsx`
- Eigene Farbe für `angenommen` (Vorschlag: blau, z. B. `bg-blue-500/15 text-blue-400 border border-blue-500/25`).

### Admin-Statussteuerung
- Nutzt `nextStatus(...)` → der neue Zwischenschritt „Angenommen" erscheint automatisch in der Vorwärts-
  Kette (`/admin/bestellungen`). Keine weitere Änderung nötig, sofern die Admin-Seite generisch über
  `nextStatus`/`statusLabel` läuft (im Plan verifizieren; ggf. Button-Label „Annehmen").

### Tests
- `order-status.test.ts` **anpassen**: `ORDER_STATUSES` (jetzt 6), `nextStatus`-Kette
  (`eingegangen→angenommen`, `angenommen→in_arbeit`), `statusLabel("angenommen")`; **neu**
  `isCancellable`-Tests (true für eingegangen/angenommen; false für in_arbeit/fertig/abgeholt/storniert).

## Teil B — Bestellung stornieren (durch Kunden)

### Server-RPC (Migration)
- Kunden dürfen `orders` per RLS **nicht** updaten (`orders_admin_update` = nur Admin). Storno läuft
  über eine kontrollierte SECURITY-DEFINER-RPC:
  ```sql
  create or replace function public.cancel_my_order(p_order_id text)
  returns void
  language plpgsql security definer set search_path = public as $$
  declare o record;
  begin
    select * into o from public.orders where id = p_order_id;
    if not found then raise exception 'Bestellung nicht gefunden'; end if;
    if o.user_id is distinct from auth.uid() then raise exception 'Keine Berechtigung'; end if;
    if o.status not in ('eingegangen','angenommen') then raise exception 'Nicht mehr stornierbar'; end if;
    -- Gutschein-Rückgabe (spiegelt den validate_order-Increment; genau EINE Zeile per code)
    if o.voucher_code is not null then
      update public.vouchers set uses = greatest(0, uses - 1)
        where id = (select id from public.vouchers where code = o.voucher_code limit 1);
    end if;
    update public.orders set status = 'storniert' where id = p_order_id;
  end; $$;
  grant execute on function public.cancel_my_order(text) to authenticated;
  ```
  - Sicherheit: prüft Eigentum (`user_id = auth.uid()`) **und** stornierbaren Status; ändert nur
    `status`. Der Update auf `orders`/`vouchers` läuft als Definer (umgeht RLS kontrolliert).
  - Nur `authenticated` darf ausführen.

### Client (`store.ts`)
- `cancelMyOrder(id: string): Promise<void>` → `supabase.rpc("cancel_my_order", { p_order_id: id })`;
  wirft bei Fehler (Meldung für die UI).

### UI — im `OrderQrModal`
- Button **„Bestellung stornieren"** (destruktiv gestylt), **nur** wenn `isCancellable(order.status)`.
- **Zweistufiger Inline-Confirm** (wie beim Dashboard-Reset): „Stornieren" → „Wirklich stornieren?
  Ja / Abbrechen". Erst „Ja" ruft `cancelMyOrder`.
- Nach Erfolg: Modal schließen (`onClose`); die Liste zieht per `useOrdersRealtime` nach (Status →
  „Storniert"). Bei Fehler kurze Meldung im Modal.

### Digest-Fix (Nebenbefund)
- `daily-digest`-Edge-Function: heutige/morgige Abholungen zusätzlich um **`status != 'storniert'`**
  filtern — in **beiden** Blöcken (Tages-Digest `.eq("pickup_date", …)` **und** Vorbereitungsliste),
  damit Stornos nicht mehr als Abholung/Vorbereitung zählen.

## Fehler-/Randfälle

- Storno-Versuch nach „in Arbeit" → RPC lehnt ab („Nicht mehr stornierbar"); der Button ist dann
  ohnehin ausgeblendet (Client-seitig `isCancellable`), die Server-Prüfung ist die harte Absicherung.
- Fremde Bestellung → RPC „Keine Berechtigung" (zusätzlich schützt RLS-Select, dass man fremde IDs gar
  nicht sieht).
- Gutschein ohne Treffer (gelöscht) → `update` trifft nichts, kein Fehler.
- Race (Admin stellt gleichzeitig auf „in Arbeit"): Server-Status-Prüfung entscheidet atomar im Update-
  Kontext; im schlimmsten Fall Ablehnung — akzeptabel.

## Tests

- `order-status.ts` (Teil A): siehe oben — reine Logik, bun:test.
- SQL (CHECK-Migration, `cancel_my_order`-RPC): hier nicht ausführbar → sorgfältiges Review; Betreiber
  spielt Migration via `bunx supabase db push` ein.
- Client + Modal-UI: `bun run build` + manueller Klicktest.

## Doku & Betreiber

- **Changelog** + **TODO** (Idee „Bestellung stornieren" erledigt; neuer Status dokumentiert).
- **SETUP-Supabase.md:** neue Migration in die Liste.
- **Betreiber-Schritte:** Migration (`db push`) **+** `daily-digest` neu deployen (Storno-Filter).
- Kein ADR (kleine, folgerichtige Erweiterung).

## Bewusst NICHT im Scope (YAGNI)

- Kein zeitbasiertes Storno-Fenster (nur statusbasiert: bis „in Arbeit").
- Keine Storno-Benachrichtigung an den Admin (Realtime/Bestell-Liste zeigt „Storniert"; Digest filtert
  ihn raus).
- Kein Kunden-Ändern der Bestellung (nur Stornieren).
- „angenommen" wird vom Admin manuell gesetzt (kein Auto-Übergang).
