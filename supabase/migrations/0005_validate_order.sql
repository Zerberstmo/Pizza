-- Teil-B4: Serverseitige Preis-/Slot-Validierung. BEFORE INSERT auf orders.
-- SECURITY DEFINER, damit app_config/vouchers ohne RLS-Reibung gelesen werden.
create function public.validate_order() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  n int;
  subtotal numeric;
  discount numeric := 0;
  v record;
  cfg record;
  dayname text;
begin
  -- ── Preis serverseitig neu berechnen (überschreibt Client-Werte) ──
  n := coalesce(jsonb_array_length(new.items), 0);
  if n < 1 then
    raise exception 'Leere Bestellung';
  end if;
  subtotal := 10 * n;

  new.free_ingredient := null;
  if new.voucher_code is not null then
    select * into v from public.vouchers
      where code = new.voucher_code and active and expires_at >= current_date
      limit 1;
    if found then
      if v.type = 'percent' then
        discount := subtotal * v.value / 100;
      elsif v.type = 'fixed' then
        discount := v.value;
      elsif v.type = 'ingredient' then
        discount := 0;
        new.free_ingredient := v.ingredient_name;
      end if;
    else
      new.voucher_code := null; -- ungültig/abgelaufen → ignorieren, kein Reject
    end if;
  end if;

  new.subtotal := subtotal;
  new.discount := discount;
  new.total := greatest(0, subtotal - discount);

  -- ── Abhol-Slot prüfen (raise → Insert scheitert) ──
  select days, hours, lead_time_days, service into cfg from public.app_config where id = 1;

  if new.pickup_date::date < current_date + cfg.lead_time_days then
    raise exception 'Abholtag zu früh (Vorlaufzeit)';
  end if;

  dayname := case extract(dow from new.pickup_date::date)::int
    when 0 then 'Sonntag' when 1 then 'Montag' when 2 then 'Dienstag'
    when 3 then 'Mittwoch' when 4 then 'Donnerstag' when 5 then 'Freitag'
    when 6 then 'Samstag' end;
  if not coalesce((cfg.days ->> dayname)::boolean, false) then
    raise exception 'Wochentag nicht verfügbar';
  end if;

  if new.pickup_time < (cfg.hours ->> 'from') or new.pickup_time > (cfg.hours ->> 'to') then
    raise exception 'Uhrzeit außerhalb der Öffnungszeiten';
  end if;

  if new.service_mode = 'dinein' and not coalesce((cfg.service ->> 'dineIn')::boolean, false) then
    raise exception 'Service-Modus nicht verfügbar';
  end if;
  if new.service_mode = 'takeaway' and not coalesce((cfg.service ->> 'takeaway')::boolean, false) then
    raise exception 'Service-Modus nicht verfügbar';
  end if;

  return new;
end; $$;

create trigger validate_order_before_insert
  before insert on public.orders
  for each row execute function public.validate_order();
