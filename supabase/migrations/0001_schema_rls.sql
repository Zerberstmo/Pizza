-- Teil-B1: Schema + RLS. Auszuführen via Supabase CLI (supabase db push) oder SQL-Editor.

-- ── profiles (1:1 zu auth.users) ─────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null default '',
  last_name  text not null default '',
  phone      text not null default '',
  role       text not null default 'customer' check (role in ('customer','admin')),
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- Bei jedem neuen auth.users-Eintrag automatisch ein profiles anlegen,
-- Werte aus raw_user_meta_data übernehmen (setzt die Edge Function beim Anlegen).
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, first_name, last_name, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'first_name',''),
    coalesce(new.raw_user_meta_data->>'last_name',''),
    coalesce(new.raw_user_meta_data->>'phone',''),
    coalesce(new.raw_user_meta_data->>'role','customer')
  );
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Rollen-Helper: SECURITY DEFINER umgeht RLS → keine Rekursion in profiles-Policies.
create function public.is_admin() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and active);
$$;

-- ── Domänentabellen ──────────────────────────────────────────
create table public.ingredients (
  id text primary key, name text not null, emoji text not null,
  category text not null, available boolean not null default true, description text not null default ''
);
create table public.sauces (
  id text primary key, name text not null, emoji text not null,
  color text not null, available boolean not null default true
);
create table public.vouchers (
  id text primary key, name text not null, code text not null,
  type text not null check (type in ('percent','fixed','ingredient')),
  value numeric not null default 0, ingredient_name text,
  expires_at date not null, active boolean not null default true,
  max_uses int not null default 0, uses int not null default 0
);
create table public.app_config (
  id int primary key default 1 check (id = 1),
  days jsonb not null, hours jsonb not null, lead_time_days int not null, service jsonb not null
);
create table public.orders (
  id text primary key,
  user_id uuid references auth.users(id) on delete set null,
  items jsonb not null,
  subtotal numeric not null, discount numeric not null, total numeric not null,
  free_ingredient text,
  service_mode text not null,
  pickup_date text not null, pickup_time text not null,
  notes text not null default '',
  voucher_code text,
  status text not null default 'eingegangen',
  created_at timestamptz not null default now()
);

-- ── RLS ──────────────────────────────────────────────────────
alter table public.profiles    enable row level security;
alter table public.ingredients enable row level security;
alter table public.sauces      enable row level security;
alter table public.vouchers    enable row level security;
alter table public.app_config  enable row level security;
alter table public.orders      enable row level security;

-- profiles: eigene Zeile lesen/ändern (role/active bleiben clientseitig unberührt; harte Absicherung = B4/Trigger optional); Admins alles.
create policy profiles_select_self_or_admin on public.profiles for select
  using (id = auth.uid() or public.is_admin());
create policy profiles_update_self_or_admin on public.profiles for update
  using (id = auth.uid() or public.is_admin());
create policy profiles_admin_all on public.profiles for all
  using (public.is_admin()) with check (public.is_admin());

-- Menü/Config: alle Authentifizierten lesen, nur Admins schreiben.
create policy ingredients_read on public.ingredients for select using (auth.role() = 'authenticated');
create policy ingredients_admin on public.ingredients for all using (public.is_admin()) with check (public.is_admin());
create policy sauces_read on public.sauces for select using (auth.role() = 'authenticated');
create policy sauces_admin on public.sauces for all using (public.is_admin()) with check (public.is_admin());
create policy vouchers_read on public.vouchers for select using (auth.role() = 'authenticated');
create policy vouchers_admin on public.vouchers for all using (public.is_admin()) with check (public.is_admin());
create policy config_read on public.app_config for select using (auth.role() = 'authenticated');
create policy config_admin on public.app_config for all using (public.is_admin()) with check (public.is_admin());

-- orders: Kunde legt eigene an + liest eigene; Admins lesen/ändern alle.
create policy orders_insert_own on public.orders for insert with check (user_id = auth.uid());
create policy orders_select_own on public.orders for select using (user_id = auth.uid() or public.is_admin());
create policy orders_admin_update on public.orders for update using (public.is_admin()) with check (public.is_admin());
