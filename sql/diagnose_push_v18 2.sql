-- DVS Workspace V18 — diagnostica notifiche (sola lettura).
-- Eseguire nel SQL Editor di Supabase dopo l'installazione della V18.

-- Il cron deve risultare attivo con schedule 0 7,8 * * *.
select jobid, jobname, schedule, active, command
from cron.job
where jobname = 'dvs-expiry-notifications';

-- Ultime esecuzioni del cron.
select jobid, status, return_message, start_time, end_time
from cron.job_run_details
where jobid in (
  select jobid from cron.job where jobname = 'dvs-expiry-notifications'
)
order by start_time desc
limit 20;

-- Dispositivi registrati. app_url deve essere valorizzato dopo aver aperto la V18.
select id, device_label, enabled, app_url, created_at, updated_at
from public.push_subscriptions
order by updated_at desc;

-- Ultime consegne registrate dalla Edge Function.
select subscription_id, license_id, event_key, sent_at
from public.notification_deliveries
order by sent_at desc
limit 50;
