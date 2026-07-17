-- Sonderartikel: Sofort-Bestellung + Sofort-WhatsApp.
-- 1) Reine Sonderartikel-Bestellung (pizza_qty = 0) umgeht den Abhol-Slot-Block.
-- 2) AFTER-INSERT-Trigger meldet Bestellungen mit Sonderartikel sofort via pg_net.
-- Ersetzt validate_order aus 0012 (nur die Funktion; der Trigger aus 0005 bleibt).

-- Merker für die Sofort-Benachrichtigung. null = noch nicht zugestellt (Cron holt nach).
alter table public.orders add column if not exists special_notified_at timestamptz;

-- Preis serverseitig: 10€ * Σ(Pizza-Menge) + Σ(Sonderartikel-Zeilenpreise, über Grant+Staffel).
-- Sonderartikel ohne aktiven Grant für new.user_id -> Bestellung scheitert.
-- NEU ggü. 0012: liegt keine einzige Pizza in der Bestellung (pizza_qty = 0), entfällt der
-- komplette Abhol-Slot-Block (Vorlaufzeit/Wochentag/Öffnungszeiten/Service-Verfügbarkeit).
-- Preis, Zugang und Voucher-Logik bleiben in JEDEM Fall geprüft.
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

  -- Service-Modus bleibt IMMER auf gültige Werte begrenzt (auch bei reiner Special-Bestellung).
  if new.service_mode not in ('dinein', 'takeaway') then
    raise exception 'Ungültiger Service-Modus';
  end if;

  -- ── Abhol-Slot prüfen — entfällt komplett bei reiner Sonderartikel-Bestellung ──
  if pizza_qty > 0 then
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

    if new.service_mode = 'dinein' and not coalesce((cfg.service ->> 'dineIn')::boolean, false) then
      raise exception 'Service-Modus nicht verfügbar';
    end if;
    if new.service_mode = 'takeaway' and not coalesce((cfg.service ->> 'takeaway')::boolean, false) then
      raise exception 'Service-Modus nicht verfügbar';
    end if;
  end if;

  return new;
end; $$;

-- Sofort-WhatsApp: feuert nur bei Bestellungen mit mindestens einem Sonderartikel.
-- Formatiert den Text NICHT selbst — das wäre eine dritte Kopie der Formatierungslogik.
-- Zugangsdaten kommen aus app.settings.* (vom Betreiber einmalig per SQL gesetzt, NICHT im Git).
-- Fehlt die Einstellung oder schlägt pg_net fehl: still überspringen — der Cron holt es nach.
-- WICHTIG: Diese Funktion darf die Bestellung niemals scheitern lassen.
create or replace function public.notify_special_order() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  has_special boolean;
  url text;
  key text;
begin
  select exists (
    select 1 from jsonb_array_elements(new.items) it where it->>'kind' = 'special'
  ) into has_special;
  if not has_special then
    return new;
  end if;

  url := current_setting('app.settings.notify_url', true);
  key := current_setting('app.settings.notify_key', true);
  if url is null or url = '' or key is null or key = '' then
    return new; -- nicht konfiguriert -> Sicherheitsnetz übernimmt
  end if;

  perform net.http_post(
    url     := url,
    headers := jsonb_build_object('Authorization', 'Bearer ' || key, 'Content-Type', 'application/json'),
    body    := jsonb_build_object('order_id', new.id)
  );
  return new;
exception when others then
  return new; -- eine fehlgeschlagene Benachrichtigung darf die Bestellung nie kippen
end; $$;

drop trigger if exists notify_special_order_after_insert on public.orders;
create trigger notify_special_order_after_insert
  after insert on public.orders
  for each row execute function public.notify_special_order();
