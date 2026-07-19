-- 0020: Defense-in-Depth — Format-CHECK für orders.pickup_date/pickup_time.
-- Beide Spalten sind text NOT NULL. Die App schreibt YYYY-MM-DD bzw. HH:MM; der Server-Trigger
-- validate_order prüft Slots inhaltlich. Dieser CHECK sichert zusätzlich das reine Format ab.
-- Als NOT VALID hinzugefügt: gilt für neue/geänderte Zeilen, prüft Bestandsdaten NICHT nach —
-- so kann der Deploy nicht an evtl. abweichenden Altbestellungen scheitern.

alter table public.orders
  add constraint orders_pickup_date_format
  check (pickup_date ~ '^\d{4}-\d{2}-\d{2}$') not valid;

alter table public.orders
  add constraint orders_pickup_time_format
  check (pickup_time ~ '^\d{2}:\d{2}$') not valid;
