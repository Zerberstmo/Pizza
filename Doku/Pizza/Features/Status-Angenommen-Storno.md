# Feature — Status „angenommen" + Bestellung stornieren

> Nabe: [[00_CONTEXT]] · Frontend: [[Frontend/README|Frontend-Doku]] · verwandt: [[Sonderartikel-VIP|Sonderartikel/VIP]] · Historie: [[Changelog]] · [[TODO]]

- **Status:** fertig (2026-07-21)
- **Zweck:** Der Betreiber kann eine Bestellung erst **annehmen**, bevor die Zubereitung startet; der
  Kunde kann seine Bestellung **selbst stornieren**, solange sie noch nicht in Arbeit ist.

## Ablauf

**Neuer Status.** Der Bestell-Ablauf ist jetzt `eingegangen → angenommen → in_arbeit → fertig → abgeholt`
(plus `storniert` als Abbruch). „Angenommen" wird vom Betreiber im Admin manuell gesetzt (Vorwärts-Button),
kein Auto-Übergang.

**Storno durch den Kunden.** In „Meine Bestellungen" öffnet der Kunde eine Bestellung (`OrderQrModal`).
Solange der Status `eingegangen` oder `angenommen` ist, erscheint „Bestellung stornieren". Ein Klick zeigt
einen zweistufigen Confirm („Bestellung wirklich stornieren? Abbrechen / Ja, stornieren"). Nach Erfolg
schließt das Modal; die Liste aktualisiert sich per Realtime auf „Storniert". Ein eingelöster Gutschein
wird zurückgegeben.

## Technische Umsetzung

- **Frontend:**
  - `lib/order-status.ts`: `ORDER_STATUSES` (6), `FORWARD`-Kette, `LABELS`, neu `isCancellable`.
  - `components/common/order-status-badge.tsx`: blaues Badge für `angenommen`.
  - `components/orders/order-qr-modal.tsx`: Storno-Button (nur bei `isCancellable`) + zweistufiger Confirm.
  - `lib/data/store.ts`: `cancelMyOrder(id)` → RPC.
  - `types/index.ts`: `OrderStatus` um `"angenommen"`.
- **Backend:**
  - Migration `0021_order_accept_cancel.sql`: CHECK-Constraint additiv um `angenommen`; RPC
    `cancel_my_order(p_order_id text)` (SECURITY DEFINER): prüft Eigentum + stornierbaren Status, gibt
    Gutschein zurück (`uses - 1`, spiegelt `validate_order`), setzt `status = 'storniert'`. Grant nur
    `authenticated`.
  - `supabase/functions/daily-digest/index.ts`: `status != 'storniert'` in Tages-Digest **und**
    Vorbereitungsliste.
- **Daten:** `orders.status` (text, CHECK), `vouchers.uses` (int).

## Abhängigkeiten

Setzt auf den bestehenden Bestell-Status/Realtime (Teil-B2) und die serverseitige Validierung/
Gutschein-Zählung aus `validate_order` (Migration 0007) auf.

## Fehlerfälle

- Storno nach „in Arbeit": RPC lehnt ab („Nicht mehr stornierbar"); Button ist ohnehin ausgeblendet.
- Fremde Bestellung: RPC „Keine Berechtigung" (zusätzlich verhindert RLS-Select das Sehen fremder IDs).
- Gutschein gelöscht: `update` trifft nichts, kein Fehler.
- Race (Admin stellt gleichzeitig auf „in Arbeit"): Server-Statusprüfung entscheidet im Update-Kontext;
  im schlimmsten Fall Ablehnung — akzeptabel.

## Offene Punkte

- Kein zeitbasiertes Storno-Fenster (nur statusbasiert), keine Storno-Benachrichtigung an den Admin,
  kein Kunden-Ändern der Bestellung (bewusst YAGNI).
- Betreiber-Schritte: `bunx supabase db push` (0021) + `daily-digest` neu deployen.
