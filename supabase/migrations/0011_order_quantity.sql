-- Mengen im Warenkorb: Preis serverseitig aus der Summe der (abgesicherten) Positions-Mengen
-- statt aus der Positionsanzahl. Ersetzt validate_order aus 0007; Trigger aus 0005 bleibt.
-- Menge pro Position: fehlend/ungültig -> 1, geklemmt auf [1,20] — gegen Preis-Manipulation via JSON.
create or replace function public.validate_order() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  total_qty int;
  subtotal numeric;
  discount numeric := 0;
  v record;
  cfg record;
  dayname text;
begin
  -- ── Preis serverseitig neu berechnen (überschreibt Client-Werte) ──
  if coalesce(jsonb_array_length(new.items), 0) < 1 then
    raise exception 'Leere Bestellung';
  end if;
  select coalesce(sum(greatest(1, least(20, floor(coalesce((elem->>'quantity')::numeric, 1))::int))), 0)
    into total_qty
    from jsonb_array_elements(new.items) elem;
  subtotal := 10 * total_qty;

  new.free_ingredient := null;
  if new.voucher_code is not null then
    update public.vouchers
       set uses = uses + 1
     where id = (
       select id from public.vouchers
        where code = new.voucher_code
          and active
          and expires_at >= current_date
          and (max_uses <= 0 or uses < max_uses)
        limit 1
        for update
     )
     returning * into v;
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
      new.voucher_code := null;
    end if;
  end if;

  new.subtotal := subtotal;
  new.discount := discount;
  new.total := greatest(0, subtotal - discount);

  -- ── Abhol-Slot prüfen (unverändert zu 0007) ──
  select days, hours, lead_time_days, service into cfg from public.app_config where id = 1;
  if not found then
    raise exception 'Konfiguration fehlt';
  end if;

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

  if new.service_mode not in ('dinein', 'takeaway') then
    raise exception 'Ungültiger Service-Modus';
  end if;
  if new.service_mode = 'dinein' and not coalesce((cfg.service ->> 'dineIn')::boolean, false) then
    raise exception 'Service-Modus nicht verfügbar';
  end if;
  if new.service_mode = 'takeaway' and not coalesce((cfg.service ->> 'takeaway')::boolean, false) then
    raise exception 'Service-Modus nicht verfügbar';
  end if;

  return new;
end; $$;
