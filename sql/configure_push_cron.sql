-- DVS Gestionale v4.2 — Programmazione giornaliera notifiche
-- Eseguire DOPO:
-- 1. aver distribuito la Edge Function send-expiry-notifications;
-- 2. aver salvato la SERVICE ROLE KEY nel Vault.
--
-- Tre tentativi giornalieri. Il primo invio riuscito viene registrato e
-- i tentativi successivi non generano duplicati.

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
  '10 8,12,16 * * *',
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
    body := '{"cron":true}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);
