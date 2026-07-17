-- DVS Workspace V10 Pre-Golden — notifiche Trial attive
-- Eseguire una sola volta nel SQL Editor di Supabase prima di distribuire
-- la Edge Function aggiornata send-expiry-notifications.

alter table public.notification_deliveries
  alter column license_id drop not null,
  add column if not exists station_id uuid references public.stations(id) on delete cascade;

alter table public.notification_deliveries
  drop constraint if exists notification_deliveries_subscription_id_license_id_event_key_key;

create unique index if not exists notification_deliveries_license_unique
  on public.notification_deliveries(subscription_id, license_id, event_key)
  where license_id is not null;

create unique index if not exists notification_deliveries_trial_unique
  on public.notification_deliveries(subscription_id, station_id, event_key)
  where station_id is not null;

alter table public.notification_deliveries
  drop constraint if exists notification_deliveries_target_check;

alter table public.notification_deliveries
  add constraint notification_deliveries_target_check
  check ((license_id is not null and station_id is null) or
         (license_id is null and station_id is not null));
