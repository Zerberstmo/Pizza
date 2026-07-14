-- QR-Bestell-Status: nicht-ratbarer Token + öffentliche, feld-begrenzte Lese-RPC.

-- 1) Token-Spalte. Default deckt auch bestehende Bestellungen ab.
alter table public.orders
  add column if not exists public_token uuid not null default gen_random_uuid();
create unique index if not exists orders_public_token_idx on public.orders(public_token);

-- 2) Öffentliche Status-RPC. SECURITY DEFINER umgeht RLS kontrolliert und gibt NUR
--    Whitelist-Felder zurück (kein Name/Telefon/notes/voucher_code/user_id).
--    labels = { ingredientId|sauceId -> Name }, nur für die in DIESER Bestellung
--    vorkommenden Zutaten/Soßen (öffnet NICHT die ganze Speisekarte für anon).
create or replace function public.get_order_status(p_token uuid)
returns table (
  id text, status text, pickup_date text, pickup_time text,
  service_mode text, items jsonb, total numeric, created_at timestamptz, labels jsonb
)
language sql security definer stable set search_path = public as $$
  with o as (
    select * from public.orders where public_token = p_token
  ),
  ing_ids as (
    select distinct ing.value as id
    from o,
         jsonb_array_elements(o.items) it,
         jsonb_array_elements_text(it->'ingredientIds') ing(value)
  ),
  sauce_ids as (
    select distinct (it->>'sauceId') as id
    from o, jsonb_array_elements(o.items) it
    where it->>'sauceId' is not null
  ),
  lbl as (
    select i.id, i.name from public.ingredients i where i.id in (select id from ing_ids)
    union
    select s.id, s.name from public.sauces s where s.id in (select id from sauce_ids)
  )
  select o.id, o.status, o.pickup_date, o.pickup_time,
         o.service_mode, o.items, o.total, o.created_at,
         coalesce((select jsonb_object_agg(lbl.id, lbl.name) from lbl), '{}'::jsonb) as labels
  from o;
$$;

-- 3) Ausführung für anonyme (nicht eingeloggte) Besucher + Eingeloggte freigeben.
grant execute on function public.get_order_status(uuid) to anon, authenticated;
