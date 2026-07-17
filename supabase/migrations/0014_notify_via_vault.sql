-- Sonderartikel-Sofort-WhatsApp: Zugangsdaten aus Supabase Vault statt app.settings.
-- Grund: gehostetes Supabase verweigert `alter database ... set app.settings.*` (permission denied),
-- daher liest der Trigger URL + Service-Role-Key jetzt aus `vault.decrypted_secrets`.
-- Ersetzt NUR den Funktionskörper aus 0013; der Trigger notify_special_order_after_insert bleibt.
-- Verhalten (still überspringen bei fehlender Konfig, Fehler schlucken) ist identisch zu 0013.

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

  -- Secrets liegen in Vault (vom Betreiber per vault.create_secret gesetzt, NICHT im Git).
  -- Fehlt eines, bleibt die Variable null -> still überspringen, der Cron holt nach.
  select decrypted_secret into url from vault.decrypted_secrets where name = 'notify_url';
  select decrypted_secret into key from vault.decrypted_secrets where name = 'notify_key';
  if url is null or url = '' or key is null or key = '' then
    return new;
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
