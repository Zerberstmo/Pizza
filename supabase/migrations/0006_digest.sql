-- Teil-B3: Kundendaten in orders (für Digest) + admin-only notify_config.

-- 1) Kundendaten in orders (bisher nicht gespeichert). Default '' hält Bestandszeilen gültig.
alter table public.orders add column if not exists customer_name  text not null default '';
alter table public.orders add column if not exists customer_phone text not null default '';

-- 2) Benachrichtigungs-Config (Single-Row). API-Key NICHT öffentlich lesbar.
create table if not exists public.notify_config (
  id                int primary key default 1 check (id = 1),
  recipient_phone   text not null default '',
  callmebot_apikey  text not null default '',
  enabled           boolean not null default false,
  last_digest_date  date
);
insert into public.notify_config (id) values (1) on conflict do nothing;

alter table public.notify_config enable row level security;
drop policy if exists notify_admin_all on public.notify_config;
create policy notify_admin_all on public.notify_config
  for all using (public.is_admin()) with check (public.is_admin());
