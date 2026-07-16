-- Sonderartikel/VIP: versteckte, kontogebunden freischaltbare Menü-Items mit pro-Kunde-Preis + Staffeln.
-- Ersetzt validate_order aus 0011 (Preis jetzt inkl. Sonderartikel + serverseitige Zugangsprüfung).
-- Trigger aus 0005 bleibt; hier nur create-or-replace der Funktionen.

-- ── Tabellen ─────────────────────────────────────────────
create table if not exists public.special_items (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  name       text not null,
  emoji      text not null default '⭐',
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.special_item_grants (
  id         uuid primary key default gen_random_uuid(),
  item_id    uuid not null references public.special_items(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  tiers      jsonb not null default '[]'::jsonb, -- [{ "min_qty": int, "unit_price": numeric }, …]
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  unique (item_id, user_id)
);

alter table public.special_items       enable row level security;
alter table public.special_item_grants enable row level security;

-- Nur Admins lesen/schreiben direkt (Kunden ausschließlich über unlock_special_item-RPC).
create policy special_items_admin  on public.special_items       for all using (public.is_admin()) with check (public.is_admin());
create policy special_grants_admin on public.special_item_grants for all using (public.is_admin()) with check (public.is_admin());

-- Grants (Muster wie 0009): Tabellen-Berechtigung vor RLS. Neu erstellte Tabellen brauchen sie explizit,
-- falls ein db reset die Default-Privilegien nicht greifen lässt.
grant all on public.special_items       to postgres, anon, authenticated, service_role;
grant all on public.special_item_grants to postgres, anon, authenticated, service_role;

-- Spiegelt priceForQty aus Frontend/src/lib/special-pricing.ts — synchron halten!
-- Flach je Stufe: Stückpreis der Stufe mit größtem min_qty <= qty, Zeilenpreis = qty * unit_price.
create or replace function public.special_line_price(p_tiers jsonb, p_qty int)
returns numeric language plpgsql immutable set search_path = public as $$
declare
  best_price numeric := null;
  best_min   int := -1;
  e jsonb;
  m int;
  up numeric;
begin
  if p_tiers is null or jsonb_typeof(p_tiers) <> 'array' or jsonb_array_length(p_tiers) = 0 then
    raise exception 'Ungültige Sonderartikel-Preisstaffel';
  end if;
  for e in select * from jsonb_array_elements(p_tiers) loop
    m  := (e->>'min_qty')::int;
    up := (e->>'unit_price')::numeric;
    if m <= p_qty and m > best_min then
      best_min := m;
      best_price := up;
    end if;
  end loop;
  if best_price is null then
    raise exception 'Keine passende Preisstaffel für Menge %', p_qty;
  end if;
  return p_qty * best_price;
end; $$;

-- Kunden-Einlösung: liefert die EIGENE Freischaltung oder leer (kein Leak, ob Code existiert).
create or replace function public.unlock_special_item(p_code text)
returns table (special_item_id uuid, name text, emoji text, tiers jsonb)
language sql security definer stable set search_path = public as $$
  select si.id, si.name, si.emoji, g.tiers
  from public.special_items si
  join public.special_item_grants g on g.item_id = si.id
  where si.code = p_code and si.active
    and g.user_id = auth.uid() and g.active
  limit 1;
$$;

grant execute on function public.unlock_special_item(text) to authenticated;

-- Preis serverseitig: 10€ * Σ(Pizza-Menge) + Σ(Sonderartikel-Zeilenpreise, über Grant+Staffel).
-- Sonderartikel ohne aktiven Grant für new.user_id -> Bestellung scheitert.
create or replace function public.validate_order() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  pizza_qty int := 0;
  specials_sum numeric := 0;
  subtotal numeric;
  discount numeric := 0;
  v record;
  cfg record;
  dayname text;
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

  -- ── Abhol-Slot prüfen (unverändert zu 0011) ──
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

-- Öffentliche Status-RPC (ersetzt 0010): nach Abholung Sonderartikel diskret.
-- - status='abgeholt': Sonderartikel-Positionen werden aus items entfernt.
-- - bestand die Bestellung NUR aus Sonderartikeln -> keine Zeile zurück (nicht gefunden).
create or replace function public.get_order_status(p_token uuid)
returns table (
  id text, status text, pickup_date text, pickup_time text,
  service_mode text, items jsonb, total numeric, created_at timestamptz, labels jsonb
)
language sql security definer stable set search_path = public as $$
  with o as (
    select * from public.orders where public_token = p_token
  ),
  filtered as (
    select o.*,
      case when o.status = 'abgeholt'
        then coalesce((
          select jsonb_agg(it) from jsonb_array_elements(o.items) it
          where it->>'kind' is distinct from 'special'
        ), '[]'::jsonb)
        else o.items
      end as vis_items
    from o
  ),
  ing_ids as (
    select distinct ing.value as id
    from filtered f,
         jsonb_array_elements(f.vis_items) it,
         jsonb_array_elements_text(it->'ingredientIds') ing(value)
  ),
  sauce_ids as (
    select distinct (it->>'sauceId') as id
    from filtered f, jsonb_array_elements(f.vis_items) it
    where it->>'sauceId' is not null
  ),
  lbl as (
    select i.id, i.name from public.ingredients i where i.id in (select id from ing_ids)
    union
    select s.id, s.name from public.sauces s where s.id in (select id from sauce_ids)
  )
  select f.id, f.status, f.pickup_date, f.pickup_time,
         f.service_mode, f.vis_items, f.total, f.created_at,
         coalesce((select jsonb_object_agg(lbl.id, lbl.name) from lbl), '{}'::jsonb) as labels
  from filtered f
  where jsonb_array_length(f.vis_items) > 0;  -- reine Special-Bestellung nach Abholung -> ausgeblendet
$$;

grant execute on function public.get_order_status(uuid) to anon, authenticated;
