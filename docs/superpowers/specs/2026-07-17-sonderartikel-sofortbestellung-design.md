# Sonderartikel: Sofort-Bestellung + Sofort-WhatsApp — Design

**Datum:** 2026-07-17
**Status:** Entwurf, vom Nutzer freigegeben
**Baut auf:** `docs/superpowers/plans/2026-07-16-sonderartikel-vip.md` (Tasks 1–13 umgesetzt, Migration 0012)

## Ziel

Zwei Erweiterungen des Sonderartikel-Features:

1. **Sofort-Bestellung:** Eine Bestellung, die **ausschließlich** Sonderartikel enthält, unterliegt keinen
   Abhol-Beschränkungen (Vorlaufzeit, Bestelltage, Öffnungszeiten). Abholdatum/-zeit werden automatisch
   auf „jetzt" gesetzt; der Kunde klickt nur noch „Bestellen".
2. **Sofort-WhatsApp:** Jede Bestellung, die **mindestens einen** Sonderartikel enthält, löst sofort eine
   WhatsApp an den Betreiber aus — zusätzlich zum bestehenden 18-Uhr-Digest.

## Entscheidungen (mit Begründung)

| Frage | Entscheidung | Warum |
|---|---|---|
| Bestellweg | Normaler Checkout, aber ohne Beschränkungen | Kein zweiter Bestellpfad → keine doppelte Logik |
| Mischfall (Pizza + Special) | Pizza-Regeln gelten weiter | Pizza braucht Vorbereitung; nur reine Special-Bestellungen sind frei |
| Abholzeit bei reiner Special-Bestellung | Automatisch heute/jetzt, keine Auswahl | Wunsch: „ein Klick" |
| WhatsApp-Auslöser | Jede Bestellung **mit** Sonderartikel | Auch im Mischfall will der Betreiber sofort Bescheid wissen |
| Zustellweg | DB-Trigger via `pg_net` + Cron-Sicherheitsnetz | Echtes „sofort" (<1 s), aber kein stiller Verlust bei CallMeBot-Ausfall |

