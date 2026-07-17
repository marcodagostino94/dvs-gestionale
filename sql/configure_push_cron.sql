-- DVS Gestionale v4.2 — Programmazione giornaliera notifiche
-- Eseguire DOPO:
-- 1. aver distribuito la Edge Function send-expiry-notifications;
-- 2. aver salvato la SERVICE ROLE KEY nel Vault.
--
-- Il processo parte ogni giorno alle 07:00 UTC:
-- circa le 09:00 in Italia durante l'ora legale e le 08:00 durante l'ora solare.

create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault;

-- SOSTITUIRE YOUR_SERVICE_ROLE_KEY con la chiave service_role del progetto.
-- Non salvare questa chiave nei file Git.
select vault.create_secret(
  'YOUR_SERVICE_ROLE_KEY',
  'dvs_service_role_key',
  'Chiave usata dal cron per invocare la Edge Function'
);

select cron.unschedule('dvs-expiry-notifications')
where exists (
  select 1 from cron.job where jobname='dvs-expiry-notifications'
);

select cron.schedule(
  'dvs-expiry-notifications',
  '0 7 * * *',
  $$
  select net.http_post(
    url := 'https://fybkmudsrzyrhyoludsg.supabase.co/functions/v1/send-expiry-notifications',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || (
        select decrypted_secret
        from vault.decrypted_secrets
        where name='dvs_service_role_key'
        limit 1
      )
    ),
    body := '{}'::jsonb
  );
  $$
);
