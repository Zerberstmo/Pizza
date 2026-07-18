-- Öffnungstage als konkrete Kalendertage (ersetzt das Wochentags-Muster app_config.days im Ablauf).
create table if not exists public.open_days (
  date       date primary key,
  created_at timestamptz not null default now()
);

alter table public.open_days enable row level security;

-- Kunden dürfen lesen (sie sehen buchbare Tage), nur Admins schreiben.
create policy open_days_select on public.open_days for select using (true);
create policy open_days_admin  on public.open_days for all using (public.is_admin()) with check (public.is_admin());

grant all on public.open_days to postgres, anon, authenticated, service_role;

-- validate_order: ersetzt aus 0013 — Wochentags-Prüfung (app_config.days) durch konkrete
-- Kalendertage (open_days) ersetzt. Preis/Zugang/Voucher/Vorlaufzeit/Uhrzeit/Service unverändert.
create or replace function public.validate_order() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  pizza_qty int := 0;
  specials_sum numeric := 0;
  subtotal numeric;
  discount numeric := 0;
  v record;
  cfg record;
  elem jsonb;
  q int;
  sid uuid;
  g record;
begin
  if coalesce(jsonb_array_length(new.items), 0) < 1 then
    raise exception 'Leere Bestellung';
  end if;

  for elem in select * from jsonb_array_elements(new.items) loop
    if elem->>'kind' = 'special' then
      q := greatest(1, least(99, floor(coalesce((elem->>'quantity')::numeric, 1))::int));
      sid := (elem->>'specialItemId')::uuid;
      select g2.tiers into g
        from public.special_item_grants g2
        join public.special_items si on si.id = g2.item_id
       where g2.item_id = sid and g2.user_id = new.user_id and g2.active and si.active
       limit 1;
      if not found then
        raise exception 'Kein Zugang zu Sonderartikel';
      end if;
      specials_sum := specials_sum + public.special_line_price(g.tiers, q);
    else
      pizza_qty := pizza_qty + greatest(1, least(20, floor(coalesce((elem->>'quantity')::numeric, 1))::int));
    end if;
  end loop;

  subtotal := 10 * pizza_qty + specials_sum;

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

  -- Service-Modus bleibt IMMER auf gültige Werte begrenzt (auch bei reiner Special-Bestellung).
  if new.service_mode not in ('dinein', 'takeaway') then
    raise exception 'Ungültiger Service-Modus';
  end if;

  -- ── Abhol-Slot prüfen — entfällt komplett bei reiner Sonderartikel-Bestellung ──
  if pizza_qty > 0 then
    select hours, lead_time_days, service into cfg from public.app_config where id = 1;
    if not found then
      raise exception 'Konfiguration fehlt';
    end if;

    if new.pickup_date::date < current_date + cfg.lead_time_days then
      raise exception 'Abholtag zu früh (Vorlaufzeit)';
    end if;

    if not exists (select 1 from public.open_days od where od.date = new.pickup_date::date) then
      raise exception 'Tag nicht geöffnet';
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
  end if;

  return new;
end; $$;
