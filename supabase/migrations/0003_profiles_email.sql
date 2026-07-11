-- 0003: profiles bekommt eine email-Spalte (Anzeige in der Admin-Liste);
-- der Signup-Trigger schreibt sie aus auth.users (new.email) mit.
alter table public.profiles add column if not exists email text not null default '';

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, first_name, last_name, phone, role)
  values (new.id, coalesce(new.email,''),
    coalesce(new.raw_user_meta_data->>'first_name',''),
    coalesce(new.raw_user_meta_data->>'last_name',''),
    coalesce(new.raw_user_meta_data->>'phone',''),
    'customer'); -- SICHERHEIT: Rolle nie aus Metadata; Promotion via service_role/Admin.
  return new;
end; $$;
