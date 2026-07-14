-- DVS Gestionale v4.3.1 — Trial Avid di postazione
-- Eseguire una sola volta nel SQL Editor di Supabase.
-- Migrazione additiva e compatibile con la v4.3 precedente.

begin;

alter table public.stations
  add column if not exists avid_trial_status text not null default 'none',
  add column if not exists avid_trial_expiry date;

alter table public.stations
  drop constraint if exists stations_avid_trial_status_check;

alter table public.stations
  add constraint stations_avid_trial_status_check
  check (avid_trial_status in ('none','pending','active'));

alter table public.stations
  drop constraint if exists stations_avid_trial_consistency_check;

alter table public.stations
  add constraint stations_avid_trial_consistency_check
  check (
    (avid_trial_status='none' and avid_trial_expiry is null)
    or
    (avid_trial_status='pending' and avid_trial_expiry is null and avid_license_id is null)
    or
    (avid_trial_status='active' and avid_trial_expiry is not null and avid_license_id is null)
  );

-- notification_deliveries ora può registrare anche notifiche Trial,
-- che sono riferite a una postazione e non a una licenza inventariata.
alter table public.notification_deliveries
  alter column license_id drop not null;

alter table public.notification_deliveries
  add column if not exists station_id uuid references public.stations(id) on delete cascade;

alter table public.notification_deliveries
  drop constraint if exists notification_deliveries_subscription_id_license_id_event_key_key;

alter table public.notification_deliveries
  drop constraint if exists notification_deliveries_target_check;

alter table public.notification_deliveries
  add constraint notification_deliveries_target_check
  check (
    (license_id is not null and station_id is null)
    or
    (license_id is null and station_id is not null)
  );

create unique index if not exists notification_deliveries_license_event_uidx
  on public.notification_deliveries(subscription_id,license_id,event_key)
  where license_id is not null;

create unique index if not exists notification_deliveries_station_event_uidx
  on public.notification_deliveries(subscription_id,station_id,event_key)
  where station_id is not null;

commit;
