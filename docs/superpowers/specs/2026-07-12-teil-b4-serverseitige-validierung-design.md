# Design: Teil-B4 — Serverseitige Preis-/Vorlauf-Validierung

- **Datum:** 2026-07-12
- **Status:** genehmigt (User-Freigabe des Designs)
- **Kontext:** Sub-Projekt von Teil-B, baut auf B1/B2 (Supabase). Die `orders`-Tabelle akzeptiert beim Insert client-gelieferte `subtotal/discount/total`; RLS prüft nur `user_id = auth.uid()`. Vorlaufzeit/Öffnungszeiten/Bestelltage/Service-Modus werden bisher nur client-seitig geprüft. `app_config` (id=1) und `vouchers` liegen in Supabase; `orders.items` ist JSONB (`CartItem[]`).

## Ziel

Der Server erzwingt beim Anlegen einer Bestellung den **korrekten Preis** und einen **erlaubten Abhol-Slot** — unabhängig davon, was der Client sendet. Damit ist die aktuell client-manipulierbare Preis-/Slot-Logik gehärtet.

## Architektur

**Postgres `BEFORE INSERT`-Trigger auf `orders`** (gewählt gegenüber Edge Function): kann nicht umgangen werden (feuert bei jedem Insert), keine Client-Aufruf-Änderung, keine RLS-Änderung. Bewusster Nachteil: die Logik wird in plpgsql nachgebaut (Duplikat zu `pricing.ts`/`slots.ts`) und ist in dieser Umgebung nicht ausführbar — der Betreiber testet real.

## Voraussetzungen & Umgebungs-Realität

- **Umgebung erreicht Supabase nicht.** Verifiziert wird nur `bun run build` (der Client-Zusatz) + bestehende reine Logik-Tests. Das SQL wird geschrieben, nicht ausgeführt; **der Betreiber führt Migration `0005` aus und testet den Trigger real** (SETUP-Ergänzung).

## Nicht-Ziele

- Keine Änderung am Bestell-*Flow* (Client fügt weiterhin direkt in `orders` ein; der Trigger korrigiert/validiert).
- Keine Telefon-Validierung, kein WhatsApp (B3), keine Status-Änderung (B2).
- Keine RLS-Änderung.

## Migration `supabase/migrations/0005_validate_order.sql`

`create function public.validate_order()` (`plpgsql`, `SECURITY DEFINER`, `search_path=public`) + `create trigger validate_order_before_insert before insert on public.orders for each row execute function public.validate_order();`

### 1. Preis serverseitig neu berechnen (überschreibt `NEW.subtotal/discount/total`)
- `n := jsonb_array_length(NEW.items)`. **Wenn `n < 1` → `raise exception 'Leere Bestellung'`.**
- `subtotal := 10 * n`.
- **Gutschein neu prüfen:** falls `NEW.voucher_code` gesetzt, Zeile aus `vouchers` mit `code = NEW.voucher_code AND active AND expires_at >= current_date`.
  - gefunden & `type='percent'` → `discount := subtotal * value / 100`; `free_ingredient := null`.
  - gefunden & `type='fixed'` → `discount := value`; `free_ingredient := null`.
  - gefunden & `type='ingredient'` → `discount := 0`; `NEW.free_ingredient := ingredient_name`.
  - **nicht gefunden/ungültig → `discount := 0`, `NEW.voucher_code := null`, `NEW.free_ingredient := null`** (Bestellung wird NICHT abgelehnt, nur ohne Rabatt/Sonderzutat).
- `NEW.subtotal := subtotal`; `NEW.discount := discount`; `NEW.total := greatest(0, subtotal - discount)`.

### 2. Abhol-Slot prüfen (`raise exception` bei ungültig → Insert scheitert)
- Config lesen: `select days, hours, lead_time_days, service into cfg from app_config where id = 1`.
- **Vorlaufzeit:** `NEW.pickup_date::date >= current_date + cfg.lead_time_days` — sonst `raise exception 'Abholtag zu früh'`.
- **Wochentag erlaubt:** deutschen Wochentagsnamen aus `extract(dow from NEW.pickup_date::date)` ableiten (0=Sonntag…6=Samstag → Sonntag/Montag/…/Samstag) und `(cfg.days ->> dayname)::boolean` muss `true` sein — sonst `raise exception 'Wochentag nicht verfügbar'`.
- **Uhrzeit im Öffnungsfenster:** `NEW.pickup_time >= cfg.hours->>'from' AND NEW.pickup_time <= cfg.hours->>'to'` (String-Vergleich `HH:MM`) — sonst `raise exception 'Uhrzeit außerhalb der Öffnungszeiten'`.
- **Service-Modus aktiv:** `service_mode='dinein'` → `(cfg.service->>'dineIn')::boolean` true; `='takeaway'` → `(cfg.service->>'takeaway')::boolean` true — sonst `raise exception 'Service-Modus nicht verfügbar'`.

> Der Trigger fasst NUR beim INSERT; Status-Updates (B2) laufen über UPDATE und sind nicht betroffen.

## Client-Zusatz (Robustheit) — `Frontend/src/pages/checkout/checkout-page.tsx`

Legitime Bestellungen passieren die Trigger-Prüfungen lautlos (der Client validiert bereits vorab, und der Preis stimmt). **Damit ein serverseitiger Reject nicht als unbehandelter Fehler auftritt**, wird der `createOrder`-Aufruf in `placeOrder` in `try/catch` gehüllt: bei Fehler eine kurze Meldung (z. B. „Bestellung konnte nicht angenommen werden — bitte Angaben prüfen.") statt Absturz/stillem Nichts. Keine weitere Client-Änderung; `createOrder` selbst bleibt unverändert (der Trigger korrigiert den Preis DB-seitig; der zurückgegebene `OrderData` zeigt den Client-Preis, der bei legitimen Bestellungen identisch ist).

## Tests & Verifikation

- **Reine Logik bleibt grün:** `pricing.ts`/`slots.ts` sind bereits getestet; B4 fügt KEINE neue TS-Logik hinzu (die Validierung ist SQL). Kein neuer Unit-Test hier.
- **Client-Zusatz:** `bun run build` grün (Typecheck).
- **SQL-Trigger:** hier nicht ausführbar → **Betreiber testet real** (legitime Bestellung geht durch; manipulierter `total` wird korrigiert; zu früher Abholtag/geschlossener Tag/Uhrzeit außerhalb → abgelehnt).

## Betroffene Dateien

**Neu:** `supabase/migrations/0005_validate_order.sql`.
**Geändert:** `Frontend/src/pages/checkout/checkout-page.tsx` (try/catch um `createOrder`), `Doku/Pizza/SETUP-Supabase.md` (Migration 0005 ausführen), Changelog/README/TODO.

## Definition of Done

- Migration `0005` vorhanden (Trigger + Funktion); Client-`placeOrder` fängt Fehler ab; `bun run build` grün.
- Nach Betreiber-Setup: manipulierter Preis wird serverseitig korrigiert; ungültiger Slot (Vorlaufzeit/Tag/Uhrzeit/Modus) wird abgelehnt; ungültiger Gutschein → Voll-Preis ohne Ablehnung; SETUP nennt Migration 0005.
- Doku aktualisiert; das in B1 dokumentierte Rest-Risiko (client-seitige Preis-/Vorlauf-Validierung) ist damit geschlossen.
