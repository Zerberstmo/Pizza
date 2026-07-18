-- Sonderartikel-Code case-insensitiv einlösen.
-- Der Checkout wandelt die Eingabe in Großbuchstaben (`toUpperCase`), unlock_special_item aus 0012
-- verglich aber exakt (`si.code = p_code`) — ein mit Kleinbuchstaben angelegter Code war damit nie
-- einlösbar. Jetzt case-insensitiv, damit die Schreibweise auf beiden Seiten egal ist.
-- Ersetzt NUR die Funktion aus 0012; sonst unverändert (SECURITY DEFINER, eigener Grant, kein Leak).

create or replace function public.unlock_special_item(p_code text)
returns table (special_item_id uuid, name text, emoji text, tiers jsonb)
language sql security definer stable set search_path = public as $$
  select si.id, si.name, si.emoji, g.tiers
  from public.special_items si
  join public.special_item_grants g on g.item_id = si.id
  where lower(si.code) = lower(p_code) and si.active
    and g.user_id = auth.uid() and g.active
  limit 1;
$$;
