-- Diskretion auch bei stornierten Bestellungen (öffentliche Status-Seite).
-- 0012 blendete Sonderartikel nur bei status='abgeholt' aus; ein stornierter Sonderartikel blieb
-- kundenseitig sichtbar. Jetzt gilt die Diskretion in beiden Endzuständen (abgeholt ODER storniert).
-- Ersetzt NUR get_order_status aus 0012; sonst unverändert (nur Anzeige-Filter, kein Löschen; Admin sieht alles).

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
      case when o.status in ('abgeholt', 'storniert')
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
  where jsonb_array_length(f.vis_items) > 0;  -- reine Special-Bestellung im Endzustand -> ausgeblendet
$$;

grant execute on function public.get_order_status(uuid) to anon, authenticated;
