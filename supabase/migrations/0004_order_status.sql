-- Teil-B2: Status-Werte auf die 5 erlaubten begrenzen. orders.status Default 'eingegangen' bleibt (aus 0001).
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('eingegangen','in_arbeit','fertig','abgeholt','storniert'));
