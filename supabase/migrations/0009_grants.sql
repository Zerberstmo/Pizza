-- Supabase-Standard-Grants für das public-Schema wiederherstellen.
-- Nötig, weil ein `db reset` (drop schema public; create schema public) die Default-Grants
-- entfernt, die Supabase sonst mitbringt. Ohne diese GRANTs können anon/authenticated/service_role
-- die Tabellen nicht lesen/schreiben (RLS greift erst NACH der Tabellen-Berechtigung) → Login schlägt
-- mit "Konto deaktiviert" fehl, weil die profiles-Zeile nicht lesbar ist.
grant usage on schema public to postgres, anon, authenticated, service_role;

grant all on all tables    in schema public to postgres, anon, authenticated, service_role;
grant all on all routines  in schema public to postgres, anon, authenticated, service_role;
grant all on all sequences in schema public to postgres, anon, authenticated, service_role;

alter default privileges for role postgres in schema public grant all on tables    to postgres, anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on routines  to postgres, anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on sequences to postgres, anon, authenticated, service_role;
