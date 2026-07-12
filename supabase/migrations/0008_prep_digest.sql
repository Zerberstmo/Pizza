-- Teil-B5: zweiter Idempotenz-Merker für die Vorbereitungsliste (unabhängig von last_digest_date).
alter table public.notify_config add column if not exists last_prep_date date;
