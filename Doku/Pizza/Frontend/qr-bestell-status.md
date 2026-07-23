# Feature — Scanbarer QR → öffentliche Bestell-Status-Seite

> Nabe: [[00_CONTEXT]] · Frontend: [[Frontend/README|Frontend-Doku]] · Entscheidung: [[ADR-0007-oeffentlicher-bestell-status-token|ADR-0007]]

- **Status:** fertig
- **Zweck:** Kunde scannt den QR auf der Bestätigung und verfolgt ohne Login den Bearbeitungsstand seiner Bestellung.

## Ablauf

Nach dem Bestellen zeigt die Bestätigung einen echten QR-Code, der auf
`https://<domain>/bestellung/<public_token>` verweist. Die öffentliche Seite zeigt Bestellnummer,
Status, Abholzeit, Pizza-Liste und Betrag und aktualisiert den Status alle 20 s automatisch
(stoppt bei „abgeholt"/„storniert").

## Technische Umsetzung

- **Frontend:** `components/common/qr-code.tsx` (jetzt `qrcode.react`), `pages/confirmation` kodiert
  die Status-URL, `pages/status/order-status-page.tsx` (öffentliche Route `/bestellung/:token`
  außerhalb der Auth-Layouts), Helfer `lib/public-order.ts` (`describeItem`, `rowToPublicStatus`).
- **Backend:** RPC `get_order_status(p_token uuid)` (SECURITY DEFINER), gibt nur Whitelist-Felder
  + `labels`-Map zurück; ausführbar für `anon`/`authenticated`.
- **Daten:** `orders.public_token uuid` (unique, Default `gen_random_uuid()`), Migration `0010`.

## Abhängigkeiten

`qrcode.react`; Supabase-RPC; `orders`-Tabelle; Menü-Tabellen `ingredients`/`sauces` (nur
serverseitig in der RPC für die Namensauflösung).

## Fehlerfälle

- Unbekannter/ungültiger Token → „Bestellung nicht gefunden".
- `storniert` → Storno-Hinweis, kein weiteres Polling. `abgeholt` → Endzustand, kein Polling.
- Netzwerkfehler beim Refresh → letzter Stand bleibt, stiller Retry.

## Offene Punkte

- Kein Realtime (bewusst; Auto-Refresh reicht). Kein Name/Telefon/Bemerkung öffentlich.