**Verworfen:** Client ruft die Edge Function nach `createOrder` (hängt am Browser des Kunden, zusätzliche
Missbrauchsfläche). Reines Cron-Polling jede Minute (bis zu 60 s Verzögerung — kein „sofort").

## Leitprinzip

**Die eine Bedingung, die alles steuert:** „reine Sonderartikel-Bestellung" = **keine einzige Pizza im
Warenkorb**. Frontend (`pizzaQuantity(cart) === 0`) und Datenbank (`pizza_qty = 0` in `validate_order`)
leiten das **unabhängig voneinander** aus den Positionen ab. Der Client behauptet nichts, was der Server
glauben müsste — die bestehende Server-Autorität aus 0012 bleibt unangetastet.

## Teil 1: Sofort-Bestellung

### Frontend (`checkout-page.tsx`)

- Ist `pizzaQuantity(cart) === 0` und der Warenkorb nicht leer: Abholtag-/Uhrzeit-Auswahl ausblenden,
  stattdessen Hinweis „Abholung sofort".
- Beim Absenden: `pickupDate` = heutiges Datum, `pickupTime` = aktuelle Uhrzeit, **beide in Europe/Berlin**
  (Konsistenz mit der übrigen Zeitlogik; der Browser kann in einer anderen Zone stehen).
- Sobald eine Pizza im Warenkorb liegt, erscheint die Auswahl wieder — unveränderter Bestandsweg.

### Datenbank (Migration `0013`)

`validate_order` (aus 0012) wird ersetzt: Der komplette Slot-Block wird übersprungen, wenn `pizza_qty = 0`.

**Entfällt bei reiner Special-Bestellung:** Vorlaufzeit-Prüfung, Wochentag-Prüfung, Öffnungszeiten-Prüfung,
Service-Modus-**Verfügbarkeit** (`app_config.service`).

**Bleibt immer:** Leere-Bestellung-Prüfung, Grant-/Zugangsprüfung, Staffel-Preisberechnung, Voucher-Logik,
`service_mode ∈ ('dinein','takeaway')`.

### Bewusst akzeptiert

Freigeschaltete Kunden können rund um die Uhr bestellen (auch nachts/an Ruhetagen) — genau die Absicht.
Folge: Die Sofort-WhatsApp kann nachts eintreffen. Eine Ruhezeit ist **nicht** Teil dieses Entwurfs (YAGNI);
der Aufbau steht einer späteren Ergänzung nicht im Weg.

## Teil 2: Sofort-WhatsApp

### Datenmodell (Migration `0013`)

```sql
alter table public.orders add column if not exists special_notified_at timestamptz;
```

`null` = noch nicht zugestellt. Empfänger/API-Key/Aktiv-Schalter kommen aus der bestehenden
`notify_config` (`recipient_phone`, `callmebot_apikey`, `enabled`) — **kein zweiter Satz Einstellungen**.

### Ablauf

```
INSERT orders (mit Special)
   └─ AFTER INSERT Trigger  ──pg_net──▶  Edge Function `notify-special-order`  ──▶ CallMeBot
                                              └─ bei Erfolg: special_notified_at = now()

Cron (alle paar Minuten) ──▶ dieselbe Function, ohne Payload
                                └─ sucht Specials der letzten 2 h mit special_notified_at IS NULL
                                   und holt den Versand nach
```

### Trigger

- Feuert **nur**, wenn `new.items` mindestens ein Element mit `kind = 'special'` enthält.
- **Fängt eigene Fehler ab** (`exception when others then null`): Eine fehlgeschlagene Benachrichtigung
  darf die Bestellung **niemals** scheitern lassen. Das Sicherheitsnetz holt sie nach.
- **Formatiert den Text nicht selbst** — das täte eine dritte Kopie der Formatierungslogik neben
  `digest.ts` und ihrem Deno-Zwilling aufmachen.

### Zugangsdaten

Function-URL und Service-Role-Key gehören **nicht** in eine Migration im Git. Sie liegen als
Datenbank-Einstellungen (`app.settings.*`), die der Betreiber einmalig per SQL setzt — dasselbe
Vertrauensniveau wie beim bestehenden Cron-Job, der den Key ebenfalls im SQL trägt. Der Trigger liest sie
mit `current_setting(..., true)`; **fehlt die Einstellung, überspringt er stillschweigend** und der
Cron-Job übernimmt.

### Zeitfenster von 2 Stunden

Das Sicherheitsnetz betrachtet nur Bestellungen der letzten 2 Stunden. Grund: Sind die Benachrichtigungen
längere Zeit aus (`enabled = false`) und werden wieder eingeschaltet, gäbe es sonst einen Schwall alter
Nachrichten. Alte Bestellungen altern schlicht aus dem Fenster heraus.

### Nachrichtentext

Neue **reine** Funktion `formatSpecialAlert` in `Frontend/src/lib/special-alert.ts`, mit `bun:test` getestet
und als Deno-Kopie in `supabase/functions/notify-special-order/index.ts` gespiegelt — dieselbe
Sync-Disziplin wie `digest.ts` ↔ `daily-digest`.

Inhalt: Bestellnummer, Uhrzeit, Kundenname + Telefon, Artikel mit Emoji und Menge, Summe, Abholung/Vor Ort,
Notiz (falls vorhanden).

### Bewusst akzeptierte Schwäche: Doppelzustellung

Trigger und Cron könnten theoretisch dieselbe Bestellung greifen. **Keine Sperre** — das Zeitfenster ist
winzig (Trigger markiert binnen einer Sekunde, Cron schaut erst Minuten später), und im Kollisionsfall
kommt die WhatsApp doppelt statt gar nicht. Für den Anwendungsfall der bessere Fehler.

Konsequenz dieser Wahl: **senden, dann markieren** (nicht „claimen, dann senden"). Ein Claim vor dem Versand
würde bei einem Sendefehler die Bestellung als erledigt markieren und den Retry verhindern — der Verlust,
den wir gerade vermeiden wollen.

## Fehlerverhalten

| Fall | Verhalten |
|---|---|
| CallMeBot down / Nicht-2xx | `special_notified_at` bleibt `null` → Cron holt nach (bis 2 h) |
| `pg_net` schlägt fehl | Trigger schluckt den Fehler, Bestellung gültig → Cron holt nach |
| `app.settings.*` nicht gesetzt | Trigger überspringt still → Cron holt nach |
| `notify_config.enabled = false` | Nichts senden, **nicht** markieren; Bestellung altert aus dem Fenster |
| Bestellung storniert | Nicht senden |

## Tests

- **`formatSpecialAlert`** (`bun:test`): Emoji + Menge, Mischbestellung mit Pizza, fehlende Notiz,
  Vor Ort vs. Abholung.
- **`validate_order`-Änderung:** SQL ist hier nicht ausführbar → sorgfältiges Review + Smoke-Test des
  Betreibers.
- **Checkout:** Reiner Special-Warenkorb blendet die Auswahl aus und setzt Datum/Zeit korrekt.

## Betreiber-Schritte (nach Merge, in dieser Reihenfolge)

1. `bunx supabase db push` — spielt `0013` ein (Spalte, `validate_order`, Trigger).
2. `bunx supabase functions deploy notify-special-order --use-api --project-ref gvszyvgbbsmlulhqiakp`
3. Einstellungen setzen (SQL-Editor, echte Werte einsetzen):
   ```sql
   alter database postgres set app.settings.notify_url = 'https://<PROJECT>.functions.supabase.co/notify-special-order';
   alter database postgres set app.settings.notify_key = '<SERVICE_ROLE_KEY>';
   ```
4. Cron-Sicherheitsnetz anlegen:
   ```sql
   select cron.schedule('special-alert-retry', '*/5 * * * *', $$
     select net.http_post(
       url := 'https://<PROJECT>.functions.supabase.co/notify-special-order',
       headers := jsonb_build_object('Authorization', 'Bearer <SERVICE_ROLE_KEY>')
     );
   $$);
   ```
5. Smoke-Test: Freigeschalteter Testkunde bestellt einen reinen Sonderartikel → Bestellung geht ohne
   Datum-/Zeitauswahl durch → WhatsApp trifft binnen Sekunden ein → `special_notified_at` ist gesetzt.

## Offen / nicht Teil dieses Entwurfs

- **Ruhezeit** für nächtliche Benachrichtigungen (bewusst YAGNI).
- **`min_qty:1`-Absicherung** im Admin-UI der Staffeln — bestehende Lücke aus dem Vorgänger-Plan
  (Admin kann die Basisstufe löschen → serverseitige Preisfindung scheitert). Eigenes Thema.
