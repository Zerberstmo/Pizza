-- 0019: auth.role() (deprecated) → auth.jwt() ->> 'role'
-- auth.role() ist in Supabase als deprecated markiert. auth.jwt() ist die empfohlene,
-- aktuelle Funktion (liest denselben request.jwt.claims-Claim). Die Ersetzung ist
-- verhaltensgleich: authentifizierte Reads bleiben authentifizierten Rollen vorbehalten,
-- und der service_role-Zweig im Profil-Schutz-Trigger verhält sich identisch.

-- ── Menü/Config: alle Authentifizierten lesen (nur Read-Policies betroffen) ──
drop policy if exists ingredients_read on public.ingredients;
create policy ingredients_read on public.ingredients for select
  using ((auth.jwt() ->> 'role') = 'authenticated');

drop policy if exists sauces_read on public.sauces;
create policy sauces_read on public.sauces for select
  using ((auth.jwt() ->> 'role') = 'authenticated');

drop policy if exists vouchers_read on public.vouchers;
create policy vouchers_read on public.vouchers for select
  using ((auth.jwt() ->> 'role') = 'authenticated');

drop policy if exists config_read on public.app_config;
create policy config_read on public.app_config for select
  using ((auth.jwt() ->> 'role') = 'authenticated');

-- ── Profil-Schutz-Trigger: service_role-Check ohne auth.role() ──
create or replace function public.protect_profile_columns() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Admins (via App) und service_role (Edge Function) dürfen role/active setzen; sonst zurücksetzen.
  if not (public.is_admin() or (auth.jwt() ->> 'role') = 'service_role') then
    new.role := old.role;
    new.active := old.active;
  end if;
  return new;
end; $$;
