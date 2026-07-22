-- Status „angenommen" + Kunden-Storno.
-- Teil A: neuer Zwischenstatus 'angenommen' (eingegangen → angenommen → in_arbeit → …).
--   Additiv: bestehende Bestellungen bleiben gültig, keine Datenmigration. 'storniert' ist seit 0004 drin.
-- Teil B: RPC cancel_my_order — Kunde storniert eigene Bestellung, solange nicht in Arbeit;
--   eingelöster Gutschein wird zurückgegeben (spiegelt den validate_order-Increment aus 0007).

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('eingegangen','angenommen','in_arbeit','fertig','abgeholt','storniert'));

create or replace function public.cancel_my_order(p_order_id text)
returns void
language plpgsql security definer set search_path = public as $$
declare o record;
begin
  -- FOR UPDATE sperrt die Zeile: verhindert, dass ein paralleler Storno oder eine gleichzeitige
  -- Admin-Transition (→ in_arbeit) zwischen Prüfung und Update reinfunkt (sonst doppelte
  -- Gutschein-Rückgabe / überschriebener Status).
  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception 'Bestellung nicht gefunden'; end if;
  if o.user_id is distinct from auth.uid() then raise exception 'Keine Berechtigung'; end if;
  if o.status not in ('eingegangen','angenommen') then raise exception 'Nicht mehr stornierbar'; end if;

  -- Gutschein-Rückgabe: genau EINE Zeile per code (code ist nicht unique → limit 1, wie validate_order).
  if o.voucher_code is not null then
    update public.vouchers set uses = greatest(0, uses - 1)
      where id = (select id from public.vouchers where code = o.voucher_code limit 1);
  end if;

  -- Status-Guard zusätzlich in der WHERE: doppelte Absicherung unter der Sperre.
  update public.orders set status = 'storniert'
    where id = p_order_id and status in ('eingegangen','angenommen');
end; $$;

grant execute on function public.cancel_my_order(text) to authenticated;
